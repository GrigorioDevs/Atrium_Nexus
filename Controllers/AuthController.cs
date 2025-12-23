using Atrium.RH.Dtos.Auth;
using Atrium.RH.Services;
using Microsoft.AspNetCore.Mvc;

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

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto req)
    {
        var res = await _auth.LoginAsync(req);
        if (res is null) return Unauthorized(new { message = "Credenciais inválidas." });
        return Ok(res);
    }
}
