using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.Usuarios;
using Atrium.RH.Utils;
using Microsoft.EntityFrameworkCore;
using System.Data;

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

            // IMPORTANTE: requisito "max + 1" pode dar corrida, então usa transação SERIALIZABLE
            await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

            var maxId = await _db.Usuarios.MaxAsync(x => (int?)x.Id) ?? 0;
            var nextId = maxId + 1;

            var brOffset = TimeSpan.FromHours(-3);
            var nowBr = DateTimeOffset.UtcNow.ToOffset(brOffset);

            var user = new Usuario
            {
                Id = nextId,
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

                Senha = Security.Sha256Hex(dto.Senha),
                UserImg = null
            };

            _db.Usuarios.Add(user);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return nextId;
        }
    }
}
