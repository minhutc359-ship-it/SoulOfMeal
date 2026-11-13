using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.FileProviders;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("SoulOfMeal")
    ?? throw new InvalidOperationException("Set ConnectionStrings__SoulOfMeal to a PostgreSQL connection string.");

builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = AccountEndpoints.MaxSaveBytes + 4096);
builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
builder.Services.AddSingleton<GameStore>();
builder.Services.AddSingleton<MetaStore>();
builder.Services.AddSingleton<PostgresTicketStore>();
builder.Services.AddSingleton<IPasswordHasher<Account>, PasswordHasher<Account>>();
builder.Services.AddSingleton<DummyPassword>();

var development = builder.Environment.IsDevelopment();
var cookieSecurity = development ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
var protection = builder.Services.AddDataProtection().SetApplicationName("SoulOfMeal");
if (builder.Configuration["DataProtection:KeyPath"] is { Length: > 0 } keyPath)
    protection.PersistKeysToFileSystem(Directory.CreateDirectory(keyPath));

var authentication = builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "som_session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = cookieSecurity;
    options.ExpireTimeSpan = TimeSpan.FromHours(12);
    options.SlidingExpiration = false;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
});
var googleEnabled = authentication.AddGoogleSignIn(builder.Configuration);
builder.Services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
    .Configure<PostgresTicketStore>((options, store) => options.SessionStore = store);
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = AccountEndpoints.CsrfHeader;
    options.Cookie.Name = "som_csrf";
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = cookieSecurity;
    options.Cookie.HttpOnly = true;
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("meta", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("credentials", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 12, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();
using var startup = new CancellationTokenSource(TimeSpan.FromSeconds(30));
await app.Services.GetRequiredService<GameStore>().InitializeAsync(startup.Token);
// Pay the dummy hash creation cost at startup so the first failed login looks like the rest.
_ = app.Services.GetRequiredService<DummyPassword>();

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.ContentSecurityPolicy =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
        + "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    await next(context);
});
if (app.Configuration["Web:ClientDirectory"] is { Length: > 0 } clientDirectory)
{
    var files = new PhysicalFileProvider(Path.GetFullPath(clientDirectory, app.Environment.ContentRootPath));
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = files });
    app.MapGet("/", () => Results.Redirect("/client/"));
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapAccountEndpoints();
app.MapGoogleSignIn(googleEnabled);
await app.RunAsync();
