namespace Atrium.RH.Domain.Entities;

public class FuncDocImpTipo
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";

    public bool Ativo { get; set; }

    public DateTime Criacao { get; set; }
    public DateTime? Alteracao { get; set; }
    public DateTime? DataSincronizacao { get; set; }
    public DateTime? DataInterface { get; set; }

    public int UsuarioCriacaoId { get; set; }
    public int? UsuarioId { get; set; }
}
