namespace Atrium.RH.Dtos.Cursos
{
    public class CursoDto
    {
        public int Id { get; set; }
        public bool Ativo { get; set; }
        public DateTime Criacao { get; set; }

        public string Nome { get; set; } = "";
        public int? CargaHoraria { get; set; }

        public string Categoria { get; set; } = ""; // devolve como string pro front

        public string? Observacao { get; set; }
        public string? Descricao { get; set; }
    }
}
