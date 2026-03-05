using Atrium.RH.Dtos.FuncionarioDocumentosImportantes;
using Atrium.RH.Services.FuncionarioDocumentosImportantes;
using Microsoft.AspNetCore.Mvc;

namespace Atrium.RH.Controllers;

[ApiController]
[Route("api/funcionarios/{funcionarioId:int}/documentos-importantes")]
public class FuncionarioDocumentosImportantesController : ControllerBase
{
    private readonly IFuncionarioDocumentosImportantesService _svc;

    public FuncionarioDocumentosImportantesController(IFuncionarioDocumentosImportantesService svc)
    {
        _svc = svc;
    }

    [HttpGet]
    public async Task<IActionResult> List(int funcionarioId, CancellationToken ct)
        => Ok(await _svc.List(funcionarioId, ct));

    [HttpPost]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> Upload(int funcionarioId, [FromForm] FuncionarioDocumentoImportanteUploadForm form, CancellationToken ct)
    {
        var created = await _svc.Upload(funcionarioId, form, ct);
        return Ok(created);
    }

    [HttpGet("{docId:int}/download")]
    public async Task<IActionResult> Download(int funcionarioId, int docId, CancellationToken ct)
    {
        var (stream, contentType, fileName) = await _svc.OpenDownload(funcionarioId, docId, ct);
        return File(stream, contentType, fileName);
    }

    [HttpDelete("{docId:int}")]
    public async Task<IActionResult> Delete(int funcionarioId, int docId, CancellationToken ct)
    {
        await _svc.Delete(funcionarioId, docId, ct);
        return Ok(new { ok = true });
    }
}
