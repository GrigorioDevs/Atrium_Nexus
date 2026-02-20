using Atrium.RH.Data;
using Atrium.RH.Dtos.Usuarios;
using Atrium.RH.Services.Usuario;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Services.Usuarios;

public class UsuarioPerfilService : IUsuarioPerfilService
{
    private readonly AtriumRhDbContext _ctx;
    private readonly ICurrentUserService _current;
    private readonly IConfiguration _cfg;

    public UsuarioPerfilService(AtriumRhDbContext ctx, ICurrentUserService current, IConfiguration cfg)
    {
        _ctx = ctx;
        _current = current;
        _cfg = cfg;
    }

    public async Task<UsuarioMeDto> GetMeAsync(CancellationToken ct)
    {
        var userId = _current.GetUserIdOrThrow();

        var me = await _ctx.Usuarios.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new UsuarioMeDto(
                u.Id,
                u.Nome,
                u.Email,
                u.TypeUser,
                u.UserImg
            ))
            .FirstOrDefaultAsync(ct);

        return me ?? throw new KeyNotFoundException("Usuário não encontrado.");
    }

    public async Task<UploadAvatarResponseDto> UploadAvatarAsync(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            throw new InvalidOperationException("Arquivo inválido.");

        var userId = _current.GetUserIdOrThrow();

        var storageRoot = _cfg["Storage:RootPath"];
        var publicBase = _cfg["Storage:PublicBasePath"] ?? "/storage";

        if (string.IsNullOrWhiteSpace(storageRoot))
            storageRoot = @"C:\SistemaWeb\System\Atrium_Nexus\Atrium_Nexus\storage";

        // limite default 5MB (ajustável via Storage:MaxBytes)
        var maxBytes = 5 * 1024 * 1024L;
        if (long.TryParse(_cfg["Storage:MaxBytes"], out var cfgMax) && cfgMax > 0)
            maxBytes = cfgMax;

        if (file.Length > maxBytes)
            throw new InvalidOperationException($"Arquivo excede o limite de {maxBytes} bytes.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = new HashSet<string> { ".jpg", ".jpeg", ".png", ".webp" };
        if (!allowed.Contains(ext))
            throw new InvalidOperationException("Formato não suportado. Use JPG/PNG/WEBP.");

        var user = await _ctx.Usuarios.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
            throw new KeyNotFoundException("Usuário não encontrado.");

        // storage/usuarios/{id}/
        var dir = Path.Combine(storageRoot, "usuarios", userId.ToString());
        Directory.CreateDirectory(dir);

        // apaga avatar antigo se for local (/storage/...)
        TryDeleteOldAvatarIfLocal(user.UserImg, storageRoot, publicBase);

        var fileName = $"{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(dir, fileName);

        await using (var fs = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
            await file.CopyToAsync(fs, ct);

        var url = $"{publicBase}/usuarios/{userId}/{fileName}";

        user.UserImg = url;
        await _ctx.SaveChangesAsync(ct);

        return new UploadAvatarResponseDto(url);
    }

    private static void TryDeleteOldAvatarIfLocal(string? oldUrl, string storageRoot, string publicBase)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(oldUrl)) return;
            if (!oldUrl.StartsWith(publicBase, StringComparison.OrdinalIgnoreCase)) return;

            var rel = oldUrl.Substring(publicBase.Length).TrimStart('/');
            if (string.IsNullOrWhiteSpace(rel)) return;

            var candidate = Path.Combine(storageRoot, rel.Replace('/', Path.DirectorySeparatorChar));

            // segurança: garante que o arquivo está dentro do storageRoot
            var rootFull = Path.GetFullPath(storageRoot).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            var candFull = Path.GetFullPath(candidate);

            if (!candFull.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase)) return;

            if (File.Exists(candFull))
                File.Delete(candFull);
        }
        catch { }
    }
}