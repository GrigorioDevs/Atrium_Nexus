using Atrium.RH.Dtos;
using Microsoft.AspNetCore.Http;

namespace Atrium.RH.Services.Abstractions;

public interface IFuncionarioAssinaturaGifService
{
    Task<FuncionarioAssinaturaDadosDto?> GetDadosAsync(int funcionarioId, CancellationToken ct);
    Task<AssinaturaUploadResponseDto> UploadAsync(int funcionarioId, IFormFile file, HttpRequest request, CancellationToken ct);
    Task<string?> GetUrlAsync(int funcionarioId, CancellationToken ct);
}