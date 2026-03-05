using Atrium.RH.Data;
using Atrium.RH.Dtos.Auth;
using Atrium.RH.Helpers;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Services;

public class AuthService
{
    private readonly AtriumRhDbContext _db;

    public AuthService(AtriumRhDbContext db)
    {
        _db = db;
    }

    public async Task<LoginResponseDto?> LoginAsync(LoginRequestDto req)
    {
        var login = (req.Login ?? "").Trim();
        var cpf = Sha256Helper.DigitsOnly(req.Cpf);
        var senha = req.Senha ?? "";

        if (string.IsNullOrWhiteSpace(senha)) return null;
        if (string.IsNullOrWhiteSpace(login) && string.IsNullOrWhiteSpace(cpf)) return null;

        var query = _db.Usuarios.AsNoTracking();

        var user = !string.IsNullOrWhiteSpace(login)
            ? await query.FirstOrDefaultAsync(u => u.Login == login)
            : await query.FirstOrDefaultAsync(u => u.Cpf == cpf);

        if (user is null) return null;
        if (!user.Ativo) return null;

        var hash = Sha256Helper.Hash(senha); // bate com o HASHBYTES do seu INSERT
        if (!string.Equals(user.Senha, hash, StringComparison.OrdinalIgnoreCase))
            return null;

        return new LoginResponseDto
        {
            Id = user.Id,
            Nome = user.Nome,
            Login = user.Login,
            Email = user.Email,
            TypeUser = user.TypeUser,
            Telefone = user.Telefone
        };
    }
}
