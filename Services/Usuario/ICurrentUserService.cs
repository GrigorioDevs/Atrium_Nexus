using System.Security.Claims;

namespace Atrium.RH.Services.Usuario;

public interface ICurrentUserService
{
    int GetUserIdOrThrow();
    bool TryGetUserId(out int userId);

    ClaimsPrincipal? GetPrincipal();
}