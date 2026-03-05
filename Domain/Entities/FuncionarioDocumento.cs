namespace Atrium.RH.Domain.Entities;

public class FuncionarioDocumento
{
    public int Id { get; set; }
    public int FuncionarioId { get; set; }
    public int? PastaId { get; set; }

    public bool Ativo { get; set; } = true;
    public DateTime Criacao { get; set; }
    public DateTime? Alteracao { get; set; }
    public DateTime? DataSincronizacao { get; set; }
    public DateTime? DataInterface { get; set; }
    public int UsuarioCriacaoId { get; set; }
    public int? UsuarioId { get; set; }

    public bool DocumentoImportante { get; set; } = false;

    public string Nome { get; set; } = "";
    public string? Tipo { get; set; }
    public DateOnly? DataEmissao { get; set; }
    public DateOnly? DataValidade { get; set; }

    public string StorageKey { get; set; } = "";
    public string? ArquivoNomeOriginal { get; set; }
    public string? MimeType { get; set; }
    public long TamanhoBytes { get; set; }
}
