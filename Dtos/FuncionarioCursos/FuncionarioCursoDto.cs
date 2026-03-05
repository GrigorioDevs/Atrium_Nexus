namespace Atrium.RH.Dtos.FuncionarioCursos
{
    public class FuncionarioCursoDto
    {
        public int Id { get; set; }
        public int FuncionarioId { get; set; }
        public int CursoId { get; set; }

        public DateOnly DataConclusao { get; set; }
        public DateOnly? DataValidade { get; set; }

        public string CursoNome { get; set; } = "";
        public string CursoCategoria { get; set; } = ""; // string pro front
    }
}
