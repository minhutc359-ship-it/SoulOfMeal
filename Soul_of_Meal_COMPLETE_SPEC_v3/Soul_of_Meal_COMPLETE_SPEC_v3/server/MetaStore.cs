using System.Security.Cryptography;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

internal sealed record SpiritDefinition(string Id, string Rarity);
internal sealed record BannerDefinition(string Id, string Family, string? Featured, int? Limit);
internal sealed record MetaCatalog(SpiritDefinition[] Characters, string Mascot, string[] Starters,
    string[] StarterGuardians, Dictionary<string, int> Rates, Dictionary<string, int> GuaranteeRates,
    int SrPity, int SsrPity, int FeaturedChance, int GemCost, Dictionary<string, int> DuplicateEssence,
    Dictionary<string, int> WelcomeWallet, BannerDefinition[] Banners);
internal sealed record PlayerIdentity(string Name, string Avatar, string? Starter, string[]? StarterIds = null);
internal sealed record CreatePlayerRequest(string? Name);
internal sealed record PityState(int SinceSsr = 0, int SinceSr = 0, bool FeaturedGuaranteed = false, int Draws = 0);
internal sealed record DrawRequest(string? BannerId, int Count, string? Payment, Guid Key);
internal sealed record DrawItem(string Id, bool IsNew, int Essence);
internal sealed record DrawReceipt(Guid Key, string BannerId, int Count, string Payment, DrawItem[] Items);
internal sealed record MetaState(PlayerIdentity? Profile, Dictionary<string, int> Wallet, Dictionary<string, PityState> Pity,
    HashSet<string> Owned, int DuplicateEssence, DrawReceipt[] History);
internal sealed record DrawSettlement(MetaState Meta, DrawReceipt Receipt);

