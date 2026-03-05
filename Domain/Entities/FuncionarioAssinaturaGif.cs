namespace Atrium.RH.Domain.Entities;

public sealed class FuncionarioAssinaturaGif
{
    public int Id { get; set; }
    public int FuncionarioId { get; set; }
    public string StorageKey { get; set; } = default!;
    public string PublicUrl { get; set; } = default!;
    public bool Ativa { get; set; } = true;
    public DateTime CriadoEm { get; set; }
}