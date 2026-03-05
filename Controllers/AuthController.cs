using Atrium.RH.Dtos.Auth;
using Atrium.RH.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using System.Security.Claims;

namespace Atrium.RH.Controllers;

[ApiController]
[Route("api/usuario")]
public class AuthController : ControllerBase
{
    private readonly AuthService _auth;

    public AuthController(AuthService auth)
    {
        _auth = auth;
    }

    // POST /api/usuario/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto req, CancellationToken ct)
    {
        // Mantém seu fluxo atual: AuthService.LoginAsync(req)
        var res = await _auth.LoginAsync(req);
        if (res is null)
            return Unauthorized(new { message = "Credenciais inválidas." });

        // ✅ IMPORTANTE:
        // Para Cookie Auth funcionar, precisamos do ID do usuário aqui.
        // Eu tento extrair do objeto retornado pelo seu LoginAsync via reflexão.
        // Se o seu LoginAsync já devolve algo como { id, nome }, perfeito.
        var userId = TryGetInt(res, "id", "Id", "usuarioId", "UsuarioId", "userId", "UserId");
        var nome = TryGetString(res, "nome", "Nome", "usuarioNome", "UsuarioNome", "name", "Name");
        var userType = TryGetInt(res, "userType", "UserType", "tipo", "Tipo", "perfil", "Perfil");

        if (userId <= 0)
        {
            // Se cair aqui, ajuste seu LoginAsync para retornar o id do usuário
            // (ex.: { id = usuario.Id, nome = usuario.Nome, userType = usuario.Tipo }).
            return StatusCode(500, new
            {
                message = "Seu LoginAsync não está retornando o ID do usuário. Retorne um campo 'id' (ou 'usuarioId') para o cookie funcionar."
            });
        }

        // ✅ Cria claims que você vai usar no back (User.Claims)
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, string.IsNullOrWhiteSpace(nome) ? $"usuario-{userId}" : nome),
        };

        if (userType > 0)
            claims.Add(new Claim("userType", userType.ToString()));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        // ✅ em DEV, normalmente IsPersistent = true é ok (cookie persistente)
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true
            });

        // Você pode continuar devolvendo o seu res original.
        return Ok(res);
    }

    // POST /api/usuario/logout
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { ok = true });
    }

    // GET /api/usuario/me  (opcional, mas útil)
    [HttpGet("me")]
    public IActionResult Me()
    {
        if (!(User?.Identity?.IsAuthenticated ?? false))
            return Unauthorized(new { message = "Não autenticado." });

        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _ = int.TryParse(rawId, out var id);

        var nome = User.FindFirstValue(ClaimTypes.Name);
        var userType = User.FindFirstValue("userType");

        return Ok(new { id, nome, userType });
    }

    // ===================== helpers (reflexão) =====================
    private static int TryGetInt(object obj, params string[] names)
    {
        foreach (var n in names)
        {
            var p = obj.GetType().GetProperty(n, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (p == null) continue;

            var val = p.GetValue(obj);
            if (val is null) continue;

            if (val is int i) return i;
            if (int.TryParse(val.ToString(), out var parsed)) return parsed;
        }
        return 0;
    }

    private static string TryGetString(object obj, params string[] names)
    {
        foreach (var n in names)
        {
            var p = obj.GetType().GetProperty(n, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (p == null) continue;

            var val = p.GetValue(obj);
            if (val is null) continue;

            var s = val.ToString();
            if (!string.IsNullOrWhiteSpace(s)) return s;
        }
        return "";
    }
}
