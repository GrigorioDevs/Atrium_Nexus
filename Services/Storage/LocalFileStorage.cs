using Microsoft.Extensions.Options;

namespace Atrium.RH.Services.Storage;

public class StorageOptions
{
    public string RootPath { get; set; } = "storage";
}

public class LocalFileStorage : IFileStorage
{
    private readonly string _rootPath;
    private readonly string _contentRoot;

    public LocalFileStorage(IOptions<StorageOptions> opt, IWebHostEnvironment env)
    {
        _rootPath = opt.Value.RootPath;
        _contentRoot = env.ContentRootPath; // raiz do app
    }

    public async Task<string> SaveAsync(
        Stream content,
        string originalFileName,
        string contentType,
        int funcionarioId,
        CancellationToken ct)
    {
        // Pasta por funcionario + ano-mes (organização)
        var yearMonth = DateTime.Now.ToString("yyyy-MM");
        var ext = Path.GetExtension(originalFileName).ToLowerInvariant();

        // Nome interno: guid + extensão (evita colisão e problemas de caracteres)
        var safeName = $"{Guid.NewGuid():N}{ext}";

        // Caminho físico
        var folder = Path.Combine(_contentRoot, _rootPath, "funcionarios", funcionarioId.ToString(), yearMonth);
        Directory.CreateDirectory(folder);

        var fullPath = Path.Combine(folder, safeName);

        await using var fs = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(fs, ct);

        // storage_key que vai pro banco (relativo ao RootPath)
        var storageKey = Path.Combine("funcionarios", funcionarioId.ToString(), yearMonth, safeName)
            .Replace("\\", "/");

        return storageKey;
    }

    public Task<(Stream Stream, string ContentType, string FileName)> OpenAsync(
        string storageKey,
        string contentType,
        string fileName,
        CancellationToken ct)
    {
        var fullPath = Path.Combine(_contentRoot, _rootPath, storageKey.Replace("/", Path.DirectorySeparatorChar.ToString()));

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult((stream, contentType, fileName));
    }

    public Task DeleteAsync(string storageKey, CancellationToken ct)
    {
        var fullPath = Path.Combine(_contentRoot, _rootPath, storageKey.Replace("/", Path.DirectorySeparatorChar.ToString()));
        if (File.Exists(fullPath)) File.Delete(fullPath);
        return Task.CompletedTask;
    }
}
