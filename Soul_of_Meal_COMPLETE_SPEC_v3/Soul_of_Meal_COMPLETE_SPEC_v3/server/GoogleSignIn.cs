using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Identity;

internal static class GoogleSignIn
{
    private const string Scheme = "google";

    public static bool AddGoogleSignIn(this AuthenticationBuilder authentication, IConfiguration configuration)
    {
        var clientId = configuration["Authentication:Google:ClientId"];
        var clientSecret = configuration["Authentication:Google:ClientSecret"];
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret)) return false;
        authentication.AddOpenIdConnect(Scheme, options =>
        {
            options.Authority = "https://accounts.google.com";
            options.ClientId = clientId;
            options.ClientSecret = clientSecret;
            options.CallbackPath = "/signin-google";
            options.ResponseType = "code";
            options.UsePkce = true;
            options.SaveTokens = false;
            options.MapInboundClaims = false;
            options.Events.OnTokenValidated = async context =>
            {
                var subject = context.Principal?.FindFirstValue("sub");
                if (string.IsNullOrWhiteSpace(subject) || subject.Length > 255)
                {
                    context.Fail("Google identity is missing its subject.");
                    return;
                }
                var services = context.HttpContext.RequestServices;
                var store = services.GetRequiredService<GameStore>();
                var hasher = services.GetRequiredService<IPasswordHasher<Account>>();
                var account = await store.ExternalAccountAsync(Scheme, subject, hasher, context.HttpContext.RequestAborted);
                context.Principal = AccountEndpoints.AccountPrincipal(account);
                if (context.Properties is { } properties) properties.IsPersistent = true;
            };
            options.Events.OnRemoteFailure = context =>
            {
                context.HandleResponse();
                context.Response.Redirect("/client/?login=google_error");
                return Task.CompletedTask;
            };
        });
        return true;
    }

    public static void MapGoogleSignIn(this WebApplication app, bool enabled)
    {
        app.MapGet("/api/v1/auth/providers", () => Results.Ok(new { google = enabled }));
        if (!enabled) return;
        app.MapGet("/api/v1/auth/providers/google/start", (HttpContext context) =>
            context.User.Identity?.IsAuthenticated == true ? Results.Redirect("/client/") :
            Results.Challenge(new AuthenticationProperties { RedirectUri = "/client/?login=google" }, [Scheme]))
            .RequireRateLimiting("credentials");
    }
}
