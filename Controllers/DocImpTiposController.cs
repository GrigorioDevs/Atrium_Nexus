using Atrium.RH.Dtos.DocImpTipos;
using Atrium.RH.Services.DocImpTipos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Atrium.RH.Controllers;

[ApiController]
[Authorize] // <- agora precisa estar logado (cookie)
[Route("api/documentos-importantes/tipos")]
public class DocImpTiposController : ControllerBase
{
    private readonly IFuncDocImpTipoService _svc;

    public DocImpTiposController(IFuncDocImpTipoService svc)
    {
        _svc = svc;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
        => Ok(await _svc.ListAtivos(ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FuncDocImpTipoCreateDto dto, CancellationToken ct)
    {
        var userId = GetUserIdOrThrow();
        var created = await _svc.Create(dto.Nome, userId, ct);
        return Ok(created);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Rename(int id, [FromBody] FuncDocImpTipoUpdateDto dto, CancellationToken ct)
    {
        var userId = GetUserIdOrThrow();
        var updated = await _svc.Rename(id, dto.Nome, userId, ct);
        return Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var userId = GetUserIdOrThrow();
        await _svc.Inativar(id, userId, ct);
        return Ok(new { ok = true });
    }

    private int GetUserIdOrThrow()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(raw, out var id) || id <= 0)
            throw new UnauthorizedAccessException("Usuário não autenticado.");
        return id;
    }
}
