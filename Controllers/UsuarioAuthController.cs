using Atrium.RH.Dtos.Auth;
using Atrium.RH.Services;
using Microsoft.AspNetCore.Mvc;

namespace Atrium.RH.Controllers;

[ApiController]
[Route("api/usuario")]
public class UsuarioAuthController : ControllerBase
{
    private readonly AuthService _auth;

    public UsuarioAuthController(AuthService auth)
    {
        _auth = auth;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto req)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var result = await _auth.LoginAsync(req);
        if (result is null) return Unauthorized();

        return Ok(result);
    }
}
