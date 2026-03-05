using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.FuncionarioDocumentos;
using Atrium.RH.Services.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Atrium.RH.Services.FuncionarioDocumentos;

public class FuncionarioExplorerService : IFuncionarioExplorerService
{
    private readonly AtriumRhDbContext _db;
    private readonly IFileStorage _storage;
    private readonly IHttpContextAccessor _http;

    public FuncionarioExplorerService(AtriumRhDbContext db, IFileStorage storage, IHttpContextAccessor http)
    {
        _db = db;
        _storage = storage;
        _http = http;
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

    // ✅ Pega usuário logado (id) + TypeUser (1/2/3/4) direto do banco
    private async Task<(int userId, int typeUser)> GetViewerAsync(CancellationToken ct)
    {
        var user = _http.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var idStr =
            user.FindFirstValue(ClaimTypes.NameIdentifier) ??
            user.FindFirstValue("sub") ??
            user.FindFirstValue("id");

        if (string.IsNullOrWhiteSpace(idStr) || !int.TryParse(idStr, out var userId))
            throw new UnauthorizedAccessException("Não foi possível identificar o usuário logado.");

        var typeUser = await _db.Usuarios
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.TypeUser)
            .FirstOrDefaultAsync(ct);

        return (userId, typeUser);
    }

    public async Task<IReadOnlyList<ExplorerItemDto>> ListAll(int funcionarioId, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        var (_, viewerTypeUser) = await GetViewerAsync(ct);

        // ===== PASTAS (JOIN no usuário criador) =====
        var pastasQ =
            from p in _db.FuncionarioPastas.AsNoTracking()
            join u in _db.Usuarios.AsNoTracking()
                on p.UsuarioCriacaoId equals u.Id
            where p.FuncionarioId == funcionarioId && p.Ativo
            select new
            {
                p.Id,
                p.PastaPaiId,
                p.Nome,
                p.Criacao,
                p.Alteracao,
                CriadorTypeUser = u.TypeUser
            };

        // ✅ regra: Segurança (3) só vê itens criados por Segurança (criador TypeUser = 3)
        if (viewerTypeUser == 3)
            pastasQ = pastasQ.Where(x => x.CriadorTypeUser == 3);

        var pastasRaw = await pastasQ.ToListAsync(ct);

        // ids de pastas permitidas (pra não criar "órfãos")
        var allowedFolderIds = new HashSet<int>(pastasRaw.Select(p => p.Id));

        // ===== DOCUMENTOS (JOIN no usuário criador) =====
        var docsQ =
            from d in _db.FuncionarioDocumentos.AsNoTracking()
            join u in _db.Usuarios.AsNoTracking()
                on d.UsuarioCriacaoId equals u.Id
            where d.FuncionarioId == funcionarioId
                  && d.Ativo
                  && !d.DocumentoImportante
            select new
            {
                d.Id,
                d.PastaId,
                d.Nome,
                d.MimeType,
                d.TamanhoBytes,
                d.Criacao,
                d.Alteracao,
                d.StorageKey,
                d.ArquivoNomeOriginal,
                CriadorTypeUser = u.TypeUser
            };

        if (viewerTypeUser == 3)
        {
            docsQ = docsQ.Where(x => x.CriadorTypeUser == 3);
        }

        var docsRawAll = await docsQ.ToListAsync(ct);

        // ✅ se Segurança: não mostrar arquivos dentro de pastas que ele não enxerga (evita parent órfão)
        var docsRaw = viewerTypeUser == 3
            ? docsRawAll.Where(d => d.PastaId == null || allowedFolderIds.Contains(d.PastaId.Value)).ToList()
            : docsRawAll;

        // ===== Agregações por pasta (tamanho / última alteração) =====
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

            var when = lastFromFiles == default
                ? ownWhen
                : (lastFromFiles > ownWhen ? lastFromFiles : ownWhen);

            // ✅ se Segurança e o pai não existe na lista permitida, promove pra raiz (evita quebrar árvore)
            string? parentId = null;
            if (p.PastaPaiId != null && allowedFolderIds.Contains(p.PastaPaiId.Value))
                parentId = FolderKey(p.PastaPaiId.Value);

            return new ExplorerItemDto
            {
                Id = FolderKey(p.Id),
                Type = "folder",
                Name = p.Nome,
                ParentId = parentId,
                OwnerRole = p.CriadorTypeUser, // ✅ agora é o TypeUser de quem criou
                Size = size,
                MimeType = null,
                UploadedAt = when,
                DownloadUrl = null
            };
        }).ToList();

        var docs = docsRaw.Select(d => new ExplorerItemDto
        {
            Id = DocKey(d.Id),
            Type = "file",
            Name = d.Nome,
            ParentId = d.PastaId == null ? null : FolderKey(d.PastaId.Value),
            OwnerRole = d.CriadorTypeUser, // ✅ agora é o TypeUser de quem criou
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

        var (viewerUserId, viewerTypeUser) = await GetViewerAsync(ct);

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

        var pasta = new FuncionarioPasta
        {
            FuncionarioId = funcionarioId,
            PastaPaiId = parentFolderId,
            Nome = name,
            Ativo = true,
            Criacao = now,
            Alteracao = null,
            UsuarioCriacaoId = viewerUserId, // ✅ logado
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
            OwnerRole = viewerTypeUser, // ✅ criador
            Size = 0,
            UploadedAt = pasta.Criacao
        };
    }

    public async Task<IReadOnlyList<ExplorerItemDto>> UploadFiles(
        int funcionarioId,
        string? parentId,
        int? ownerRole,
        List<IFormFile> files,
        CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        var (viewerUserId, viewerTypeUser) = await GetViewerAsync(ct);

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
                UsuarioCriacaoId = viewerUserId, // ✅ logado
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
            OwnerRole = viewerTypeUser, // ✅ criador
            Size = doc.TamanhoBytes,
            MimeType = doc.MimeType,
            UploadedAt = doc.Criacao,
            DownloadUrl = $"/api/funcionarios/{funcionarioId}/explorer/files/{DocKey(doc.Id)}/download"
        }).ToList();
    }

    public async Task<(Stream stream, string contentType, string fileName)> OpenDownload(int funcionarioId, string itemId, CancellationToken ct)
    {
        var (_, viewerTypeUser) = await GetViewerAsync(ct);

        if (!TryParseDocKey(itemId, out var docId))
            throw new InvalidOperationException("itemId inválido (esperado d-123).");

        // ✅ join pra aplicar regra de permissão
        var q =
            from d in _db.FuncionarioDocumentos.AsNoTracking()
            join u in _db.Usuarios.AsNoTracking() on d.UsuarioCriacaoId equals u.Id
            where d.Id == docId && d.FuncionarioId == funcionarioId && d.Ativo
            select new
            {
                d.StorageKey,
                d.MimeType,
                d.ArquivoNomeOriginal,
                CriadorTypeUser = u.TypeUser
            };

        if (viewerTypeUser == 3)
            q = q.Where(x => x.CriadorTypeUser == 3);

        var doc = await q.FirstOrDefaultAsync(ct);
        if (doc == null)
            throw new UnauthorizedAccessException("Documento não encontrado ou sem permissão.");

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

        var (viewerUserId, viewerTypeUser) = await GetViewerAsync(ct);

        newName = (newName ?? "").Trim();
        if (string.IsNullOrWhiteSpace(newName))
            throw new InvalidOperationException("Nome é obrigatório.");

        if (!TryParseItemKey(itemId, out var isFolder, out var id))
            throw new InvalidOperationException("itemId inválido.");

        var now = DateTime.Now;

        if (isFolder)
        {
            // ✅ permissão por criador
            if (viewerTypeUser == 3)
            {
                var allowed = await (from p in _db.FuncionarioPastas.AsNoTracking()
                                     join u in _db.Usuarios.AsNoTracking() on p.UsuarioCriacaoId equals u.Id
                                     where p.Id == id && p.FuncionarioId == funcionarioId && p.Ativo
                                     select u.TypeUser).FirstOrDefaultAsync(ct);

                if (allowed != 3) throw new UnauthorizedAccessException("Sem permissão para renomear esta pasta.");
            }

            var pasta = await _db.FuncionarioPastas
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (pasta == null) throw new InvalidOperationException("Pasta não encontrada.");

            pasta.Nome = newName;
            pasta.Alteracao = now;
            pasta.UsuarioId = viewerUserId; // ✅ logado
        }
        else
        {
            if (viewerTypeUser == 3)
            {
                var allowed = await (from d in _db.FuncionarioDocumentos.AsNoTracking()
                                     join u in _db.Usuarios.AsNoTracking() on d.UsuarioCriacaoId equals u.Id
                                     where d.Id == id && d.FuncionarioId == funcionarioId && d.Ativo
                                     select u.TypeUser).FirstOrDefaultAsync(ct);

                if (allowed != 3) throw new UnauthorizedAccessException("Sem permissão para renomear este arquivo.");
            }

            var doc = await _db.FuncionarioDocumentos
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (doc == null) throw new InvalidOperationException("Arquivo não encontrado.");

            doc.Nome = newName;
            doc.Alteracao = now;
            doc.UsuarioId = viewerUserId; // ✅ logado
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteItem(int funcionarioId, string itemId, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        var (viewerUserId, viewerTypeUser) = await GetViewerAsync(ct);

        if (!TryParseItemKey(itemId, out var isFolder, out var id))
            throw new InvalidOperationException("itemId inválido.");

        var now = DateTime.Now;

        if (!isFolder)
        {
            if (viewerTypeUser == 3)
            {
                var allowed = await (from d in _db.FuncionarioDocumentos.AsNoTracking()
                                     join u in _db.Usuarios.AsNoTracking() on d.UsuarioCriacaoId equals u.Id
                                     where d.Id == id && d.FuncionarioId == funcionarioId && d.Ativo
                                     select u.TypeUser).FirstOrDefaultAsync(ct);

                if (allowed != 3) throw new UnauthorizedAccessException("Sem permissão para deletar este arquivo.");
            }

            var doc = await _db.FuncionarioDocumentos
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (doc == null) throw new InvalidOperationException("Arquivo não encontrado.");

            doc.Ativo = false;
            doc.Alteracao = now;
            doc.UsuarioId = viewerUserId;

            await _db.SaveChangesAsync(ct);
            return;
        }

        // ===== Deletar pasta + filhos =====
        // Primeiro: monta árvore completa de pastas
        var allFolders = await _db.FuncionarioPastas
            .Where(x => x.FuncionarioId == funcionarioId && x.Ativo)
            .Select(x => new { x.Id, x.PastaPaiId })
            .ToListAsync(ct);

        if (!allFolders.Any(x => x.Id == id))
            throw new InvalidOperationException("Pasta não encontrada.");

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

        // ✅ se Segurança: não pode deletar pasta/subárvore que tenha itens criados por Admin/Gestão
        if (viewerTypeUser == 3)
        {
            var anyFolderNotSt = await (from p in _db.FuncionarioPastas.AsNoTracking()
                                        join u in _db.Usuarios.AsNoTracking() on p.UsuarioCriacaoId equals u.Id
                                        where p.FuncionarioId == funcionarioId && p.Ativo && toDisable.Contains(p.Id)
                                        select u.TypeUser).AnyAsync(t => t != 3, ct);

            if (anyFolderNotSt)
                throw new UnauthorizedAccessException("Sem permissão para deletar esta pasta (contém itens fora do perfil Segurança).");

            var anyDocNotSt = await (from d in _db.FuncionarioDocumentos.AsNoTracking()
                                     join u in _db.Usuarios.AsNoTracking() on d.UsuarioCriacaoId equals u.Id
                                     where d.FuncionarioId == funcionarioId && d.Ativo && d.PastaId != null && toDisable.Contains(d.PastaId.Value)
                                     select u.TypeUser).AnyAsync(t => t != 3, ct);

            if (anyDocNotSt)
                throw new UnauthorizedAccessException("Sem permissão para deletar esta pasta (contém arquivos fora do perfil Segurança).");
        }

        var docs = await _db.FuncionarioDocumentos
            .Where(d => d.FuncionarioId == funcionarioId && d.Ativo && d.PastaId != null && toDisable.Contains(d.PastaId.Value))
            .ToListAsync(ct);

        foreach (var d in docs)
        {
            d.Ativo = false;
            d.Alteracao = now;
            d.UsuarioId = viewerUserId;
        }

        var folders = await _db.FuncionarioPastas
            .Where(p => p.FuncionarioId == funcionarioId && p.Ativo && toDisable.Contains(p.Id))
            .ToListAsync(ct);

        foreach (var p in folders)
        {
            p.Ativo = false;
            p.Alteracao = now;
            p.UsuarioId = viewerUserId;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task Move(int funcionarioId, FuncionarioDocumentosCopy dto, CancellationToken ct)
    {
        await EnsureFuncionario(funcionarioId, ct);

        var (viewerUserId, viewerTypeUser) = await GetViewerAsync(ct);

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

            // ✅ se Segurança: destino também precisa ser criado por Segurança
            if (viewerTypeUser == 3)
            {
                var destCreatorType = await (from p in _db.FuncionarioPastas.AsNoTracking()
                                             join u in _db.Usuarios.AsNoTracking() on p.UsuarioCriacaoId equals u.Id
                                             where p.Id == parsedTarget && p.FuncionarioId == funcionarioId && p.Ativo
                                             select u.TypeUser).FirstOrDefaultAsync(ct);

                if (destCreatorType != 3)
                    throw new UnauthorizedAccessException("Sem permissão para mover para esta pasta.");
            }

            targetFolderId = parsedTarget;
        }

        var now = DateTime.Now;

        if (isFolder)
        {
            if (viewerTypeUser == 3)
            {
                var creatorType = await (from p in _db.FuncionarioPastas.AsNoTracking()
                                         join u in _db.Usuarios.AsNoTracking() on p.UsuarioCriacaoId equals u.Id
                                         where p.Id == id && p.FuncionarioId == funcionarioId && p.Ativo
                                         select u.TypeUser).FirstOrDefaultAsync(ct);

                if (creatorType != 3)
                    throw new UnauthorizedAccessException("Sem permissão para mover esta pasta.");
            }

            var pasta = await _db.FuncionarioPastas
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (pasta == null) throw new InvalidOperationException("Pasta não encontrada.");

            if (targetFolderId.HasValue && targetFolderId.Value == pasta.Id)
                throw new InvalidOperationException("Não é permitido mover a pasta para dentro dela mesma.");

            pasta.PastaPaiId = targetFolderId;
            pasta.Alteracao = now;
            pasta.UsuarioId = viewerUserId;
        }
        else
        {
            if (viewerTypeUser == 3)
            {
                var creatorType = await (from d in _db.FuncionarioDocumentos.AsNoTracking()
                                         join u in _db.Usuarios.AsNoTracking() on d.UsuarioCriacaoId equals u.Id
                                         where d.Id == id && d.FuncionarioId == funcionarioId && d.Ativo
                                         select u.TypeUser).FirstOrDefaultAsync(ct);

                if (creatorType != 3)
                    throw new UnauthorizedAccessException("Sem permissão para mover este arquivo.");
            }

            var doc = await _db.FuncionarioDocumentos
                .FirstOrDefaultAsync(x => x.Id == id && x.FuncionarioId == funcionarioId && x.Ativo, ct);

            if (doc == null) throw new InvalidOperationException("Arquivo não encontrado.");

            doc.PastaId = targetFolderId;
            doc.Alteracao = now;
            doc.UsuarioId = viewerUserId;
        }

        await _db.SaveChangesAsync(ct);
    }
}