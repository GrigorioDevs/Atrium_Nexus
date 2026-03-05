import SignaturePad from 'signature_pad'
import { notify } from '../../modules/core/notify.js'

export class AssinaturaPublicaView {
  constructor () {
    const root = document.createElement('div')
    root.className = 'card'
    root.innerHTML = `
      <h2 style="margin-top:0">Assinatura Pública</h2>
      <canvas id="sigPadPublic" style="width:100%;max-width:640px;height:240px;border:1px dashed var(--ring);border-radius:12px;background:#fff"></canvas>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button id="sig-clear" class="btn">Limpar</button>
        <button id="sig-save" class="btn">Salvar</button>
      </div>
      <div id="sig-result" style="margin-top:12px"></div>
    `
    this.el = root
    this._sig = null
  }

  onMount () {
    const canvas = document.getElementById('sigPadPublic')
    // Ajusta pixel ratio para nitidez
    function resizeCanvas () {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.clientWidth * ratio
      canvas.height = 240 * ratio
      const ctx = canvas.getContext('2d')
      ctx.scale(ratio, ratio)
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    this._sig = new SignaturePad(canvas, { backgroundColor: 'rgba(255,255,255,1)' })

    document.getElementById('sig-clear')?.addEventListener('click', () => this._sig.clear())
    document.getElementById('sig-save')?.addEventListener('click', () => {
      if (this._sig.isEmpty()) return notify.error('Faça uma assinatura primeiro.')
      const dataUrl = this._sig.toDataURL('image/png')
      const img = new Image()
      img.src = dataUrl
      img.style.maxWidth = '320px'
      img.style.display = 'block'
      document.getElementById('sig-result').innerHTML = ''
      document.getElementById('sig-result').appendChild(img)
    })
  }
}
