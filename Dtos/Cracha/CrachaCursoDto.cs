namespace Atrium_Nexus.Dtos.Cracha;

public record CrachaCursoDto(
    int Id,
    string Nome,
    DateTime DataConclusao,
    DateTime? DataValidade
);
