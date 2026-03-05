using Atrium_Nexus.Dtos.Cracha;

namespace Atrium_Nexus.Services.Cracha;

public interface ICrachaService
{
    Task<CrachaFuncionarioDto?> GetCrachaAsync(int funcionarioId);
}
