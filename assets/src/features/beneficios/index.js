import { get, set } from '../../modules/core/storage.js'

export class BeneficiosView {
  constructor () {
    const root = document.createElement('div')
    root.className = 'card'
    root.innerHTML = `
      <h2 style="margin-top:0">Benefícios (VR/VT)</h2>
      <div class="row">
        <div style="flex:1 1 200px">
          <label class="label">% Desconto VR (global)</label>
          <input id="vr-pct" type="number" min="0" max="100" step="1" value="0" />
        </div>
        <div style="flex:1 1 200px">
          <label class="label">VT Diário (R$)</label>
          <input id="vt-dia" type="number" min="0" step="0.01" value="0" />
        </div>
        <div style="align-self:flex-end">
          <button id="benef-calc" class="btn">Calcular</button>
        </div>
      </div>
      <div id="resultado" style="margin-top:12px"></div>
    `
    this.el = root
  }

  onMount () {
    document.getElementById('benef-calc')?.addEventListener('click', () => {
      const pct = Number(document.getElementById('vr-pct').value || 0)
      const vtDia = Number(document.getElementById('vt-dia').value || 0)
      const dias = 22
      const vrTotal = (40 * dias) * (1 - pct / 100) // Exemplo simples
      const vtTotal = vtDia * dias
      document.getElementById('resultado').innerHTML = `
        <div class="card" style="margin-top:8px">
          <div><strong>VR (mês):</strong> R$ ${vrTotal.toFixed(2)}</div>
          <div><strong>VT (mês):</strong> R$ ${vtTotal.toFixed(2)}</div>
        </div>
      `
    })
  }
}
