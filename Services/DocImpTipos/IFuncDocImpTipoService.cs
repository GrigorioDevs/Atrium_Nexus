using Atrium.RH.Dtos.DocImpTipos;

namespace Atrium.RH.Services.DocImpTipos;

public interface IFuncDocImpTipoService
{
    Task<List<FuncDocImpTipoListItemDto>> ListAtivos(CancellationToken ct);
    Task<FuncDocImpTipoListItemDto> Create(string nome, int usuarioCriacaoId, CancellationToken ct);
    Task<FuncDocImpTipoListItemDto> Rename(int id, string nome, int usuarioId, CancellationToken ct);
    Task Inativar(int id, int usuarioId, CancellationToken ct);
}
