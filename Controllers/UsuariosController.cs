using Atrium.RH.Dtos.Usuarios;
using Atrium.RH.Services.Usuarios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Atrium.RH.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsuariosController : ControllerBase
    {
        private readonly IUsuariosAdminService _admin;
        private readonly IUsuarioPerfilService _perfil;

        public UsuariosController(IUsuariosAdminService admin, IUsuarioPerfilService perfil)
        {
            _admin = admin;
            _perfil = perfil;
        }

        // ✅ GET /api/Usuarios?search=a&take=20
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? search = "", [FromQuery] int take = 20, CancellationToken ct = default)
        {
            try
            {
                var list = await _admin.ListAsync(search, take, ct);
                return Ok(list);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        // ✅ GET /api/Usuarios/8
        [Authorize]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById([FromRoute] int id, CancellationToken ct)
        {
            try
            {
                var u = await _admin.GetByIdAsync(id, ct);
                if (u == null) return NotFound(new { message = "Usuário não encontrado." });
                return Ok(u);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        // ✅ POST /api/Usuarios
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> Cadastrar([FromBody] UsuarioCadastroDto dto, CancellationToken ct)
        {
            try
            {
                var id = await _admin.CreateAsync(dto, ct);
                return Ok(new { message = "Usuário cadastrado com sucesso.", id });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        }

        // ✅ PUT /api/Usuarios/8
        [Authorize]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update([FromRoute] int id, [FromBody] UsuarioUpdateDto dto, CancellationToken ct)
        {
            try
            {
                await _admin.UpdateAsync(id, dto, ct);
                return Ok(new { message = "Usuário atualizado com sucesso." });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
            catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        }

        // ✅ GET /api/Usuarios/me
        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UsuarioMeDto>> Me(CancellationToken ct)
        {
            var me = await _perfil.GetMeAsync(ct);
            return Ok(me);
        }

        // ✅ POST /api/Usuarios/me/avatar
        [Authorize]
        [HttpPost("me/avatar")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<UploadAvatarResponseDto>> UploadAvatar([FromForm] IFormFile file, CancellationToken ct)
        {
            var res = await _perfil.UploadAvatarAsync(file, ct);
            return Ok(res);
        }
    }
}
