import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { notify } from '../../modules/core/notify.js'

export class PontoView {
  constructor () {
    const root = document.createElement('div')
    root.className = 'row'
    root.innerHTML = `
      <div class="card" style="flex:2 1 560px">
        <h2 style="margin-top:0">Cartão de Ponto</h2>
        <div class="kpis">
          <div class="kpi"><div class="label">Batidas hoje</div><div id="kpi-batidas">0</div></div>
          <div class="kpi"><div class="label">Horas</div><div id="kpi-horas">0:00</div></div>
          <div class="kpi"><div class="label">Atrasos</div><div id="kpi-atrasos">0</div></div>
          <div class="kpi"><div class="label">Extras</div><div id="kpi-extras">0</div></div>
        </div>
        <div id="map" style="height:320px;border-radius:14px;overflow:hidden;border:1px solid var(--ring)"></div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button id="btn-bater" class="btn">Bater Ponto</button>
          <button id="btn-ajustar" class="btn">Ajustar Tabela à Tela</button>
        </div>
      </div>
      <div class="card" style="flex:1 1 320px">
        <h3 style="margin-top:0">Batimentos</h3>
        <table>
          <thead><tr><th>Data</th><th>Hora</th><th>Origem</th></tr></thead>
          <tbody id="tbl-batidas"></tbody>
        </table>
      </div>
    `
    this.el = root
  }

  onMount () {
    // Mapa Leaflet simples com tentativa de geolocalização
    const map = L.map('map').setView([-15.78, -47.93], 4)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          map.setView([latitude, longitude], 16)
          L.marker([latitude, longitude]).addTo(map).bindPopup('Você está aqui')
        },
        () => notify.error('Não foi possível obter a localização')
      )
    }

    document.getElementById('btn-bater')?.addEventListener('click', () => {
      const now = new Date()
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${now.toLocaleDateString()}</td><td>${now.toLocaleTimeString()}</td><td>Web</td>`
      document.getElementById('tbl-batidas')?.prepend(tr)
      const el = document.getElementById('kpi-batidas')
      if (el) el.textContent = String((parseInt(el.textContent || '0', 10) || 0) + 1)
    })

    document.getElementById('btn-ajustar')?.addEventListener('click', () => {
      fitPontoTableToViewport()
    })
  }
}

// Função utilitária para manter compatibilidade com chamadas antigas
export function fitPontoTableToViewport () {
  // Aqui você pode implementar seu ajuste de layout mais complexo.
  // Por ora, só rola a tabela para o topo para "caber" melhor.
  document.getElementById('tbl-batidas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
