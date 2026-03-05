using Atrium.RH.Data;
using Atrium.RH.Dtos.Usuarios;
using Atrium.RH.Utils;
using Microsoft.EntityFrameworkCore;
using System.Data;

// ✅ Alias para evitar conflito com namespace Atrium.RH.Services.Usuario
using UsuarioEntity = Atrium.RH.Domain.Entities.Usuario;

namespace Atrium.RH.Services
{
    public class UsuariosService
    {
        private readonly AtriumRhDbContext _db;

        public UsuariosService(AtriumRhDbContext db)
        {
            _db = db;
        }

        public async Task<int> CriarAsync(UsuarioCadastroDto dto)
        {
            // normaliza (seu Normalize.cs)
            var cpf = Normalize.OnlyDigits(dto.Cpf);
            var tel = Normalize.OnlyDigits(dto.Telefone);

            // validações básicas de regra
            if (dto.Senha != dto.ConfirmarSenha)
                throw new InvalidOperationException("Senha e confirmação não conferem.");

            // duplicidade
            if (await _db.Usuarios.AnyAsync(x => x.Cpf == cpf))
                throw new InvalidOperationException("CPF já cadastrado.");
            if (await _db.Usuarios.AnyAsync(x => x.Email == dto.Email))
                throw new InvalidOperationException("Email já cadastrado.");
            if (await _db.Usuarios.AnyAsync(x => x.Login == dto.Login))
                throw new InvalidOperationException("Login já cadastrado.");

            // horário BR
            var brOffset = TimeSpan.FromHours(-3);
            var nowBr = DateTimeOffset.UtcNow.ToOffset(brOffset);

            // ✅ usa o alias UsuarioEntity
            var user = new UsuarioEntity
            {
                // ⚠️ NÃO setar Id aqui (sua coluna é IDENTITY no SQL Server)
                LociId = 1,
                Ativo = true,
                Criacao = nowBr,
                DataSincronizacao = null,
                DataInterface = null,

                Cpf = cpf,
                Nome = dto.Login,     // regra: nome = login
                Login = dto.Login,
                Email = dto.Email.Trim(),
                Telefone = tel,
                TypeUser = dto.TypeUser,

                Senha = Security.Sha256Hex(dto.Senha ?? ""),
                UserImg = null
            };

            _db.Usuarios.Add(user);
            await _db.SaveChangesAsync();

            // ✅ após SaveChanges, o EF preenche user.Id automaticamente (IDENTITY)
            return user.Id;
        }
    }
}