using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Npgsql;

internal sealed class PostgresTicketStore(NpgsqlDataSource database) : ITicketStore
{
    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        await using var cleanup = database.CreateCommand("DELETE FROM som_sessions WHERE expires_at <= now()");
        await cleanup.ExecuteNonQueryAsync();
        await using var command = database.CreateCommand("""
            INSERT INTO som_sessions (session_key, account_id, ticket, expires_at)
            VALUES ($1, $2, $3, $4)
            """);
        command.Parameters.AddWithValue(key);
        command.Parameters.AddWithValue(Guid.Parse(ticket.Principal.FindFirstValue(ClaimTypes.NameIdentifier)!));
        command.Parameters.AddWithValue(TicketSerializer.Default.Serialize(ticket));
        command.Parameters.AddWithValue(ticket.Properties.ExpiresUtc!.Value);
        await command.ExecuteNonQueryAsync();
        return key;
    }

    public async Task RenewAsync(string key, AuthenticationTicket ticket)
    {
        await using var command = database.CreateCommand("""
            UPDATE som_sessions SET ticket = $2, expires_at = $3
            WHERE session_key = $1 AND expires_at > now()
            """);
        command.Parameters.AddWithValue(key);
        command.Parameters.AddWithValue(TicketSerializer.Default.Serialize(ticket));
        command.Parameters.AddWithValue(ticket.Properties.ExpiresUtc!.Value);
        await command.ExecuteNonQueryAsync();
    }

    public async Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        await using var command = database.CreateCommand(
            "SELECT ticket FROM som_sessions WHERE session_key = $1 AND expires_at > now()");
        command.Parameters.AddWithValue(key);
        return await command.ExecuteScalarAsync() is byte[] data ? TicketSerializer.Default.Deserialize(data) : null;
    }

    public async Task RemoveAsync(string key)
    {
        await using var command = database.CreateCommand("DELETE FROM som_sessions WHERE session_key = $1");
        command.Parameters.AddWithValue(key);
        await command.ExecuteNonQueryAsync();
    }
}
