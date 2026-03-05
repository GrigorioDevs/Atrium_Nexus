using System.Security.Claims;
using Atrium.RH.Dtos.DocumentoTemplates;
using Atrium.RH.Services.DocumentoTemplates;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Atrium.RH.Controllers;

[ApiController]
[Route("api/documentos-templates")]
[Authorize]
public class DocumentoTemplatesController : ControllerBase
{
    private readonly IDocumentoTemplatesService _svc;
    public DocumentoTemplatesController(IDocumentoTemplatesService svc) => _svc = svc;

    private int UsuarioLogadoId()
    {
        var raw =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("id") ??
            User.FindFirstValue("userId");

        if (!int.TryParse(raw, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado nas claims.");

        return id;
    }

    [HttpGet]
    public async Task<ActionResult<List<DocumentoTemplateListItemDto>>> List(CancellationToken ct)
        => Ok(await _svc.ListAsync(UsuarioLogadoId(), ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DocumentoTemplateDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var r = await _svc.GetAsync(id, UsuarioLogadoId(), ct);
        return r is null ? NotFound() : Ok(r);
    }

    [HttpPost]
    public async Task<ActionResult<DocumentoTemplateDetailDto>> Create([FromBody] DocumentoTemplateCreateRequestDto dto, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var r = await _svc.CreateAsync(UsuarioLogadoId(), dto, ct);
        return CreatedAtAction(nameof(Get), new { id = r.Id }, r);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DocumentoTemplateDetailDto>> Update(Guid id, [FromBody] DocumentoTemplateUpdateRequestDto dto, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var r = await _svc.UpdateAsync(id, UsuarioLogadoId(), dto, ct);
        return r is null ? NotFound() : Ok(r);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var ok = await _svc.DeleteAsync(id, UsuarioLogadoId(), ct);
        return ok ? NoContent() : NotFound();
    }
}