namespace Atrium.RH.Dtos.FuncionarioCursos
{
    public class FuncionarioCursoCreateDto
    {
        public int FuncionarioId { get; set; }
        public int CursoId { get; set; }

        public DateOnly DataConclusao { get; set; }
        public DateOnly? DataValidade { get; set; }
    }
}
