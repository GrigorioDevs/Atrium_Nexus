using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos;
using Atrium.RH.Services.FuncionarioAssinatura.Options;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Atrium.RH.Services.FuncionarioAssinatura;

public sealed class FuncionarioAssinaturaGifService : IFuncionarioAssinaturaGifService
{
    private readonly AtriumRhDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly FuncionarioAssinaturaStorageOptions _opts;
    private readonly IHttpContextAccessor _http;

    public FuncionarioAssinaturaGifService(
        AtriumRhDbContext db,
        IWebHostEnvironment env,
        IOptions<FuncionarioAssinaturaStorageOptions> opts,
        IHttpContextAccessor http)
    {
        _db = db;
        _env = env;
        _opts = opts.Value;
        _http = http;
    }

    public async Task<FuncionarioAssinaturaDadosDto?> GetDadosAsync(int funcionarioId, CancellationToken ct)
    {
        return await _db.Funcionarios
            .AsNoTracking()
            .Where(x => x.Id == funcionarioId)
            .Select(x => new FuncionarioAssinaturaDadosDto
            {
                Id = x.Id,
                Nome = x.Nome ?? "",
                Funcao = x.Funcao ?? "",
                Email = x.Email ?? "",
                Celular = x.Celular ?? "",
                FotoUrl = $"/api/funcionarios/{x.Id}/foto"
            })
            .FirstOrDefaultAsync(ct);
    }

    public async Task<AssinaturaUploadResponseDto> UploadAsync(int funcionarioId, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length <= 0)
            throw new InvalidOperationException("Arquivo não enviado (campo 'file').");

        var ctLower = (file.ContentType ?? "").ToLowerInvariant();
        if (ctLower != "image/gif" && !file.FileName.EndsWith(".gif", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("O arquivo precisa ser GIF (image/gif).");

        // Root físico
        var root = (_opts.RootPath ?? "storage").Trim();
        if (!Path.IsPathRooted(root))
            root = Path.GetFullPath(Path.Combine(_env.ContentRootPath, root));

        // Pasta assinaturas/funcionarios/{id}
        var pastaRel = (_opts.PastaAssinaturasFuncionarios ?? "assinaturas/funcionarios")
            .Trim()
            .TrimStart('/', '\\')
            .Replace('/', Path.DirectorySeparatorChar)
            .Replace('\\', Path.DirectorySeparatorChar);

        var dir = Path.Combine(root, pastaRel, funcionarioId.ToString());
        Directory.CreateDirectory(dir);

        var fileName = $"{Guid.NewGuid():N}.gif";
        var physicalPath = Path.Combine(dir, fileName);

        await using (var fs = new FileStream(physicalPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await file.CopyToAsync(fs, ct);
        }

        // Base pública (/storage)
        var publicBase = (_opts.PublicBasePath ?? "/storage").Trim();
        if (!publicBase.StartsWith("/")) publicBase = "/" + publicBase;
        publicBase = publicBase.TrimEnd('/');

        var pastaUrl = (_opts.PastaAssinaturasFuncionarios ?? "assinaturas/funcionarios").Trim().Trim('/');

        var relativeUrl = $"{publicBase}/{pastaUrl}/{funcionarioId}/{fileName}";
        if (!relativeUrl.StartsWith("/")) relativeUrl = "/" + relativeUrl;

        var ctx = _http.HttpContext;
        var publicUrl = ctx is null
            ? relativeUrl
            : $"{ctx.Request.Scheme}://{ctx.Request.Host}{relativeUrl}";

        // Desativa anteriores
        var antigas = await _db.Set<FuncionarioAssinaturaGif>()
            .Where(x => x.FuncionarioId == funcionarioId && x.Ativa)
            .ToListAsync(ct);

        foreach (var a in antigas)
            a.Ativa = false;

        var storageKey = $"{funcionarioId}/{fileName}";

        _db.Set<FuncionarioAssinaturaGif>().Add(new FuncionarioAssinaturaGif
        {
            FuncionarioId = funcionarioId,
            StorageKey = storageKey,
            PublicUrl = publicUrl,
            Ativa = true
        });

        await _db.SaveChangesAsync(ct);

        return new AssinaturaUploadResponseDto
        {
            Url = publicUrl,
            StorageKey = storageKey
        };
    }

    public async Task<string?> GetUrlAtivaAsync(int funcionarioId, CancellationToken ct)
    {
        return await _db.Set<FuncionarioAssinaturaGif>()
            .AsNoTracking()
            .Where(x => x.FuncionarioId == funcionarioId && x.Ativa)
            .OrderByDescending(x => x.Id)
            .Select(x => x.PublicUrl)
            .FirstOrDefaultAsync(ct);
    }
}