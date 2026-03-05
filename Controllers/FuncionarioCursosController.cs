using Atrium.RH.Dtos.FuncionarioCursos;
using Atrium.RH.Services.FuncionarioCursos;
using Microsoft.AspNetCore.Mvc;

namespace Atrium.RH.Controllers
{
    [ApiController]
    [Route("api/funcionario-curso")]
    public class FuncionarioCursosController : ControllerBase
    {
        private readonly IFuncionarioCursoService _service;

        public FuncionarioCursosController(IFuncionarioCursoService service)
        {
            _service = service;
        }

        [HttpGet("funcionario/{funcionarioId:int}")]
        public async Task<ActionResult<List<FuncionarioCursoDto>>> ListarPorFuncionario(int funcionarioId, CancellationToken ct)
            => Ok(await _service.ListarPorFuncionarioAsync(funcionarioId, ct));

        [HttpPost]
        public async Task<ActionResult<FuncionarioCursoDto>> Vincular([FromBody] FuncionarioCursoCreateDto dto, CancellationToken ct)
        {
            var usuarioId = 1;
            var r = await _service.VincularAsync(dto, usuarioId, ct);
            return Ok(r);
        }
    }
}
