using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.FuncionarioDocumentos;
using Atrium.RH.Services.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Services.FuncionarioDocumentos;

public class FuncionarioExplorerService : IFuncionarioExplorerService
{
    private readonly AtriumRhDbContext _db;
    private readonly IFileStorage _storage;

    public FuncionarioExplorerService(AtriumRhDbContext db, IFileStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    private static string FolderKey(int id) => $"p-{id}";
    private static string DocKey(int id) => $"d-{id}";

    private static bool TryParseFolderKey(string? key, out int id)
    {
        id = 0;
        if (string.IsNullOrWhiteSpace(key)) return false;
        key = key.Trim();
        if (key.StartsWith("p-", StringComparison.OrdinalIgnoreCase))
            return int.TryParse(key[2..], out id);
        return int.TryParse(key, out id);
    }

    private static bool TryParseDocKey(string? key, out int id)
    {
        id = 0;
        if (string.IsNullOrWhiteSpace(key)) return false;
        key = key.Trim();
        if (key.StartsWith("d-", StringComparison.OrdinalIgnoreCase))
            return int.TryParse(key[2..], out id);
        return int.TryParse(key, out id);
    }

    private static bool TryParseItemKey(string itemId, out bool isFolder, out int id)
    {
        isFolder = false;
        id = 0;
        if (string.IsNullOrWhiteSpace(itemId)) return false;

        itemId = itemId.Trim();
        if (itemId.StartsWith("p-", StringComparison.OrdinalIgnoreCase))
        {
            isFolder = true;
            return int.TryParse(itemId[2..], out id);
        }
        if (itemId.StartsWith("d-", StringComparison.OrdinalIgnoreCase))
        {
            isFolder = false;
            return int.TryParse(itemId[2..], out id);
        }

        return false;
    }

    private async Task EnsureFuncionario(int funcionarioId, CancellationToken ct)
    {
        var ok = await _db.Funcionarios.AnyAsync(x => x.Id == funcionarioId && x.Ativo, ct);
        if (!ok) throw new InvalidOperationException("Funcionário não encontrado.");
    }

    public async Task<IReadOnlyList<ExplorerItemDto>> ListAll(int funcionarioId, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        // ===== PASTAS =====
        var pastasRaw = await _db.FuncionarioPastas.AsNoTracking()
            .Where(x => x.FuncionarioId == funcionarioId && x.Ativo)
            .Select(x => new
            {
                x.Id,
                x.PastaPaiId,
                x.Nome,
                x.Criacao,
                x.Alteracao
            })
            .ToListAsync(ct);

        // ===== DOCUMENTOS (Explorer = não importante) =====
        var docsRaw = await _db.FuncionarioDocumentos.AsNoTracking()
            .Where(x => x.FuncionarioId == funcionarioId && x.Ativo && !x.DocumentoImportante)
            .Select(x => new
            {
                x.Id,
                x.PastaId,
                x.Nome,
                x.MimeType,
                x.TamanhoBytes,
                x.Criacao,
                x.Alteracao
            })
            .ToListAsync(ct);

        // ===== Agregações por pasta (tamanho / última alteração) =====
        // (isso evita o erro de Dictionary com key null)
        var folderSizeById = docsRaw
            .Where(d => d.PastaId.HasValue)
            .GroupBy(d => d.PastaId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.TamanhoBytes));

        var folderLastById = docsRaw
            .Where(d => d.PastaId.HasValue)
            .GroupBy(d => d.PastaId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.Max(x => x.Alteracao ?? x.Criacao)
            );

        var pastas = pastasRaw.Select(p =>
        {
            var ownWhen = p.Alteracao ?? p.Criacao;

            folderSizeById.TryGetValue(p.Id, out var size);
            folderLastById.TryGetValue(p.Id, out var lastFromFiles);

            // UploadedAt = "última modificação" (pasta ou algo dentro dela)
            var when = lastFromFiles == default
                ? ownWhen
                : (lastFromFiles > ownWhen ? lastFromFiles : ownWhen);

            return new ExplorerItemDto
            {
                Id = FolderKey(p.Id),
                Type = "folder",
                Name = p.Nome,
                ParentId = p.PastaPaiId == null ? null : FolderKey(p.PastaPaiId.Value),
                OwnerRole = 2,
                Size = size,                 // ✅ soma dos arquivos DIRETOS na pasta
                MimeType = null,
                UploadedAt = when,           // ✅ data de alteração
                DownloadUrl = null
            };
        }).ToList();

        var docs = docsRaw.Select(d => new ExplorerItemDto
        {
            Id = DocKey(d.Id),
            Type = "file",
            Name = d.Nome,
            ParentId = d.PastaId == null ? null : FolderKey(d.PastaId.Value),
            OwnerRole = 2,
            Size = d.TamanhoBytes,
            MimeType = d.MimeType,
            UploadedAt = (d.Alteracao ?? d.Criacao),
            DownloadUrl = $"/api/funcionarios/{funcionarioId}/explorer/files/{DocKey(d.Id)}/download"
        }).ToList();

        return pastas.OrderBy(x => x.Name).Concat(docs.OrderBy(x => x.Name)).ToList();
    }

