using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;

using Atrium.RH.Data;            // DbContext real
using Atrium_Nexus.Dtos.Cracha;  // DTOs do crachá
using Atrium_Nexus.Enums;        // TipoContrato + ToTexto()

namespace Atrium_Nexus.Services.Cracha;

public class CrachaService : ICrachaService
{
    private readonly AtriumRhDbContext _db;

    public CrachaService(AtriumRhDbContext db) => _db = db;

    public async Task<CrachaFuncionarioDto?> GetCrachaAsync(int funcionarioId)
    {
        // Dados do funcionário
        var func = await _db.Funcionarios
            .AsNoTracking()
            .Where(f => f.Id == funcionarioId)
            .Select(f => new
            {
                f.Id,
                f.Nome,
                f.Cpf,
                f.Funcao,
                f.TipoContrato
            })
            .FirstOrDefaultAsync();

        if (func == null) return null;

        // 1) Busca "crua" (sem montar DTO aqui dentro)
        var cursosRaw = await _db.FuncionarioCursos
            .AsNoTracking()
            .Where(fc => fc.FuncionarioId == funcionarioId && fc.Ativo)
            .Join(_db.Cursos.AsNoTracking().Where(c => c.Ativo),
                fc => fc.CursoId,
                c => c.Id,
                (fc, c) => new
                {
                    c.Id,
                    c.Nome,
                    fc.DataConclusao,
                    fc.DataValidade
                })
            .OrderBy(x => x.Nome)
            .ToListAsync();

        // 2) Monta DTO em memória (aqui pode converter DateOnly <-> DateTime)
        var cursos = cursosRaw
            .Select(x => new CrachaCursoDto(
                x.Id,
                x.Nome,
                ToDateTime(x.DataConclusao),
                ToDateTimeNullable(x.DataValidade)
            ))
            .ToList();

        // tipo_contrato -> texto
        var tipoEnum = (TipoContrato)func.TipoContrato;
        var tipoTexto = Enum.IsDefined(typeof(TipoContrato), tipoEnum)
            ? tipoEnum.ToTexto()
            : "—";

        return new CrachaFuncionarioDto
        {
            Id = func.Id,
            Nome = func.Nome,
            Cpf = func.Cpf,
            Funcao = string.IsNullOrWhiteSpace(func.Funcao) ? "—" : func.Funcao!,
            TipoContrato = func.TipoContrato,
            TipoContratoTexto = tipoTexto,
            Cursos = cursos
        };
    }

    // ==========================
    // Conversores de data (DateOnly ou DateTime)
    // ==========================

    // Se DataConclusao for DateTime
    private static DateTime ToDateTime(DateTime d) => d;

    // Se DataConclusao for DateOnly
    private static DateTime ToDateTime(DateOnly d) => d.ToDateTime(TimeOnly.MinValue);

    // Se DataValidade for DateTime?
    private static DateTime? ToDateTimeNullable(DateTime? d) => d;

    // Se DataValidade for DateOnly?
    private static DateTime? ToDateTimeNullable(DateOnly? d) =>
        d.HasValue ? d.Value.ToDateTime(TimeOnly.MinValue) : null;
}
