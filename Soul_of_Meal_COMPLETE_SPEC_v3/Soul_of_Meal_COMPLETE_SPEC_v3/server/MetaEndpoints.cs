using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;

internal static partial class MetaEndpoints
{
    public static void MapMetaEndpoints(RouteGroupBuilder api, RouteGroupBuilder mutations)
    {
        var guarded = mutations.MapGroup("").AddEndpointFilter(async (invocation, next) =>
        {
            var context = invocation.HttpContext;
            return context.Request.Headers.TryGetValue("X-Soul-Account", out var account)
                && account.ToString() != context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ? Results.Json(new { code = "session_expired" }, statusCode: 401) : await next(invocation);
        });
        api.MapGet("/gacha/banners", async (ClaimsPrincipal user, MetaStore store, CancellationToken ct) =>
            await Run(() => store.ReadAsync(AccountId(user), user.Identity!.Name!, ct))).RequireAuthorization();
        guarded.MapPost("/player/create", async (PlayerIdentity profile, ClaimsPrincipal user, MetaStore store, CancellationToken ct) =>
        {
            var name = profile.Name?.Trim().Normalize(NormalizationForm.FormC);
            if (name is null || !PlayerName().IsMatch(name)) return Results.Json(new { code = "invalid_profile" }, statusCode: 400);
            return await Run(() => store.CreateProfileAsync(AccountId(user), user.Identity!.Name!, profile with { Name = name }, ct));
        }).RequireAuthorization();
        guarded.MapPost("/gacha/draw", async (DrawRequest request, ClaimsPrincipal user, MetaStore store, CancellationToken ct) =>
            await Run(() => store.DrawAsync(AccountId(user), user.Identity!.Name!, request, ct))).RequireAuthorization().RequireRateLimiting("meta");
    }

    private static Guid AccountId(ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static async Task<IResult> Run<T>(Func<Task<T>> action)
    {
        try
        {
            return Results.Ok(await action());
        }
        catch (MetaException error)
        {
            return Results.Json(new { code = error.Message }, statusCode: error.Status);
        }
    }

    [GeneratedRegex(@"\A[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} _-]{1,17}[\p{L}\p{M}\p{N}]\z")]
    private static partial Regex PlayerName();
}
