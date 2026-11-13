using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

internal sealed record Credentials(string? Username, string? Password);
internal sealed record SaveRequest(Guid AccountId, int? ExpectedRevision, JsonElement Snapshot);

internal sealed class DummyPassword(IPasswordHasher<Account> hasher)
{
    public Account Account { get; } = new Account(Guid.Empty, "unknown", "");
    public string Hash { get; } = hasher.HashPassword(
        new Account(Guid.Empty, "unknown", ""), Guid.NewGuid().ToString("N"));
}

internal static partial class AccountEndpoints
{
    public const int MaxSaveBytes = 1024 * 1024;
    public const string CsrfHeader = "X-Soul-CSRF";
    private const string Scheme = CookieAuthenticationDefaults.AuthenticationScheme;

    public static void MapAccountEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1");
        api.MapGet("/auth/csrf", (HttpContext context, IAntiforgery antiforgery) =>
            TypedResults.Ok(new { token = antiforgery.GetAndStoreTokens(context).RequestToken }));
        api.MapGet("/me/bootstrap", Bootstrap).RequireAuthorization();

        var mutations = api.MapGroup("").AddEndpointFilter(ValidateCsrf);
        mutations.MapPost("/auth/register", Register).RequireRateLimiting("credentials");
        mutations.MapPost("/auth/login", Login).RequireRateLimiting("credentials");
        mutations.MapPost("/auth/guest", Guest).RequireRateLimiting("credentials");
        mutations.MapPost("/auth/logout", async (HttpContext context) =>
        {
            if (context.Request.Headers.TryGetValue("X-Soul-Account", out var expected)
                && expected.ToString() != context.User.FindFirstValue(ClaimTypes.NameIdentifier))
                return Error("session_expired", 401);
            await context.SignOutAsync(Scheme);
            return Results.NoContent();
        }).RequireAuthorization();
        mutations.MapPut("/me/practice-save", Save).RequireAuthorization();
        MetaEndpoints.MapMetaEndpoints(api, mutations);
    }

    private static async ValueTask<object?> ValidateCsrf(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var context = invocation.HttpContext;
        if (!context.Request.Headers.ContainsKey(CsrfHeader)) return Error("csrf", 403);
        try
        {
            await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context);
        }
        catch (AntiforgeryValidationException)
        {
            return Error("csrf", 403);
        }
        return await next(invocation);
    }

    private static async Task<IResult> Register(Credentials input, HttpContext context, GameStore store,
        IPasswordHasher<Account> hasher, CancellationToken cancellationToken)
    {
        if (context.User.Identity?.IsAuthenticated == true) return Error("session_active", 409);
        var username = input.Username?.Trim();
        if (username is null || !UsernamePattern().IsMatch(username) || input.Password is not { Length: >= 12 and <= 128 })
            return Error("invalid_registration", 400);

        var account = new Account(Guid.NewGuid(), username.ToLowerInvariant(), "");
        account = account with { PasswordHash = hasher.HashPassword(account, input.Password) };
        if (!await store.RegisterAsync(account, cancellationToken)) return Error("username_taken", 409);
        await SignIn(context, account);
        return Results.StatusCode(StatusCodes.Status201Created);
    }

    private static async Task<IResult> Login(Credentials input, HttpContext context, GameStore store,
        IPasswordHasher<Account> hasher, DummyPassword dummy, CancellationToken cancellationToken)
    {
        if (context.User.Identity?.IsAuthenticated == true) return Error("session_active", 409);
        var username = input.Username?.Trim();
        if (username is null || !UsernamePattern().IsMatch(username) || input.Password is not { Length: >= 1 and <= 128 })
            return Error("invalid_login", 401);

        var account = await store.FindAsync(username.ToLowerInvariant(), cancellationToken);
        var verified = hasher.VerifyHashedPassword(account ?? dummy.Account, account?.PasswordHash ?? dummy.Hash, input.Password);
        if (account is null || verified == PasswordVerificationResult.Failed) return Error("invalid_login", 401);
        if (verified == PasswordVerificationResult.SuccessRehashNeeded)
            await store.UpdatePasswordHashAsync(account, hasher.HashPassword(account, input.Password), cancellationToken);
        await SignIn(context, account);
        return Results.NoContent();
    }

    private static async Task<IResult> Guest(HttpContext context, GameStore store,
        IPasswordHasher<Account> hasher, CancellationToken cancellationToken)
    {
        if (context.User.Identity?.IsAuthenticated == true) return Error("session_active", 409);
        var account = await store.CreateGeneratedAccountAsync("guest", hasher, cancellationToken);
        await SignIn(context, account);
        return Results.StatusCode(StatusCodes.Status201Created);
    }

    internal static ClaimsPrincipal AccountPrincipal(Account account) => new(new ClaimsIdentity(
        [new(ClaimTypes.NameIdentifier, account.Id.ToString()), new(ClaimTypes.Name, account.Username)], Scheme));

    private static Task SignIn(HttpContext context, Account account) =>
        context.SignInAsync(Scheme, AccountPrincipal(account), new AuthenticationProperties { IsPersistent = true });

    private static async Task<IResult> Bootstrap(ClaimsPrincipal user, GameStore store, MetaStore metaStore, CancellationToken cancellationToken)
    {
        var id = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var save = await store.ReadAsync(id, cancellationToken);
        return save is null ? Error("session_expired", 401) : Results.Ok(new
        {
            account = new { id, username = user.Identity!.Name },
            practiceSave = save,
            meta = await metaStore.ReadAsync(id, user.Identity!.Name!, cancellationToken),
        });
    }

    private static async Task<IResult> Save(SaveRequest request, ClaimsPrincipal user, GameStore store,
        CancellationToken cancellationToken)
    {
        if (request.ExpectedRevision is not (>= 0 and < int.MaxValue) || !IsPracticeSnapshot(request.Snapshot))
            return Error("invalid_practice_save", 400);
        var snapshot = request.Snapshot.GetRawText();
        if (Encoding.UTF8.GetByteCount(snapshot) > MaxSaveBytes) return Error("save_too_large", 413);
        var id = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (request.AccountId != id) return Error("session_expired", 401);
        var revision = await store.WriteAsync(id, request.ExpectedRevision.Value, snapshot, cancellationToken);
        return revision.HasValue ? Results.Ok(new { revision }) : Error("save_conflict", 409);
    }

    private static bool IsPracticeSnapshot(JsonElement snapshot) =>
        snapshot.ValueKind == JsonValueKind.Object
        && snapshot.TryGetProperty("version", out var version) && version.ValueKind == JsonValueKind.Number
        && version.TryGetInt32(out var number) && number == 2
        && HasKind(snapshot, "player", JsonValueKind.Object)
        && HasKind(snapshot, "adventure", JsonValueKind.Object)
        && HasKind(snapshot, "roster", JsonValueKind.Array)
        && HasKind(snapshot, "modes", JsonValueKind.Object)
        && HasKind(snapshot, "settings", JsonValueKind.Object)
        && ContainsOnlyGameData(snapshot);

    private static bool HasKind(JsonElement value, string name, JsonValueKind kind) =>
        value.TryGetProperty(name, out var property) && property.ValueKind == kind;

    // The current demo HUD interpolates some catalog and save fields into HTML.
    private static bool ContainsOnlyGameData(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Object => value.EnumerateObject().All(property => IsPlainText(property.Name) && ContainsOnlyGameData(property.Value)),
        JsonValueKind.Array => value.EnumerateArray().All(ContainsOnlyGameData),
        JsonValueKind.String => IsPlainText(value.GetString()!),
        _ => true,
    };

    private static bool IsPlainText(string text) => text.AsSpan().IndexOfAny('<', '>', '"') < 0 && !text.Contains('\0');

    private static IResult Error(string code, int status) => Results.Json(new { code }, statusCode: status);

    [GeneratedRegex(@"\A[a-zA-Z0-9_]{3,24}\z", RegexOptions.CultureInvariant)]
    private static partial Regex UsernamePattern();
}
