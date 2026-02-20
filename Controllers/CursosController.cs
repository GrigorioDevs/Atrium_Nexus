using Atrium.RH.Dtos.Cursos;
using Atrium.RH.Services.Cursos;
using Microsoft.AspNetCore.Mvc;

namespace Atrium.RH.Controllers
{
    [ApiController]
    [Route("api/cursos")]
    public class CursosController : ControllerBase
    {
        private readonly ICursoService _service;

        public CursosController(ICursoService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<List<CursoDto>>> Listar(CancellationToken ct)
            => Ok(await _service.ListarAsync(ct));

        [HttpGet("{id:int}")]
        public async Task<ActionResult<CursoDto>> Obter(int id, CancellationToken ct)
        {
            var r = await _service.ObterAsync(id, ct);
            return r == null ? NotFound() : Ok(r);
        }

        [HttpPost]
        public async Task<ActionResult<CursoDto>> Criar([FromBody] CursoCreateUpdateDto dto, CancellationToken ct)
        {
            // ajuste aqui se você pega o usuarioId do cookie/claims
            var usuarioId = 1;
            var r = await _service.CriarAsync(dto, usuarioId, ct);
            return Ok(r);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Inativar(int id, CancellationToken ct)
{
    var usuarioId = 1; // depois você troca para pegar do token/claims
    var ok = await _service.InativarAsync(id, usuarioId, ct);
    return ok ? NoContent() : NotFound();
}

        [HttpPut("{id:int}")]
        public async Task<ActionResult<CursoDto>> Atualizar(int id, [FromBody] CursoCreateUpdateDto dto, CancellationToken ct)
        {
            var usuarioId = 1;
            var r = await _service.AtualizarAsync(id, dto, usuarioId, ct);
            return r == null ? NotFound() : Ok(r);
        }
    }
}
