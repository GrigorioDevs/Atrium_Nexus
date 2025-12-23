using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.Usuarios;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Atrium.RH.Utils;


namespace Atrium.RH.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // => "api/usuarios"
    public class UsuariosController : ControllerBase
    {
        private readonly AtriumRhDbContext _ctx;

        public UsuariosController(AtriumRhDbContext ctx)
        {
            _ctx = ctx;
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
                Nome     = dto.Login,          // por enquanto usa o login como nome
                Login    = dto.Login,
                Email    = dto.Email,
                Cpf      = cpfLimpo,
                Telefone = telLimpo,
                TypeUser = dto.TypeUser,      // 1..4 (no front vamos mandar 4)
                Ativo    = true,
                Criacao  = DateTimeOffset.UtcNow,
                Senha    = Security.Sha256Hex(dto.Senha ?? "") // << grava SHA256 em hex
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
    }
}
