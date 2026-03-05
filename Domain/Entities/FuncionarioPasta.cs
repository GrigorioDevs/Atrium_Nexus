namespace Atrium.RH.Domain.Entities;

public class FuncionarioPasta
{
    public int Id { get; set; }
    public int FuncionarioId { get; set; }
    public int? PastaPaiId { get; set; }

    public bool Ativo { get; set; } = true;
    public DateTime Criacao { get; set; }
    public DateTime? Alteracao { get; set; }

    public DateTime? DataSincronizacao { get; set; }
    public DateTime? DataInterface { get; set; }

    public int UsuarioCriacaoId { get; set; }
    public int? UsuarioId { get; set; }

    public string Nome { get; set; } = null!;

    // ✅ Navigation Properties (para o EF)
    public Funcionario? Funcionario { get; set; }
    public FuncionarioPasta? PastaPai { get; set; }
}