    public async Task<ExplorerItemDto> CreateFolder(int funcionarioId, FuncionarioDocumentosCreate dto, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        var name = (dto.Name ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("Nome da pasta é obrigatório.");

        int? parentFolderId = null;
        if (!string.IsNullOrWhiteSpace(dto.ParentId))
        {
            if (!TryParseFolderKey(dto.ParentId, out var parsedParentId))
                throw new InvalidOperationException("parentId inválido.");

            var parentOk = await _db.FuncionarioPastas.AnyAsync(p =>
                p.Id == parsedParentId && p.FuncionarioId == funcionarioId && p.Ativo, ct);

            if (!parentOk)
                throw new InvalidOperationException("Pasta pai inválida para este funcionário.");

            parentFolderId = parsedParentId;
        }

        var now = DateTime.Now;
        const int usuarioCriacaoId = 1; // TODO: pegar do usuário logado

        var pasta = new FuncionarioPasta
        {
            FuncionarioId = funcionarioId,
            PastaPaiId = parentFolderId,
            Nome = name,
            Ativo = true,
            Criacao = now,
            Alteracao = null,
            UsuarioCriacaoId = usuarioCriacaoId,
            UsuarioId = null
        };

        _db.FuncionarioPastas.Add(pasta);
        await _db.SaveChangesAsync(ct);

        return new ExplorerItemDto
        {
            Id = FolderKey(pasta.Id),
            Type = "folder",
            Name = pasta.Nome,
            ParentId = pasta.PastaPaiId == null ? null : FolderKey(pasta.PastaPaiId.Value),
            OwnerRole = dto.OwnerRole ?? 2,
            Size = 0,
            UploadedAt = pasta.Criacao
        };
    }

    // Assinatura EXACTA da interface:
    public async Task<IReadOnlyList<ExplorerItemDto>> UploadFiles(
        int funcionarioId,
        string? parentId,
        int? ownerRole,
        List<IFormFile> files,
        CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        if (files == null || files.Count == 0)
            throw new InvalidOperationException("Envie ao menos 1 arquivo em 'files'.");

        int? pastaId = null;
        if (!string.IsNullOrWhiteSpace(parentId))
        {
            if (!TryParseFolderKey(parentId, out var parsed))
                throw new InvalidOperationException("parentId inválido.");

            var pastaOk = await _db.FuncionarioPastas.AnyAsync(p =>
                p.Id == parsed && p.FuncionarioId == funcionarioId && p.Ativo, ct);

            if (!pastaOk)
                throw new InvalidOperationException("Pasta inválida para este funcionário.");

            pastaId = parsed;
        }

        var now = DateTime.Now;
        const int usuarioCriacaoId = 1;

        var createdDocs = new List<FuncionarioDocumento>();

        foreach (var file in files)
        {
            if (file == null || file.Length == 0) continue;

            await using var stream = file.OpenReadStream();
            var storageKey = await _storage.SaveAsync(stream, file.FileName, file.ContentType, funcionarioId, ct);

            var doc = new FuncionarioDocumento
            {
                FuncionarioId = funcionarioId,
                PastaId = pastaId,
                DocumentoImportante = false,

                Nome = string.IsNullOrWhiteSpace(file.FileName) ? "arquivo" : file.FileName,

                StorageKey = storageKey,
                ArquivoNomeOriginal = file.FileName,
                MimeType = file.ContentType,
                TamanhoBytes = file.Length,

                Ativo = true,
                Criacao = now,
                Alteracao = null,
                UsuarioCriacaoId = usuarioCriacaoId,
                UsuarioId = null
            };

            createdDocs.Add(doc);
            _db.FuncionarioDocumentos.Add(doc);
        }

        await _db.SaveChangesAsync(ct);

        return createdDocs.Select(doc => new ExplorerItemDto
        {
            Id = DocKey(doc.Id),
            Type = "file",
            Name = doc.Nome,
            ParentId = doc.PastaId == null ? null : FolderKey(doc.PastaId.Value),
            OwnerRole = ownerRole ?? 2,
            Size = doc.TamanhoBytes,
            MimeType = doc.MimeType,
            UploadedAt = doc.Criacao,
            DownloadUrl = $"/api/funcionarios/{funcionarioId}/explorer/files/{DocKey(doc.Id)}/download"
        }).ToList();
    }

    public async Task<(Stream stream, string contentType, string fileName)> OpenDownload(int funcionarioId, string itemId, CancellationToken ct)
    {
        if (!TryParseDocKey(itemId, out var docId))
            throw new InvalidOperationException("itemId inválido (esperado d-123).");

        var doc = await _db.FuncionarioDocumentos.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == docId && x.FuncionarioId == funcionarioId && x.Ativo, ct);

        if (doc == null)
            throw new InvalidOperationException("Documento não encontrado.");

        return await _storage.OpenAsync(
            doc.StorageKey,
            doc.MimeType ?? "application/octet-stream",
            doc.ArquivoNomeOriginal ?? "documento",
            ct
        );
    }

