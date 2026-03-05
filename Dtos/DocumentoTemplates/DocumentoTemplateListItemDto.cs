namespace Atrium.RH.Dtos.DocumentoTemplates;

public class DocumentoTemplateListItemDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = "";

    // auditoria
    public DateTime DataCriacao { get; set; }
    public int UsuarioCriacaoId { get; set; }

    public DateTime Alteracao { get; set; }
    public int UsuarioId { get; set; } // último editor
}