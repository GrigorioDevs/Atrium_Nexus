using Atrium.RH.Data;
using Atrium.RH.Dtos.Usuarios;
using Atrium.RH.Services.Usuario; // <-- aqui fica o ICurrentUserService (ok manter)
using Atrium.RH.Utils;
using Microsoft.EntityFrameworkCore;

// ✅ Alias: evita conflito "Usuario namespace vs Usuario entity"
using UsuarioEntity = Atrium.RH.Domain.Entities.Usuario;

namespace Atrium.RH.Services.Usuarios
{
    public class UsuariosAdminService : IUsuariosAdminService
    {
        private const int ADMIN_ROLE = 1;

        private readonly AtriumRhDbContext _ctx;
        private readonly ICurrentUserService _currentUser;

        public UsuariosAdminService(AtriumRhDbContext ctx, ICurrentUserService currentUser)
        {
            _ctx = ctx;
            _currentUser = currentUser;
        }

        // ======================================================
        // 1) Segurança: só Admin
        // ======================================================
        private async Task EnsureAdminAsync(CancellationToken ct)
        {
            if (!_currentUser.TryGetUserId(out var userId))
                throw new UnauthorizedAccessException("Não autenticado.");

            var isAdmin = await _ctx.Usuarios.AsNoTracking()
                .AnyAsync(u => u.Id == userId && u.TypeUser == ADMIN_ROLE, ct);

            if (!isAdmin)
                throw new UnauthorizedAccessException("Acesso negado (somente Admin).");
        }

        // ======================================================
        // 2) Helpers
        // ======================================================
        private static string OnlyDigits(string? s)
            => new string((s ?? "").Where(char.IsDigit).ToArray());

        private static void ValidateTake(ref int take)
            => take = Math.Clamp(take, 1, 50);

        // ======================================================
        // 3) LISTAGEM (autocomplete)
        // ======================================================
        public async Task<List<UsuarioListItemDto>> ListAsync(string? search, int take, CancellationToken ct)
        {
            await EnsureAdminAsync(ct);

            ValidateTake(ref take);

            var term = (search ?? "").Trim();
            var termDigits = OnlyDigits(term);

            IQueryable<UsuarioEntity> q = _ctx.Usuarios.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(term))
            {
                q = q.Where(u =>
                    EF.Functions.Like(u.Nome, $"%{term}%") ||
                    EF.Functions.Like(u.Login, $"%{term}%") ||
                    EF.Functions.Like(u.Email, $"%{term}%") ||
                    (!string.IsNullOrEmpty(termDigits) && u.Cpf.Contains(termDigits))
                );
            }

            return await q.OrderBy(u => u.Nome)
                .Take(take)
                .Select(u => new UsuarioListItemDto
                {
                    Id = u.Id,
                    Nome = u.Nome,
                    Login = u.Login,
                    Email = u.Email,
                    TypeUser = u.TypeUser,
                    Ativo = u.Ativo
                })
                .ToListAsync(ct);
        }

        // ======================================================
        // 4) DETALHE (para preencher o formulário de edição)
        // ======================================================
        public async Task<UsuarioDetalheDto?> GetByIdAsync(int id, CancellationToken ct)
        {
            await EnsureAdminAsync(ct);

            return await _ctx.Usuarios.AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new UsuarioDetalheDto
                {
                    Id = u.Id,
                    Nome = u.Nome,
                    Login = u.Login,
                    Email = u.Email,
                    Cpf = u.Cpf,
                    Telefone = u.Telefone,
                    TypeUser = u.TypeUser,
                    Ativo = u.Ativo
                })
                .FirstOrDefaultAsync(ct);
        }

        // ======================================================
        // 5) CREATE
        // ======================================================
        public async Task<int> CreateAsync(UsuarioCadastroDto dto, CancellationToken ct)
        {
            await EnsureAdminAsync(ct);

            var cpf = OnlyDigits(dto.Cpf);
            var tel = OnlyDigits(dto.Telefone);
            var login = (dto.Login ?? "").Trim();
            var email = (dto.Email ?? "").Trim();

            if (string.IsNullOrWhiteSpace(login)) throw new ArgumentException("Informe o login.");
            if (string.IsNullOrWhiteSpace(email)) throw new ArgumentException("Informe o email.");
            if (string.IsNullOrWhiteSpace(cpf)) throw new ArgumentException("Informe o CPF.");

            if (string.IsNullOrWhiteSpace(dto.Senha) || dto.Senha.Length < 6)
                throw new ArgumentException("Senha mínima 6 caracteres.");

            if (dto.Senha != dto.ConfirmarSenha)
                throw new ArgumentException("As senhas não conferem.");

            var exists = await _ctx.Usuarios.AsNoTracking()
                .AnyAsync(u => u.Login == login || u.Cpf == cpf, ct);

            if (exists)
                throw new InvalidOperationException("Já existe usuário com esse login ou CPF.");

            // ✅ Usa alias da entity
            var entity = new UsuarioEntity
            {
                Nome = login, // (se você usa Nome = Login)
                Login = login,
                Email = email,
                Cpf = cpf,
                Telefone = tel,
                TypeUser = dto.TypeUser,
                Ativo = dto.Ativo,
                Criacao = DateTimeOffset.UtcNow,
                Senha = Security.Sha256Hex(dto.Senha)
            };

            _ctx.Usuarios.Add(entity);
            await _ctx.SaveChangesAsync(ct);
            return entity.Id;
        }

        // ======================================================
        // 6) UPDATE
        // ======================================================
        public async Task UpdateAsync(int id, UsuarioUpdateDto dto, CancellationToken ct)
        {
            await EnsureAdminAsync(ct);

            var u = await _ctx.Usuarios.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (u == null) throw new KeyNotFoundException("Usuário não encontrado.");

            var cpf = OnlyDigits(dto.Cpf);
            var tel = OnlyDigits(dto.Telefone);
            var login = (dto.Login ?? "").Trim();
            var email = (dto.Email ?? "").Trim();

            if (string.IsNullOrWhiteSpace(login)) throw new ArgumentException("Informe o login.");
            if (string.IsNullOrWhiteSpace(email)) throw new ArgumentException("Informe o email.");
            if (string.IsNullOrWhiteSpace(cpf)) throw new ArgumentException("Informe o CPF.");

            var exists = await _ctx.Usuarios.AsNoTracking()
                .AnyAsync(x => x.Id != id && (x.Login == login || x.Cpf == cpf), ct);

            if (exists)
                throw new InvalidOperationException("Já existe outro usuário com esse login ou CPF.");

            u.Nome = login;
            u.Login = login;
            u.Email = email;
            u.Cpf = cpf;
            u.Telefone = tel;
            u.TypeUser = dto.TypeUser;
            u.Ativo = dto.Ativo;

            var senha = (dto.Senha ?? "").Trim();
            var senha2 = (dto.ConfirmarSenha ?? "").Trim();

            if (!string.IsNullOrEmpty(senha) || !string.IsNullOrEmpty(senha2))
            {
                if (senha.Length < 6) throw new ArgumentException("Senha mínima 6 caracteres.");
                if (senha != senha2) throw new ArgumentException("As senhas não conferem.");
                u.Senha = Security.Sha256Hex(senha);
            }

            await _ctx.SaveChangesAsync(ct);
        }
    }
}