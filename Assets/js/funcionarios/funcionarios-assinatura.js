/* =========================================================
   FUNCIONÁRIOS — ASSINATURA/GIF (arquivo separado)
   Extraído do funcionarios.js para manter o código modular
   ========================================================= */
(() => {
  'use strict';

  // Base da API (usa window.API_BASE se existir; senão cai no localhost).
  const API_BASE = String(window.API_BASE || 'http://localhost:5253').replace(/\/+$/, '');

  // Notificação (usa notify do core.js se existir)
  const notify = window.notify || function (msg) { console.log(msg); };

  // (Opcional) Disponibiliza API_BASE para outros arquivos
  window.API_BASE = API_BASE;

  // ======================
  // BUSCA FUNCIONÁRIO POR ID (endpoint correto)
  // ======================
  async function apiGetFuncionarioById(id) {
    const url = `${API_BASE}/api/funcionarios/${id}/assinatura`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Erro ao buscar assinatura:", err);
      notify("Não foi possível buscar os dados do funcionário.", "error");
      return null;
    }
  }

  // ======================================================
  // GERA ASSINATURA (usa o endpoint /api/funcionarios/{id}/assinatura)
  // + POPUP com CSS + BOTÃO que BAIXA GIF (cantos arredondados)
  // ======================================================
  async function gerarAssinaturaFuncionario(id) {
    const w = window.open("", "_blank");
    if (!w) {
      notify?.("Pop-up bloqueado. Permita pop-ups para abrir a assinatura.", "warn");
      return;
    }

    w.document.open();
    w.document.write(`
      <html><head><meta charset="utf-8"><title>Carregando...</title></head>
      <body style="background:#0b1020;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family: Arial, Helvetica, sans-serif;">
        Carregando assinatura...
      </body></html>
    `);
    w.document.close();

    const escapeHTML = (s) =>
      String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    try {
      const resp = await fetch(`${API_BASE}/api/funcionarios/${id}/assinatura`);
      if (!resp.ok) throw new Error(`Erro HTTP ${resp.status}`);
      const f = await resp.json();

      const func = {
        nome: f.nome ?? f.Nome ?? "",
        funcao: f.funcao ?? f.Funcao ?? "",
        email: f.email ?? f.Email ?? "",
        celular: f.celular ?? f.Celular ?? "",
        fotoUrl: f.fotoUrl ?? f.FotoUrl ?? null,
      };

      const baseHref = new URL(".", window.location.href).href;

      const GIF_MIN_URL = new URL("gif.min.js", baseHref).href;
      const GIF_WORKER_URL = new URL("gif.worker.js", baseHref).href;

      const onlyDigits = (v) => String(v ?? "").replace(/\D+/g, "");
      const formatBRPhone = (v) => {
        const d = onlyDigits(v);
        if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
        if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return v ?? "";
      };

      // ======================================================
      // HTML da assinatura
      // ======================================================
      const signatureHTML = `
        <div class="sig-row sig6" data-sig-root>

          <div class="toolbar">
            <div class="box">
              <label>Duração (1 a 7s)</label>
              <input class="js-seconds" type="number" min="1" max="7" step="0.5" value="4.0">
            </div>

            <div class="box">
              <label>FPS (até 60)</label>
              <input class="js-fps" type="number" min="6" max="60" step="1" value="30">
            </div>

            <button type="button" class="btn-download js-btnGif">⬇ Baixar GIF</button>
            <span class="status js-status"></span>
          </div>

          <div class="signature-wrapper">
            <div class="signature-card js-sigToCapture">
              <div class="inner-content">
                <div class="logo-section">
                  <img
                    src="assets/img/logo_rcr_transparente.png"
                    alt="Logo RCR"
                    class="logo-img"
                  />
                </div>

                <div class="info-section">
                  <div>
                    <span class="name">${escapeHTML(func.nome)}</span>

                    <span class="role-wrap">
                      <span class="role-text js-roleText">${escapeHTML(func.funcao)}</span>
                    </span>
                  </div>

                  <div class="contact-grid">
                    ${
                      func.celular
                        ? `<a class="contact-item" href="tel:${escapeHTML(onlyDigits(func.celular))}">
                            <span class="ico" aria-hidden="true">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M22 16.92V21a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3 6.18 2 2 0 0 1 5 4h4.09a1 1 0 0 1 1 .75l1.21 4.2a1 1 0 0 1-.27 1l-2.2 2.2a16 16 0 0 0 6.9 6.9l2.2-2.2a1 1 0 0 1 1-.27l4.2 1.21a1 1 0 0 1 .75 1z"
                                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                            </span>
                            <span class="contact-text">${escapeHTML(formatBRPhone(func.celular))}</span>
                          </a>`
                        : ""
                    }

                    ${
                      func.email
                        ? `<a class="contact-item" href="mailto:${encodeURIComponent(func.email)}">
                            <span class="ico" aria-hidden="true">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="m22 6-10 7L2 6"
                                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                            </span>
                            <span class="contact-text">${escapeHTML(func.email)}</span>
                          </a>`
                        : ""
                    }

                    <div class="contact-item">
                      <span class="ico" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </span>
                      <span class="contact-text multiline">Av. Paulista, 1646 - Bela Vista, SP</span>
                    </div>

                    <a class="contact-item site-link" href="https://www.rcrengenharia.tech" target="_blank" rel="noreferrer">
                      <span class="ico" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
                            stroke="currentColor" stroke-width="2"/>
                          <path d="M2 12h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </span>
                      <span class="contact-text site-text">www.rcrengenharia.tech</span>
                    </a>
                  </div>
                </div>
              </div>

              <div class="loading-bar">
                <div class="loading-progress js-loadProg"></div>
              </div>
            </div>
          </div>

        </div>
      `;

      // ======================================================
      // CSS
      // ======================================================
      const SIG6_CSS = `
  :root { color-scheme: dark; }

  body{
    margin:0;
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    flex-direction:column;
    gap:16px;
    background:#0a0f1c;
    font-family: Arial, Helvetica, sans-serif;
    color:#fff;
    padding:24px;
  }

  .toolbar{
    display:flex;
    gap:10px;
    align-items:center;
    flex-wrap:wrap;
    justify-content:center;
    width:min(980px, 100%);
    margin-bottom: 28px;
  }
  .toolbar .box{
    display:flex;
    align-items:center;
    gap:8px;
    padding:10px 12px;
    border:1px solid rgba(255,255,255,.12);
    border-radius:12px;
    background: rgba(0,0,0,.25);
    backdrop-filter: blur(10px);
  }
  label{ font-size:12px; opacity:.85; }
  input[type="number"]{
    width:86px;
    padding:8px 10px;
    border-radius:10px;
    border:1px solid rgba(255,255,255,.12);
    background:#0b1622;
    color:#fff;
    outline:none;
  }
  button{
    padding:10px 14px;
    border-radius:12px;
    border:1px solid rgba(255,255,255,.18);
    background: linear-gradient(135deg, rgba(0,224,255,.18), rgba(255,47,185,.18));
    color:#fff;
    font-weight:800;
    cursor:pointer;
    transition: transform .15s ease;
  }
  button:hover{ transform: translateY(-1px); }
  button:disabled{ opacity:.6; cursor:not-allowed; transform:none; }
  .status{ font-size:12px; opacity:.8; }

  .sig6{
    --c1:#00E0FF;
    --c2:#FF2FB9;
    --radius:22px;
    --muted:#c0cfdf;
  }

  .sig6 .signature-card{
    position:relative;
    width: 650px;  
    height: 216px; 
    border-radius: var(--radius);
    overflow:hidden;
    /* Alterado de 90deg para 'to right' para maior estabilidade no renderizador */
    background: linear-gradient(to right, #000000 45%, #0e041c 75%, #1b0736 100%);
    display:flex;
    box-shadow: 0 18px 44px rgba(0,0,0,.97);
    font-family: Arial, Helvetica, sans-serif;
    isolation:isolate;
  }

  .sig6 .inner-content{
    position:relative;
    z-index:3;
    width:100%;
    height:100%;
    display:flex;
    align-items:center;
    padding: 0 30px;
    gap: 16px;
  }

  .sig6 .logo-section{
    flex:0 0 210px;
    display:flex;
    justify-content:center;
    align-items:center;
  }
  .sig6 .logo-img{
    width: 165px;
    height:auto;
    display:block;
  }

  .sig6 .info-section{
    flex:1;
    padding-left:26px;
    padding-right:12px;
    border-left:1px solid rgba(255,255,255,.14);
    min-width:0;
  }

  .sig6 .name{
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 25px;
    font-weight: bold;
    color: #ffffff;
    text-transform: uppercase;
    line-height: 1.1;
    display: inline-block;
  }

  .sig6 .role-wrap{ display:block; margin: 4px 0 16px; }
  .sig6 .role-text{
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 13.5px;
    font-weight: normal;
    color: #a79cf1; 
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .sig6 .contact-grid{
    display:grid;
    grid-template-columns: 1fr;
    gap: 7px;
  }

  .sig6 .contact-item{
    display:flex;
    align-items:flex-start;
    gap: 10px;
    text-decoration:none;
    min-width:0;
  }

  .sig6 .contact-text{
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 13.5px;
    color: #ffffff;
    line-height: 1.2;
    min-width:0;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .sig6 .contact-text.multiline{
    white-space:normal;
    overflow:visible;
  }

  .sig6 .site-text {
    color: #00e0ff !important;
    font-weight: bold;
  }

  .sig6 .ico{
    width:16px;
    height:16px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    color: var(--c1);
    flex:0 0 auto;
    margin-top:1px;
  }
  .sig6 .ico svg {
    width: 16px;
    height: 16px;
  }

  .sig6 .loading-bar{
    position:absolute;
    bottom:0; left:0;
    height:3px;
    width:100%;
    background: rgba(255,255,255,.05);
    z-index:4;
  }

  .sig6 .loading-progress{
    position:absolute;
    top:0; left:0;
    height:100%;
    width:18%;
    background: linear-gradient(to right, var(--c1), var(--c2), var(--c1));
    background-size:240% 100%;
    animation: sig6move 5s infinite ease-in-out, sig6barshine 3s linear infinite;
  }
  @keyframes sig6barshine{ to{ background-position: 240% 0; } }
  @keyframes sig6move{
    0%,100%{ width:18%; left:0%; }
    50%{ width:62%; left:38%; }
  }

  /* ✅ O SEGREDO PARA RESOLVER OS BUGS DE RENDERIZAÇÃO DO HTML2CANVAS */
  body.exporting .sig6 .loading-progress{
    animation: none !important;
  }
  body.exporting .sig6 .signature-card{
    /* Removemos a sombra e o arredondamento APENAS durante a captura da foto */
    /* Isso impede o html2canvas de "fatiar" ou bugar o gradiente de fundo */
    box-shadow: none !important;
    border-radius: 0 !important;
  }
      `;

      // ======================================================
      // Script do GIF (CORRIGIDO PARA QUALIDADE MÁXIMA E SEM BUGS)
      // ======================================================
      const popupGifScript = `
  (function(){
    // ✅ Matte branco: essencial para e-mails. Preenche os cantos arredondados com branco para não serrilhar.
    const MATTE_HEX = "#ffffff"; 
    const MAX_FRAMES = 240;

    function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
    function raf(){ return new Promise(requestAnimationFrame); }

    function ensureGifLoaded(){
      if (typeof window.GIF !== "function") throw new Error("GIF library not loaded");
      if (typeof window.html2canvas !== "function") throw new Error("html2canvas not loaded");
    }

    async function captureFrame(el, scale){
      return window.html2canvas(el, {
        backgroundColor: null, 
        scale: scale,
        useCORS: true,
        allowTaint: false,
        logging: false
      });
    }

    function setAnimState(p, loadEl){
      let k;
      if (p <= 0.5){
        k = p / 0.5;
        loadEl.style.width = (18 + 44 * k) + "%";
        loadEl.style.left  = (0 + 38 * k) + "%";
      } else {
        k = (p - 0.5) / 0.5;
        loadEl.style.width = (62 - 44 * k) + "%";
        loadEl.style.left  = (38 - 38 * k) + "%";
      }
      loadEl.style.backgroundPosition = (240 * p) + "% 0";
    }

    function roundedRectPath(ctx, x, y, w, h, r){
      r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function makeRoundedMatteCtx(sourceCanvas, radiusPx, matteHex){
      const out = document.createElement("canvas");
      out.width = sourceCanvas.width;
      out.height = sourceCanvas.height;

      const ctx = out.getContext("2d", { willReadFrequently: true });

      // 1. Pinta todo o fundo com o fundo do email (branco)
      ctx.fillStyle = matteHex;
      ctx.fillRect(0, 0, out.width, out.height);

      // 2. Cria a máscara perfeitamente arredondada
      ctx.save();
      roundedRectPath(ctx, 0, 0, out.width, out.height, radiusPx);
      ctx.clip();
      
      // 3. Cola a imagem quadrada renderizada pelo html2canvas (livre de bugs) dentro da máscara
      ctx.drawImage(sourceCanvas, 0, 0);
      ctx.restore();

      return { canvas: out, ctx };
    }

    document.addEventListener("click", async (ev) => {
      const btn = ev.target.closest(".js-btnGif");
      if (!btn) return;

      const root = btn.closest("[data-sig-root]");
      if (!root) return;

      const statusEl  = root.querySelector(".js-status");
      const secondsEl = root.querySelector(".js-seconds");
      const fpsEl     = root.querySelector(".js-fps");

      const sigEl  = root.querySelector(".js-sigToCapture");
      const loadEl = root.querySelector(".js-loadProg");

      try{
        ensureGifLoaded();
        if (document.fonts && document.fonts.ready) await document.fonts.ready;

        let seconds = parseFloat(secondsEl?.value || "4");
        let fps = parseInt(fpsEl?.value || "30", 10);
        seconds = Math.min(7, Math.max(1, seconds));
        fps = Math.min(60, Math.max(6, fps));

        // ✅ Escala 2: A escala ideal. (Escala 3 estava estourando o limite do canvas e causando a falha na tela)
        const CAPTURE_SCALE = 2;

        let totalFrames = Math.max(2, Math.round(seconds * fps));
        if (totalFrames > MAX_FRAMES){
          totalFrames = MAX_FRAMES;
          statusEl && (statusEl.textContent = "Limitei para 240 frames.");
          await sleep(400);
        }

        const delay = Math.max(10, Math.round(1000 / fps));

        btn.disabled = true;
        statusEl && (statusEl.textContent = "Preparando...");

        // Ativa modo de exportação para remover sombras/bordas que causam bugs no html2canvas
        document.body.classList.add("exporting");

        // O CSS original tem border-radius: 22px
        const cssRadius = 22;
        const radiusScaled = cssRadius * CAPTURE_SCALE;

        setAnimState(0, loadEl);
        await raf(); await raf();

        const raw0 = await captureFrame(sigEl, CAPTURE_SCALE);
        const fr0  = makeRoundedMatteCtx(raw0, radiusScaled, MATTE_HEX);

        const gif = new GIF({
          workers: Math.min(4, navigator.hardwareConcurrency || 2),
          quality: 5, // Alta qualidade, mas sem estourar o limite da biblioteca
          dither: false, // Evita granulação nas cores
          workerScript: ${JSON.stringify(GIF_WORKER_URL)},
          repeat: 0,
          width: fr0.canvas.width,
          height: fr0.canvas.height
        });

        gif.on("progress", p => {
          statusEl && (statusEl.textContent = "Renderizando... " + Math.round(p * 100) + "%");
        });

        gif.on("finished", (blob) => {
          document.body.classList.remove("exporting");
          btn.disabled = false;

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = \`Assinatura-\${fps}fps.gif\`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);

          statusEl && (statusEl.textContent = \`Pronto! \${fps}fps (\${totalFrames} frames)\`);
        });

        gif.addFrame(fr0.ctx, { delay, copy:false });
        statusEl && (statusEl.textContent = \`Capturando: 1/\${totalFrames}\`);

        for (let i=1; i<totalFrames; i++){
          const p = i / (totalFrames - 1);
          setAnimState(p, loadEl);
          await raf(); await raf();

          const raw = await captureFrame(sigEl, CAPTURE_SCALE);
          const fr  = makeRoundedMatteCtx(raw, radiusScaled, MATTE_HEX);

          gif.addFrame(fr.ctx, { delay, copy:false });

          statusEl && (statusEl.textContent = \`Capturando: \${i+1}/\${totalFrames}\`);
          if ((i % 6) === 0) await sleep(6);
        }

        statusEl && (statusEl.textContent = "Renderizando GIF...");
        gif.render();

      } catch(err){
        console.error(err);
        document.body.classList.remove("exporting");
        btn.disabled = false;
        statusEl && (statusEl.textContent = "Erro ao gerar GIF.");
      }
    });
  })();
      `;

      const fullHTML = `
  <!doctype html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <base href="${escapeHTML(baseHref)}">
    <title>${escapeHTML(`Assinatura de ${func.nome || "Colaborador"}`)}</title>
    <style>${SIG6_CSS}</style>
    <script src="${escapeHTML(GIF_MIN_URL)}"></script>
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  </head>
  <body>
    ${signatureHTML}
    <script>${popupGifScript}</script>
  </body>
  </html>
      `;

      w.document.open();
      w.document.write(fullHTML);
      w.document.close();

    } catch (err) {
      console.error(err);
      w.document.open();
      w.document.write(
        `<pre style="color:#fff;background:#111;padding:16px;">Erro ao gerar assinatura: ${escapeHTML(err.message)}</pre>`
      );
      w.document.close();
    }
  }

  window.gerarAssinaturaFuncionario = gerarAssinaturaFuncionario;
})();