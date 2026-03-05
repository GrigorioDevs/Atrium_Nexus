namespace Atrium.RH.Dtos.Cursos
{
    public class CursoCreateUpdateDto
    {
        public string Nome { get; set; } = "";
        public int? CargaHoraria { get; set; }

        // front manda "TECNICO", "SEGURANCA"...
        public string Categoria { get; set; } = "";

        public string? Observacao { get; set; }
        public string? Descricao { get; set; }
    }
}
