using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.Usuarios;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Atrium.RH.Utils;

// ✅ novos
using Microsoft.AspNetCore.Authorization;
using Atrium.RH.Services.Usuarios;
using Microsoft.AspNetCore.Http;

namespace Atrium.RH.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // => "api/usuarios"
    public class UsuariosController : ControllerBase
    {
        private readonly AtriumRhDbContext _ctx;
        private readonly IUsuarioPerfilService _perfil;

        public UsuariosController(AtriumRhDbContext ctx, IUsuarioPerfilService perfil)
        {
            _ctx = ctx;
            _perfil = perfil;
        }

        // ✅ helper: transforma "/storage/..." em "http://localhost:PORTA/storage/..."
        private string? ToAbsoluteUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return url;

            // já é absoluta
            if (Uri.TryCreate(url, UriKind.Absolute, out _))
                return url;

            // garante que começa com /
            if (!url.StartsWith("/"))
                url = "/" + url;

            return $"{Request.Scheme}://{Request.Host}{url}";
        }

        // POST /api/usuarios
        [HttpPost]
        public async Task<IActionResult> Cadastrar([FromBody] UsuarioCadastroDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var cpfLimpo = new string(dto.Cpf.Where(char.IsDigit).ToArray());
            var telLimpo = new string(dto.Telefone.Where(char.IsDigit).ToArray());

            var jaExiste = await _ctx.Usuarios
                .AnyAsync(u => u.Login == dto.Login || u.Cpf == cpfLimpo);

            if (jaExiste)
                return Conflict(new { message = "Já existe um usuário com esse login ou CPF." });

            var usuario = new Usuario
            {
                Nome     = dto.Login,
                Login    = dto.Login,
                Email    = dto.Email,
                Cpf      = cpfLimpo,
                Telefone = telLimpo,
                TypeUser = dto.TypeUser,
                Ativo    = true,
                Criacao  = DateTimeOffset.UtcNow,
                Senha    = Security.Sha256Hex(dto.Senha ?? "")
            };

            _ctx.Usuarios.Add(usuario);
            await _ctx.SaveChangesAsync();

            return Ok(new {
                message = "Usuário cadastrado com sucesso.",
                id = usuario.Id,
                login = usuario.Login,
                typeUser = usuario.TypeUser
            });
        }

        // ✅ GET /api/usuarios/me
        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UsuarioMeDto>> Me(CancellationToken ct)
        {
            var me = await _perfil.GetMeAsync(ct);

            // se vier "/storage/...", devolve absoluto
            var fixedMe = me with { UserImg = ToAbsoluteUrl(me.UserImg) };

            return Ok(fixedMe);
        }

        // ✅ POST /api/usuarios/me/avatar
        [Authorize]
        [HttpPost("me/avatar")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<UploadAvatarResponseDto>> UploadAvatar([FromForm] IFormFile file, CancellationToken ct)
        {
            var result = await _perfil.UploadAvatarAsync(file, ct);

            var fixedUrl = ToAbsoluteUrl(result.Url) ?? result.Url;
            return Ok(new UploadAvatarResponseDto(fixedUrl));
        }
    }
}