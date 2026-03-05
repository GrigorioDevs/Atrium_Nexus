import { jsPDF } from 'jspdf'
import { notify } from '../../modules/core/notify.js'

export class DocumentosView {
  constructor () {
    const root = document.createElement('div')
    root.className = 'row'
    root.innerHTML = `
      <div class="card" style="flex:2 1 560px">
        <h2 style="margin-top:0">Documentos &amp; Assinaturas</h2>
        <p>Este é um esqueleto modular. Aqui você pode implementar seu wizard de templates e uso de PDF.js para leitura.</p>
        <div style="display:flex;gap:8px">
          <button id="btn-gerar" class="btn">Gerar PDF de Teste</button>
          <input id="file-pdf" type="file" accept="application/pdf" />
        </div>
        <canvas id="pdf-preview" style="margin-top:12px;max-width:100%;border:1px solid var(--ring);border-radius:12px;"></canvas>
      </div>
      <div class="card" style="flex:1 1 320px">
        <h3 style="margin-top:0">Templates</h3>
        <ul id="tpl-list" style="padding-left:18px;margin:0">
          <li>Declaração Simples</li>
          <li>Contrato Padrão</li>
        </ul>
      </div>
    `
    this.el = root
  }

  async onMount () {
    document.getElementById('btn-gerar')?.addEventListener('click', () => {
      const doc = new jsPDF()
      doc.text('RCR Engenharia — RH', 20, 20)
      doc.text('PDF gerado com jsPDF (exemplo).', 20, 32)
      doc.save('rcr-exemplo.pdf')
      notify.info('PDF baixado (exemplo).')
    })

    // Renderização simples de 1ª página com pdfjs-dist
    const input = document.getElementById('file-pdf')
    input?.addEventListener('change', async (ev) => {
      const file = ev.target.files?.[0]
      if (!file) return

      const { getDocument } = await import('pdfjs-dist')
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs')
      const data = new Uint8Array(await file.arrayBuffer())

      const loadingTask = getDocument({ data, worker: pdfjsWorker.default })
      const pdf = await loadingTask.promise
      const page = await pdf.getPage(1)
      const scale = 1.2
      const viewport = page.getViewport({ scale })
      const canvas = document.getElementById('pdf-preview')
      const ctx = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      await page.render({ canvasContext: ctx, viewport }).promise
    })
  }
}
