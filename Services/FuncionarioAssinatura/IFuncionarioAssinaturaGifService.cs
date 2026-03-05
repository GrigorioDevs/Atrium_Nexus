using Atrium.RH.Dtos;
using Microsoft.AspNetCore.Http;

namespace Atrium.RH.Services.FuncionarioAssinatura;

public interface IFuncionarioAssinaturaGifService
{
    Task<FuncionarioAssinaturaDadosDto?> GetDadosAsync(int funcionarioId, CancellationToken ct);
    Task<AssinaturaUploadResponseDto> UploadAsync(int funcionarioId, IFormFile file, CancellationToken ct);
    Task<string?> GetUrlAtivaAsync(int funcionarioId, CancellationToken ct);
}