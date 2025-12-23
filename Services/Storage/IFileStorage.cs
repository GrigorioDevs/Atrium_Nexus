namespace Atrium.RH.Services.Storage;

public interface IFileStorage
{
    Task<string> SaveAsync(
        Stream content,
        string originalFileName,
        string contentType,
        int funcionarioId,
        CancellationToken ct);

    Task<(Stream Stream, string ContentType, string FileName)> OpenAsync(
        string storageKey,
        string contentType,
        string fileName,
        CancellationToken ct);

    Task DeleteAsync(string storageKey, CancellationToken ct);
}
