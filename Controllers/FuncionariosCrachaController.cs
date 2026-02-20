using Atrium_Nexus.Services.Cracha;
using Microsoft.AspNetCore.Mvc;

namespace Atrium_Nexus.Controllers;

[ApiController]
[Route("api/funcionarios")]
public class FuncionariosCrachaController : ControllerBase
{
    private readonly ICrachaService _cracha;

    public FuncionariosCrachaController(ICrachaService cracha)
    {
        _cracha = cracha;
    }

    [HttpGet("{id:int}/cracha")]
    public async Task<IActionResult> GetCracha(int id)
    {
        var dto = await _cracha.GetCrachaAsync(id);
        if (dto == null) return NotFound(new { message = "Funcionário não encontrado." });
        return Ok(dto);
    }
}
