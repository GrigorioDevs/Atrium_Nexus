using Atrium.RH.Data;
using Atrium.RH.Domain.Entities;
using Atrium.RH.Dtos.Ponto;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace Atrium.RH.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PontoController : ControllerBase
    {
        private readonly AtriumRhDbContext _db;

        public PontoController(AtriumRhDbContext db)
        {
            _db = db;
        }

        // GET: /api/Ponto/cartao?usuarioId=1&inicio=2025-12-01&fim=2025-12-15
        [HttpGet("cartao")]
        public async Task<IActionResult> GetCartao([FromQuery] int usuarioId, [FromQuery] string inicio, [FromQuery] string fim)
        {
            if (usuarioId <= 0) return BadRequest("usuarioId inválido.");

            if (!DateTime.TryParseExact(inicio, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dtIni))
                return BadRequest("inicio inválido. Use yyyy-MM-dd");

            if (!DateTime.TryParseExact(fim, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dtFim))
                return BadRequest("fim inválido. Use yyyy-MM-dd");

            var data = await _db.CartaoPonto
                .Where(x => x.UsuarioId == usuarioId && x.DataLocal >= dtIni.Date && x.DataLocal <= dtFim.Date)
                .ToListAsync();

            return Ok(data);
        }

        // POST: /api/Ponto/registrar
        [HttpPost("registrar")]
        public async Task<IActionResult> Registrar([FromBody] RegistrarPontoDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (!DateTime.TryParseExact(dto.DataLocal, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dataLocal))
                return BadRequest("DataLocal inválida. Use yyyy-MM-dd");

            if (!TimeSpan.TryParseExact(dto.Hora, "hh\\:mm", CultureInfo.InvariantCulture, out var hora))
                return BadRequest("Hora inválida. Use HH:mm");

            // monta o DateTime do registro (Criacao)
            var criacao = dataLocal.Date.Add(hora);

            var reg = new PontoRegistro
            {
                UsuarioId = dto.UsuarioId,
                Criacao = criacao,              // no seu banco é datetime2(0)
                DataLocal = dataLocal.Date,     // date
                Tipo = dto.Tipo,
                Origem = dto.Origem,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Observacao = dto.Observacao,
                Ip = HttpContext.Connection.RemoteIpAddress?.ToString(),
                DeviceInfo = Request.Headers.UserAgent.ToString(),
                // CriadoPorId = ??? (se depois você tiver auth/gestor)
            };

            _db.PontoRegistros.Add(reg);
            await _db.SaveChangesAsync();

            return Ok(new { id = reg.Id, mensagem = "Ponto registrado com sucesso." });
        }
    }
}
