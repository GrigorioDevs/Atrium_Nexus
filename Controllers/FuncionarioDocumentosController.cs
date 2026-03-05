using Atrium.RH.Dtos.FuncionarioDocumentos;
using Atrium.RH.Services.FuncionarioDocumentos;
using Microsoft.AspNetCore.Mvc;

namespace Atrium.RH.Controllers;

[ApiController]
[Route("api/funcionarios/{funcionarioId:int}/explorer")]
public class FuncionarioDocumentosController : ControllerBase
{
    private readonly IFuncionarioExplorerService _svc;

    public FuncionarioDocumentosController(IFuncionarioExplorerService svc)
    {
        _svc = svc;
    }

    [HttpGet]
    public async Task<IActionResult> ListAll(int funcionarioId, CancellationToken ct)
        => Ok(await _svc.ListAll(funcionarioId, ct));

    [HttpPost("folders")]
    public async Task<IActionResult> CreateFolder(int funcionarioId, [FromBody] FuncionarioDocumentosCreate dto, CancellationToken ct)
        => Ok(await _svc.CreateFolder(funcionarioId, dto, ct));

    [HttpPut("items/{itemId}")]
    public async Task<IActionResult> Rename(int funcionarioId, string itemId, [FromBody] FuncionarioDocumentosRename dto, CancellationToken ct)
    {
        await _svc.Rename(funcionarioId, itemId, dto.Name ?? "", ct);
        return Ok(new { ok = true });
    }

    [HttpDelete("items/{itemId}")]
    public async Task<IActionResult> DeleteItem(int funcionarioId, string itemId, CancellationToken ct)
    {
        await _svc.DeleteItem(funcionarioId, itemId, ct);
        return Ok(new { ok = true });
    }

    [HttpPost("files")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> UploadFiles(int funcionarioId, [FromForm] FuncionarioDocumentosUploadForm form, CancellationToken ct)
    {
        var items = await _svc.UploadFiles(funcionarioId, form.ParentId, form.OwnerRole, form.Files, ct);
        return Ok(new { items });
    }

    [HttpGet("files/{itemId}/download")]
    public async Task<IActionResult> Download(int funcionarioId, string itemId, CancellationToken ct)
    {
        var (stream, contentType, fileName) = await _svc.OpenDownload(funcionarioId, itemId, ct);
        return File(stream, contentType, fileName);
    }

    [HttpPost("copy")]
    public async Task<IActionResult> Move(int funcionarioId, [FromBody] FuncionarioDocumentosCopy dto, CancellationToken ct)
    {
        await _svc.Move(funcionarioId, dto, ct);
        return Ok(new { ok = true });
    }
}
