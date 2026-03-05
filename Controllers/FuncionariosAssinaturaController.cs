using Atrium.RH.Dtos;
using Atrium.RH.Services.FuncionarioAssinatura;
using Microsoft.AspNetCore.Mvc;

namespace Atrium.RH.Controllers;

[ApiController]
[Route("api/funcionarios/{id:int}/assinatura")]
public sealed class FuncionariosAssinaturaController : ControllerBase
{
    private readonly IFuncionarioAssinaturaGifService _service;

    public FuncionariosAssinaturaController(IFuncionarioAssinaturaGifService service)
        => _service = service;

    // ✅ GET /api/funcionarios/{id}/assinatura/dados
    [HttpGet("dados")]
    [ProducesResponseType(typeof(FuncionarioAssinaturaDadosDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDados([FromRoute] int id, CancellationToken ct)
    {
        var dto = await _service.GetDadosAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    // ✅ POST /api/funcionarios/{id}/assinatura/upload
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(AssinaturaUploadResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Upload([FromRoute] int id, [FromForm(Name = "file")] IFormFile file, CancellationToken ct)
    {
        var res = await _service.UploadAsync(id, file, ct);
        return Ok(res);
    }

    // ✅ GET /api/funcionarios/{id}/assinatura/url
    [HttpGet("url")]
    [Produces("text/plain")]
    public async Task<IActionResult> GetUrl([FromRoute] int id, CancellationToken ct)
    {
        var url = await _service.GetUrlAtivaAsync(id, ct);
        return string.IsNullOrWhiteSpace(url) ? NotFound() : Content(url, "text/plain");
    }
}