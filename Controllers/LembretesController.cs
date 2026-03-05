using Atrium.RH.Data; // ✅ IMPORTANTE (seu DbContext está aqui)
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Atrium.RH.Controllers
{
    [ApiController]
    [Route("api/lembretes")]
    public class LembretesController : ControllerBase
    {
        private readonly AtriumRhDbContext _db; // ✅ está certo

        public LembretesController(AtriumRhDbContext db) // ✅ está certo
        {
            _db = db;
        }

        // GET: /api/lembretes/docs-importantes
        // Regra:
        // - documento_importante = 1
        // - ativo = 1
        // - data_validade = hoje OU amanhã
        [HttpGet("docs-importantes")]
        public async Task<IActionResult> GetDocsImportantesHojeEAmanha()
        {
            var hoje = DateOnly.FromDateTime(DateTime.Today);
            var amanha = hoje.AddDays(1);

            var raw = await (
                from fd in _db.FuncionarioDocumentos.AsNoTracking()
                join f in _db.Funcionarios.AsNoTracking()
                    on fd.FuncionarioId equals f.Id
                where fd.DocumentoImportante
                      && fd.Ativo
                      && fd.DataValidade != null
                      && (fd.DataValidade.Value == hoje || fd.DataValidade.Value == amanha)
                orderby fd.DataValidade, f.Nome
                select new
                {
                    documentoId = fd.Id,
                    funcionarioId = f.Id,
                    funcionarioNome = f.Nome,
                    documentoNome = fd.Nome,
                    tipo = fd.Tipo,
                    dataEmissao = fd.DataEmissao,
                    dataValidade = fd.DataValidade,
                    ativo = fd.Ativo
                }
            ).ToListAsync();

            // Converte DateOnly -> string yyyy-MM-dd (pro JS comparar perfeito)
            var list = raw.Select(x => new
            {
                x.documentoId,
                x.funcionarioId,
                x.funcionarioNome,
                x.documentoNome,
                x.tipo,
                dataEmissao = x.dataEmissao.HasValue ? x.dataEmissao.Value.ToString("yyyy-MM-dd") : null,
                dataValidade = x.dataValidade.HasValue ? x.dataValidade.Value.ToString("yyyy-MM-dd") : null,
                x.ativo
            });

            return Ok(list);
        }
    }
}