internal sealed class MetaStore(NpgsqlDataSource database)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly MetaCatalog Catalog = ReadCatalog();
    private static readonly string[] Legacy = ["chr_bunbo_holinh", "chr_pho_lamvu", "chr_goicuon_diepnhi",
        "chr_banhbao_bachngoc", "chr_caphe_davu"];

    private static MetaCatalog ReadCatalog()
    {
        using var resource = typeof(MetaStore).Assembly.GetManifestResourceStream("SoulOfMeal.Server.metaCatalog.json")
            ?? throw new InvalidOperationException("Missing meta catalog.");
        return JsonSerializer.Deserialize<MetaCatalog>(resource, Json)
            ?? throw new InvalidOperationException("Invalid meta catalog.");
    }

    public Task<MetaState> ReadAsync(Guid accountId, string username, CancellationToken ct) =>
        TransactAsync(accountId, username, (_, _, state) => Task.FromResult((state, state)), ct);

    public Task<MetaState> CreateProfileAsync(Guid accountId, string username, string name, CancellationToken ct) =>
        TransactAsync(accountId, username, (_, _, state) =>
        {
            if (state.Profile?.Name == name) return Task.FromResult((state, state));
            if (state.Profile is not null) throw new MetaException("profile_exists", 409);
            var guardian = Catalog.StarterGuardians[RandomNumberGenerator.GetInt32(Catalog.StarterGuardians.Length)];
            var companion = Catalog.Starters[RandomNumberGenerator.GetInt32(Catalog.Starters.Length)];
            var starters = new[] { guardian, companion };
            state.Owned.UnionWith(starters);
            var next = state with { Profile = new PlayerIdentity(name, guardian, companion, starters) };
            return Task.FromResult((next, next));
        }, ct);

    public Task<DrawSettlement> DrawAsync(Guid accountId, string username, DrawRequest request, CancellationToken ct) =>
        TransactAsync(accountId, username, async (connection, transaction, state) =>
        {
            var banner = Catalog.Banners.FirstOrDefault(item => item.Id == request.BannerId);
            if (banner is null || request.Count is not (1 or 10) || request.Payment is not ("gem" or "ticket") || request.Key == Guid.Empty)
                throw new MetaException("invalid_draw", 400);
            if (state.Profile is null) throw new MetaException("profile_required", 409);
            await using var existing = new NpgsqlCommand("""
                SELECT receipt::text FROM som_gacha_receipts WHERE account_id = $1 AND request_key = $2
                """, connection, transaction);
            existing.Parameters.AddWithValue(accountId);
            existing.Parameters.AddWithValue(request.Key);
            if (await existing.ExecuteScalarAsync(ct) is string prior)
            {
                var receipt = JsonSerializer.Deserialize<DrawReceipt>(prior, Json)!;
                if (receipt.BannerId != banner.Id || receipt.Count != request.Count || receipt.Payment != request.Payment)
                    throw new MetaException("idempotency_conflict", 409);
                return (state, new DrawSettlement(state, receipt));
            }

            var pity = state.Pity.GetValueOrDefault(banner.Family) ?? new PityState();
            if (banner.Limit is int limit && pity.Draws + request.Count > limit)
                throw new MetaException("banner_limit", 409);
            var cost = request.Count * (request.Payment == "gem" ? Catalog.GemCost : 1);
            if (state.Wallet[request.Payment] < cost) throw new MetaException("insufficient_funds", 409);
            state.Wallet[request.Payment] -= cost;

            var items = new DrawItem[request.Count];
            var essence = 0;
            for (var index = 0; index < items.Length; index++)
            {
                var rarity = RollRarity(pity);
                var featuredDraw = rarity == "SSR" && banner.Featured is not null;
                var hitsFeatured = featuredDraw && (pity.FeaturedGuaranteed || RandomNumberGenerator.GetInt32(100) < Catalog.FeaturedChance);
                var pool = Catalog.Characters.Where(spirit => spirit.Rarity == rarity &&
                    (!featuredDraw || (spirit.Id == banner.Featured) == hitsFeatured)).ToArray();
                var selected = pool[RandomNumberGenerator.GetInt32(pool.Length)];
                var isNew = state.Owned.Add(selected.Id);
                var awarded = isNew ? 0 : Catalog.DuplicateEssence[rarity];
                essence += awarded;
                items[index] = new DrawItem(selected.Id, isNew, awarded);
                pity = new PityState(rarity == "SSR" ? 0 : pity.SinceSsr + 1,
                    rarity is "SR" or "SSR" ? 0 : pity.SinceSr + 1,
                    featuredDraw ? !hitsFeatured : pity.FeaturedGuaranteed, pity.Draws + 1);
            }
            state.Pity[banner.Family] = pity;
            var settled = new DrawReceipt(request.Key, banner.Id, request.Count, request.Payment, items);
            var next = state with { DuplicateEssence = state.DuplicateEssence + essence, History = state.History.Prepend(settled).Take(30).ToArray() };
            await using var insert = new NpgsqlCommand("""
                INSERT INTO som_gacha_receipts (account_id, request_key, receipt) VALUES ($1, $2, $3)
                """, connection, transaction);
            insert.Parameters.AddWithValue(accountId);
            insert.Parameters.AddWithValue(request.Key);
            insert.Parameters.AddWithValue(NpgsqlDbType.Jsonb, JsonSerializer.Serialize(settled, Json));
            await insert.ExecuteNonQueryAsync(ct);
            return (next, new DrawSettlement(next, settled));
        }, ct);

    private static string RollRarity(PityState pity)
    {
        if (pity.SinceSsr >= Catalog.SsrPity - 1) return "SSR";
        var rates = pity.SinceSr >= Catalog.SrPity - 1 ? Catalog.GuaranteeRates : Catalog.Rates;
        var roll = RandomNumberGenerator.GetInt32(100);
        foreach (var (rarity, rate) in rates)
        {
            if (roll < rate) return rarity;
            roll -= rate;
        }
        throw new InvalidOperationException("Invalid gacha rates.");
    }

    private async Task<T> TransactAsync<T>(Guid accountId, string username,
        Func<NpgsqlConnection, NpgsqlTransaction, MetaState, Task<(MetaState Next, T Result)>> update, CancellationToken ct)
    {
        await using var connection = await database.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        await using var read = new NpgsqlCommand("""
            SELECT meta_state::text, practice_save IS NOT NULL FROM som_accounts WHERE id = $1 FOR UPDATE
            """, connection, transaction);
        read.Parameters.AddWithValue(accountId);
        MetaState state;
        bool initialized;
        await using (var row = await read.ExecuteReaderAsync(ct))
        {
            if (!await row.ReadAsync(ct)) throw new MetaException("session_expired", 401);
            initialized = !row.IsDBNull(0);
            state = initialized ? JsonSerializer.Deserialize<MetaState>(row.GetString(0), Json)! :
                new MetaState(row.GetBoolean(1) ? new PlayerIdentity(username, Catalog.Mascot, null) : null,
                    new(Catalog.WelcomeWallet), new(), row.GetBoolean(1) ? new(Legacy) : new(), 0, []);
        }
        var (next, result) = await update(connection, transaction, state);
        if (!initialized || !ReferenceEquals(state, next))
        {
            await using var write = new NpgsqlCommand("UPDATE som_accounts SET meta_state = $2 WHERE id = $1", connection, transaction);
            write.Parameters.AddWithValue(accountId);
            write.Parameters.AddWithValue(NpgsqlDbType.Jsonb, JsonSerializer.Serialize(next, Json));
            await write.ExecuteNonQueryAsync(ct);
        }
        await transaction.CommitAsync(ct);
        return result;
    }
}

internal sealed class MetaException(string code, int status) : Exception(code)
{
    public int Status { get; } = status;
}
