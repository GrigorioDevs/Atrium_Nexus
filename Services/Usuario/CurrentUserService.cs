using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Atrium.RH.Services.Usuario;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _http;

    public CurrentUserService(IHttpContextAccessor http)
    {
        _http = http;
    }

    public ClaimsPrincipal? GetPrincipal()
        => _http.HttpContext?.User;

    public bool TryGetUserId(out int userId)
    {
        userId = 0;

        var user = GetPrincipal();
        if (user?.Identity?.IsAuthenticated != true)
            return false;

        var idStr =
            user.FindFirstValue(ClaimTypes.NameIdentifier) ??
            user.FindFirstValue("id") ??
            user.FindFirstValue("usuarioId");

        return int.TryParse(idStr, out userId) && userId > 0;
    }

    public int GetUserIdOrThrow()
    {
        if (TryGetUserId(out var id))
            return id;

        throw new UnauthorizedAccessException("Usuário não autenticado.");
    }
}