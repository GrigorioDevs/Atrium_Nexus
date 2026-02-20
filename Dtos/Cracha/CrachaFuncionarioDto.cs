namespace Atrium_Nexus.Dtos.Cracha;

public class CrachaFuncionarioDto
{
    public int Id { get; init; }
    public string Nome { get; init; } = "";
    public string Cpf { get; init; } = "";
    public string Funcao { get; init; } = "—";

    public byte TipoContrato { get; init; }
    public string TipoContratoTexto { get; init; } = "—";

    public List<CrachaCursoDto> Cursos { get; init; } = new();
}
