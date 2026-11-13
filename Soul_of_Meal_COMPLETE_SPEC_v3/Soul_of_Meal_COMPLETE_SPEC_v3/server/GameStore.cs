using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Npgsql;
using NpgsqlTypes;

internal sealed record Account(Guid Id, string Username, string PasswordHash);
internal sealed record PracticeSave(int Revision, JsonElement? Snapshot);

internal sealed class GameStore(NpgsqlDataSource database)
{
    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        await using var connection = await database.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // Serialize initialization when more than one server starts against a new database.
        await using var migrationLock = new NpgsqlCommand(
            "SELECT pg_advisory_xact_lock(432591129803766703);", connection, transaction);
        await migrationLock.ExecuteNonQueryAsync(cancellationToken);

        await using var resource = typeof(GameStore).Assembly.GetManifestResourceStream("SoulOfMeal.Server.schema.sql")
            ?? throw new InvalidOperationException("Database schema resource is missing.");
        using var reader = new StreamReader(resource);
        await using var command = new NpgsqlCommand(await reader.ReadToEndAsync(cancellationToken), connection, transaction);
        await command.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<Account?> FindAsync(string username, CancellationToken cancellationToken)
    {
        await using var command = database.CreateCommand(
            "SELECT id, username, password_hash FROM som_accounts WHERE username = $1");
        command.Parameters.AddWithValue(username);
        await using var result = await command.ExecuteReaderAsync(cancellationToken);
        return await result.ReadAsync(cancellationToken)
            ? new Account(result.GetGuid(0), result.GetString(1), result.GetString(2))
            : null;
    }

    public async Task<bool> RegisterAsync(Account account, CancellationToken cancellationToken)
    {
        await using var command = database.CreateCommand("""
            INSERT INTO som_accounts (id, username, password_hash) VALUES ($1, $2, $3)
            ON CONFLICT (username) DO NOTHING
            """);
        command.Parameters.AddWithValue(account.Id);
        command.Parameters.AddWithValue(account.Username);
        command.Parameters.AddWithValue(account.PasswordHash);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    private static Account NewGeneratedAccount(string prefix, IPasswordHasher<Account> hasher)
    {
        var id = Guid.NewGuid();
        var account = new Account(id, prefix + "_" + id.ToString("N")[..16], "");
        return account with { PasswordHash = hasher.HashPassword(account, Guid.NewGuid().ToString("N")) };
    }

    public async Task<Account> CreateGeneratedAccountAsync(string prefix, IPasswordHasher<Account> hasher, CancellationToken ct)
    {
        while (true)
        {
            var account = NewGeneratedAccount(prefix, hasher);
            if (await RegisterAsync(account, ct)) return account;
        }
    }

    public async Task<Account> ExternalAccountAsync(string provider, string subject, IPasswordHasher<Account> hasher, CancellationToken ct)
    {
        await using var connection = await database.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        await using var identityLock = new NpgsqlCommand(
            "SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 879652));", connection, transaction);
        identityLock.Parameters.AddWithValue(provider);
        identityLock.Parameters.AddWithValue(subject);
        await identityLock.ExecuteNonQueryAsync(ct);
        await using var find = new NpgsqlCommand("""
            SELECT account.id, account.username, account.password_hash
            FROM som_account_identities AS identity JOIN som_accounts AS account ON account.id = identity.account_id
            WHERE identity.provider = $1 AND identity.subject = $2
            """, connection, transaction);
        find.Parameters.AddWithValue(provider);
        find.Parameters.AddWithValue(subject);
        await using (var row = await find.ExecuteReaderAsync(ct))
        {
            if (await row.ReadAsync(ct)) return new Account(row.GetGuid(0), row.GetString(1), row.GetString(2));
        }

        Account account;
        while (true)
        {
            account = NewGeneratedAccount("google", hasher);
            await using var addAccount = new NpgsqlCommand("""
                INSERT INTO som_accounts (id, username, password_hash) VALUES ($1, $2, $3)
                ON CONFLICT (username) DO NOTHING
                """, connection, transaction);
            addAccount.Parameters.AddWithValue(account.Id);
            addAccount.Parameters.AddWithValue(account.Username);
            addAccount.Parameters.AddWithValue(account.PasswordHash);
            if (await addAccount.ExecuteNonQueryAsync(ct) == 1) break;
        }
        await using var addIdentity = new NpgsqlCommand("""
            INSERT INTO som_account_identities (provider, subject, account_id) VALUES ($1, $2, $3)
            """, connection, transaction);
        addIdentity.Parameters.AddWithValue(provider);
        addIdentity.Parameters.AddWithValue(subject);
        addIdentity.Parameters.AddWithValue(account.Id);
        await addIdentity.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
        return account;
    }

    public async Task UpdatePasswordHashAsync(Account account, string updatedHash, CancellationToken cancellationToken)
    {
        await using var command = database.CreateCommand(
            "UPDATE som_accounts SET password_hash = $1 WHERE id = $2 AND password_hash = $3");
        command.Parameters.AddWithValue(updatedHash);
        command.Parameters.AddWithValue(account.Id);
        command.Parameters.AddWithValue(account.PasswordHash);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<PracticeSave?> ReadAsync(Guid accountId, CancellationToken cancellationToken)
    {
        await using var command = database.CreateCommand(
            "SELECT save_revision, practice_save::text FROM som_accounts WHERE id = $1");
        command.Parameters.AddWithValue(accountId);
        await using var result = await command.ExecuteReaderAsync(cancellationToken);
        if (!await result.ReadAsync(cancellationToken)) return null;
        if (result.IsDBNull(1)) return new PracticeSave(result.GetInt32(0), null);
        using var document = JsonDocument.Parse(result.GetString(1));
        return new PracticeSave(result.GetInt32(0), document.RootElement.Clone());
    }

    public async Task<int?> WriteAsync(Guid accountId, int revision, string snapshot, CancellationToken cancellationToken)
    {
        await using var update = database.CreateCommand("""
            UPDATE som_accounts SET practice_save = $3, save_revision = save_revision + 1
            WHERE id = $1 AND save_revision = $2 RETURNING save_revision
            """);
        BindSave(update, accountId, revision, snapshot);
        if (await update.ExecuteScalarAsync(cancellationToken) is int written) return written;

        // A retry after a lost response is safe when it matches the latest committed write.
        await using var retry = database.CreateCommand("""
            SELECT save_revision FROM som_accounts
            WHERE id = $1 AND save_revision = $2 + 1 AND practice_save = $3
            """);
        BindSave(retry, accountId, revision, snapshot);
        return await retry.ExecuteScalarAsync(cancellationToken) as int?;
    }

    private static void BindSave(NpgsqlCommand command, Guid id, int revision, string snapshot)
    {
        command.Parameters.AddWithValue(id);
        command.Parameters.AddWithValue(revision);
        command.Parameters.AddWithValue(NpgsqlDbType.Jsonb, snapshot);
    }
}