    public async Task Rename(int funcionarioId, string itemId, string newName, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        newName = (newName ?? "").Trim();
        if (string.IsNullOrWhiteSpace(newName))
            throw new InvalidOperationException("Nome é obrigatório.");

        if (!TryParseItemKey(itemId, out var isFolder, out var id))
            throw new InvalidOperationException("itemId inválido.");

        var now = DateTime.Now;

        if (isFolder)
        {
            var pasta = await _db.FuncionarioPastas
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (pasta == null) throw new InvalidOperationException("Pasta não encontrada.");

            pasta.Nome = newName;
            pasta.Alteracao = now;
            pasta.UsuarioId = 1;
        }
        else
        {
            var doc = await _db.FuncionarioDocumentos
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (doc == null) throw new InvalidOperationException("Arquivo não encontrado.");

            doc.Nome = newName;
            doc.Alteracao = now;
            doc.UsuarioId = 1;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteItem(int funcionarioId, string itemId, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        if (!TryParseItemKey(itemId, out var isFolder, out var id))
            throw new InvalidOperationException("itemId inválido.");

        var now = DateTime.Now;

        if (!isFolder)
        {
            var doc = await _db.FuncionarioDocumentos
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (doc == null) throw new InvalidOperationException("Arquivo não encontrado.");

            doc.Ativo = false;
            doc.Alteracao = now;
            doc.UsuarioId = 1;

            await _db.SaveChangesAsync(ct);
            return;
        }

        var allFolders = await _db.FuncionarioPastas
            .Where(x => x.FuncionarioId == funcionarioId && x.Ativo)
            .Select(x => new { x.Id, x.PastaPaiId })
            .ToListAsync(ct);

        if (!allFolders.Any(x => x.Id == id))
            throw new InvalidOperationException("Pasta não encontrada.");

        // ToLookup aceita key null sem explodir
        var childrenLookup = allFolders.ToLookup(x => x.PastaPaiId, x => x.Id);

        var toDisable = new HashSet<int>();
        var q = new Queue<int>();
        q.Enqueue(id);
        toDisable.Add(id);

        while (q.Count > 0)
        {
            var cur = q.Dequeue();
            foreach (var kid in childrenLookup[cur])
            {
                if (toDisable.Add(kid))
                    q.Enqueue(kid);
            }
        }

        var docs = await _db.FuncionarioDocumentos
            .Where(d => d.FuncionarioId == funcionarioId && d.Ativo && d.PastaId != null && toDisable.Contains(d.PastaId.Value))
            .ToListAsync(ct);

        foreach (var d in docs)
        {
            d.Ativo = false;
            d.Alteracao = now;
            d.UsuarioId = 1;
        }

        var folders = await _db.FuncionarioPastas
            .Where(p => p.FuncionarioId == funcionarioId && p.Ativo && toDisable.Contains(p.Id))
            .ToListAsync(ct);

        foreach (var p in folders)
        {
            p.Ativo = false;
            p.Alteracao = now;
            p.UsuarioId = 1;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task Move(int funcionarioId, FuncionarioDocumentosCopy dto, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        if (string.IsNullOrWhiteSpace(dto.SrcItemId))
            throw new InvalidOperationException("srcItemId é obrigatório.");

        if (!TryParseItemKey(dto.SrcItemId, out var isFolder, out var id))
            throw new InvalidOperationException("srcItemId inválido.");

        int? targetFolderId = null;
        if (!string.IsNullOrWhiteSpace(dto.TargetParentId))
        {
            if (!TryParseFolderKey(dto.TargetParentId, out var parsedTarget))
                throw new InvalidOperationException("targetParentId inválido.");

            var targetOk = await _db.FuncionarioPastas.AnyAsync(p =>
                p.Id == parsedTarget && p.FuncionarioId == funcionarioId && p.Ativo, ct);

            if (!targetOk)
                throw new InvalidOperationException("Pasta destino inválida para este funcionário.");

            targetFolderId = parsedTarget;
        }

        var now = DateTime.Now;

        if (isFolder)
        {
            var pasta = await _db.FuncionarioPastas
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (pasta == null) throw new InvalidOperationException("Pasta não encontrada.");

            if (targetFolderId.HasValue && targetFolderId.Value == pasta.Id)
                throw new InvalidOperationException("Não é permitido mover a pasta para dentro dela mesma.");

            pasta.PastaPaiId = targetFolderId;
            pasta.Alteracao = now;
            pasta.UsuarioId = 1;
        }
        else
        {
            var doc = await _db.FuncionarioDocumentos
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (doc == null) throw new InvalidOperationException("Arquivo não encontrado.");

            doc.PastaId = targetFolderId;
            doc.Alteracao = now;
            doc.UsuarioId = 1;
        }

        await _db.SaveChangesAsync(ct);
    }
}
