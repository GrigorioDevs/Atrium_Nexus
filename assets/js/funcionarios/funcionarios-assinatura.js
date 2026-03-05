/* =========================================================
   FUNCIONÁRIOS — ASSINATURA/GIF (arquivo separado)
   ✅ 1 clique: abre aba
   ✅ Primeiro tenta abrir a URL já existente do backend: /api/funcionarios/{id}/assinatura/url
   ✅ Se não tiver (404): gera -> upload -> (SEMPRE) busca URL oficial -> abre /storage
   ✅ Aba mostra APENAS a assinatura centralizada

   Observação importante:
   - Se NÃO existir assinatura ainda, o GET .../assinatura/url pode retornar 404.
     Isso é esperado. O script continua e gera + faz upload.

   🔥 Correção crítica:
   - Se o logo/imagens externas não tiverem CORS, o canvas fica "tainted" e o GIF NUNCA finaliza.
     Esse script detecta isso e remove o logo do frame automaticamente para o upload funcionar.
   ========================================================= */
(() => {
  "use strict";

  // ======================
  // CONFIG
  // ======================
  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  window.API_BASE = API_BASE;

  const STORAGE_ORIGIN = String(window.STORAGE_ORIGIN || new URL(API_BASE).origin).replace(/\/+$/, "");

  const SCRIPT_BASE = (() => {
    try {
      const cs = document.currentScript;
      if (cs && cs.src) return new URL(".", cs.src).href;
    } catch {}
    return new URL(".", window.location.href).href;
  })();

  // Ajuste se seu storage tiver caminho diferente
  const SIGNATURE_GIF_TEMPLATE =
    window.SIGNATURE_GIF_TEMPLATE || "/storage/assinaturas/funcionarios/{id}/{file}";

  // Pode sobrescrever via window.RCR_LOGO_URL antes de carregar este script
  const RCR_LOGO_URL =
    window.RCR_LOGO_URL ||
    "https://rcrengenharia.tech/wp-content/uploads/2025/07/RCR-Azul-Magenta-Variacao-01-1-1024x1024.png";

  const notify =
    window.notify ||
    function (msg) {
      console.log(msg);
    };

  // ======================
  // HELPERS
  // ======================
  const escapeHTML = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const escapeText = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const onlyDigits = (v) => String(v ?? "").replace(/\D+/g, "");

  const formatBRPhone = (v) => {
    const d = onlyDigits(v);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return v ?? "";
  };

  function pickUrlFromAny(data) {
    if (!data) return "";
    if (typeof data === "string") return data;

    return (
      data.gifUrl ||
      data.gifURL ||
      data.assinaturaGifUrl ||
      data.assinaturaUrl ||
      data.publicUrl ||
      data.PublicUrl ||
      data.url ||
      data.Url ||
      data.href ||
      data.Href ||
      ""
    );
  }

  function buildStorageUrlFromTemplate(id, fileName) {
    const path = SIGNATURE_GIF_TEMPLATE.replaceAll("{id}", String(id)).replaceAll(
      "{file}",
      fileName || "assinatura.gif"
    );

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return new URL(normalizedPath, STORAGE_ORIGIN).href;
  }

  // Normaliza qualquer retorno para URL ABSOLUTO (preferindo STORAGE_ORIGIN quando for /storage)
  function normalizeToStorageUrl(raw, id) {
    const s = String(raw || "").trim();
    if (!s) return "";

    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s);
        if (u.pathname.startsWith("/storage/")) {
          return new URL(u.pathname + u.search + u.hash, STORAGE_ORIGIN).href;
        }
        return u.href;
      } catch {
        return "";
      }
    }

    if (s.startsWith("/storage/")) return new URL(s, STORAGE_ORIGIN).href;
    if (s.startsWith("storage/")) return new URL("/" + s, STORAGE_ORIGIN).href;

    // se vier só o nome do gif
    if (s.toLowerCase().endsWith(".gif")) return buildStorageUrlFromTemplate(id, s);

    // se vier um path contendo .gif
    if (s.toLowerCase().includes(".gif")) {
      const file = s.split("/").pop();
      if (file) return buildStorageUrlFromTemplate(id, file);
    }

    return "";
  }

  // ======================
  // API
  // ======================

  // GET /api/funcionarios/{id}/assinatura  => dados do funcionário (nome, função, email, celular)
  async function apiGetAssinaturaDadosByFuncionarioId(id) {
    const url = `${API_BASE}/api/funcionarios/${id}/assinatura/dados`;
    const res = await fetch(url, { credentials: "include", cache: "no-store" });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) return await res.json();

    const txt = await res.text().catch(() => "");
    if (!txt) return {};
    try {
      return JSON.parse(txt);
    } catch {
      return { raw: txt };
    }
  }

  // GET /api/funcionarios/{id}/assinatura/url => url do GIF salvo (pode 404 se não existir ainda)
  async function apiGetAssinaturaUrlByFuncionarioId(id) {
    const url = `${API_BASE}/api/funcionarios/${id}/assinatura/url`;

    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "text/plain, application/json" },
    });

    if (res.status === 404) return null;

    const body = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`Erro HTTP ${res.status} ao buscar URL: ${body}`);

    const raw = (body || "").trim();
    if (!raw) return null;

    // Pode vir JSON { url: "..."} OU text/plain com a url
    if (raw.startsWith("{")) {
      try {
        const data = JSON.parse(raw);
        return (
          (data.url || data.Url || data.publicUrl || data.PublicUrl || data.gifUrl || data.assinaturaGifUrl || "")
            .toString()
            .trim() || null
        );
      } catch {
        return raw || null;
      }
    }

    return raw || null;
  }

  // ======================
  // MAIN
  // ======================
  async function gerarAssinaturaFuncionario(id) {
    const w = window.open("", "_blank");
    if (!w) {
      notify("Pop-up bloqueado. Permita pop-ups para abrir a assinatura.", "warn");
      return;
    }

    // placeholder
    try {
      w.document.open();
      w.document.write(
        `<!doctype html><meta charset="utf-8"><title>Assinatura</title>` +
          `<body style="margin:0;background:#0a0f1c;color:#fff;font-family:Arial;padding:16px">` +
          `Carregando assinatura...` +
          `</body>`
      );
      w.document.close();
    } catch {}

    // Resolve scripts na mesma pasta/origem do front
    const PAGE_BASE = new URL(".", window.location.href).href;
    const GIF_MIN_URL = new URL("gif.min.js", SCRIPT_BASE).href;
    const GIF_WORKER_URL = new URL("gif.worker.js", SCRIPT_BASE).href;

    const UPLOAD_ENDPOINT = `${API_BASE}/api/funcionarios/${id}/assinatura/upload`;

    try {
      // 1) ✅ tenta URL existente
      const u = await apiGetAssinaturaUrlByFuncionarioId(id);
      const existing = normalizeToStorageUrl(pickUrlFromAny(u), id);
      if (existing) {
        w.location.replace(existing);
        return;
      }

      // 2) dados do funcionário
      const f = await apiGetAssinaturaDadosByFuncionarioId(id);
      if (!f) {
        w.document.open();
        w.document.write(
          `<pre style="margin:0;padding:16px;color:#fff;background:#111;white-space:pre-wrap">` +
            escapeText("Funcionário não encontrado (404).") +
            `</pre>`
        );
        w.document.close();
        return;
      }

      const func = {
        nome: f.nome ?? f.Nome ?? "",
        funcao: f.funcao ?? f.Funcao ?? "",
        email: f.email ?? f.Email ?? "",
        celular: f.celular ?? f.Celular ?? "",
      };

      const signatureHTML = `
        <div class="sig-row sig6" data-sig-root>
          <div class="signature-wrapper">
            <div class="signature-card js-sigToCapture">
              <div class="inner-content">
                <div class="logo-section">
                  <img
                    src="../../assets/img/logo_rcr_transparente.png"
                    crossorigin="anonymous"
                    referrerpolicy="no-referrer"
                    alt="Logo RCR"
                    class="logo-img js-logoToCheck"
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

              <span class="js-status" style="display:none"></span>
              <input class="js-seconds" type="hidden" value="4.0">
              <input class="js-fps" type="hidden" value="30">
            </div>
          </div>
        </div>
      `;

      const SIG6_CSS = `
:root { color-scheme: dark; }
html, body{ margin:0; width:100%; height:100%; }
body{
  background:#0a0f1c;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
  font-family: Arial, Helvetica, sans-serif;
}
.sig6{
  --c1:#00E0FF;
  --c2:#FF2FB9;
  --radius:22px;
}
.signature-wrapper{ display:flex; align-items:center; justify-content:center; }
.sig6 .signature-card{
  position:relative;
  width: 650px;
  height: 216px;
  border-radius: var(--radius);
  overflow:hidden;
  background: linear-gradient(to right, #000000 45%, #0e041c 75%, #1b0736 100%);
  display:flex;
  box-shadow: 0 18px 44px rgba(0,0,0,.97);
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
  font-size: 25px;
  font-weight: bold;
  color: #ffffff;
  text-transform: uppercase;
  line-height: 1.1;
  display: inline-block;
}
.sig6 .role-wrap{ display:block; margin: 4px 0 16px; }
.sig6 .role-text{
  font-size: 13.5px;
  font-weight: normal;
  color: #a79cf1;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.sig6 .contact-grid{ display:grid; grid-template-columns: 1fr; gap: 7px; }
.sig6 .contact-item{
  display:flex;
  align-items:flex-start;
  gap: 10px;
  text-decoration:none;
  min-width:0;
}
.sig6 .contact-text{
  font-size: 13.5px;
  color: #ffffff;
  line-height: 1.2;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.sig6 .contact-text.multiline{ white-space:normal; overflow:visible; }
.sig6 .site-text { color: #00e0ff !important; font-weight: bold; }
.sig6 .ico{
  width:16px; height:16px;
  display:inline-flex; align-items:center; justify-content:center;
  color: var(--c1);
  flex:0 0 auto;
  margin-top:1px;
}
.sig6 .ico svg { width: 16px; height: 16px; }
.sig6 .loading-bar{
  position:absolute;
  bottom:0; left:0;
  height:3px; width:100%;
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
body.exporting .sig6 .loading-progress{ animation: none !important; }
      `;

      // Script injetado na nova aba (gera GIF e faz upload)
      const popupGifScript = `
(function(){
  const API_BASE = ${JSON.stringify(API_BASE)};
  const UPLOAD_URL = ${JSON.stringify(UPLOAD_ENDPOINT)};
  const WORKER_URL = ${JSON.stringify(GIF_WORKER_URL)};
  const EMP_ID = ${JSON.stringify(String(id))};

  const STORAGE_ORIGIN = ${JSON.stringify(STORAGE_ORIGIN)};
  const TEMPLATE = ${JSON.stringify(SIGNATURE_GIF_TEMPLATE)};
  const MAX_FRAMES = 240;

  function escText(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function showErr(msg){
    try{
      document.body.classList.remove("exporting");
      document.body.innerHTML =
        '<pre style="margin:0;padding:16px;color:#fff;background:#111;white-space:pre-wrap">' +
        escText(msg) +
        '</pre>';
    }catch{}
  }

  function log(msg){
    try { console.log("[ASSINATURA]", msg); } catch {}
  }

  function raf(){ return new Promise(requestAnimationFrame); }

  function buildByTemplate(id, fileName){
    let path = TEMPLATE.replaceAll("{id}", String(id)).replaceAll("{file}", fileName || "assinatura.gif");
    if (!path.startsWith("/")) path = "/" + path;
    return new URL(path, STORAGE_ORIGIN).href;
  }

  function normalizeToStorageUrl(raw, id){
    const s = String(raw || "").trim();
    if (!s) return "";

    if (/^https?:\\/\\//i.test(s)){
      try{
        const u = new URL(s);
        if (u.pathname.startsWith("/storage/")){
          return new URL(u.pathname + u.search + u.hash, STORAGE_ORIGIN).href;
        }
        return u.href;
      }catch{ return ""; }
    }

    if (s.startsWith("/storage/")) return new URL(s, STORAGE_ORIGIN).href;
    if (s.startsWith("storage/"))  return new URL("/" + s, STORAGE_ORIGIN).href;

    if (s.toLowerCase().endsWith(".gif")) return buildByTemplate(id, s);

    if (s.toLowerCase().includes(".gif")){
      const file = s.split("/").pop();
      if (file) return buildByTemplate(id, file);
    }

    return "";
  }

  function ensureLibs(){
    if (typeof window.GIF !== "function") throw new Error("GIF library not loaded (gif.min.js)");
    if (typeof window.html2canvas !== "function") throw new Error("html2canvas not loaded");
  }

  async function captureFrame(el, scale){
    return window.html2canvas(el, {
      backgroundColor: null,
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false
    });
  }

  // ✅ Detecta CORS do logo: se falhar, remove o logo antes de capturar
  async function ensureLogoNotTainting(){
    const img = document.querySelector(".js-logoToCheck");
    if (!img) return;

    for (let i=0; i<40; i++){
      if (img.complete) break;
      await new Promise(r => setTimeout(r, 50));
    }

    if (!img.complete || !img.naturalWidth){
      log("Logo não carregou. Removendo do frame para não travar a geração.");
      img.remove();
      return;
    }

    try{
      const c = document.createElement("canvas");
      c.width = 2; c.height = 2;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, 2, 2);
      ctx.getImageData(0, 0, 1, 1);
      log("Logo OK (sem taint).");
    }catch(e){
      log("Logo sem CORS (taint). Removendo do frame para permitir GIF/upload.");
      img.remove();
    }
  }

  function setAnimState(p, loadEl){
    if (!loadEl) return;
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

  function makeRoundedMatteCtx(sourceCanvas, radiusPx){
    const out = document.createElement("canvas");
    out.width = sourceCanvas.width;
    out.height = sourceCanvas.height;

    const ctx = out.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);

    ctx.save();
    roundedRectPath(ctx, 0, 0, out.width, out.height, radiusPx);
    ctx.clip();
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    return { canvas: out, ctx };
  }

  // Upload retorna sempre { url, storageKey } (mesmo se backend responder texto)
  async function uploadGifBlob(blob){
    const fd = new FormData();
    fd.append("file", blob, "assinatura.gif");

    const res = await fetch(UPLOAD_URL, {
      method: "POST",
      body: fd,
      credentials: "include",
      cache: "no-store",
      headers: { "Accept": "application/json, text/plain" }
    });

    const rawText = await res.text().catch(() => "");
    if (!res.ok) throw new Error("Falha no upload (" + res.status + "): " + rawText);

    const raw = (rawText || "").trim();
    if (raw.startsWith("{")) {
      try{
        const data = JSON.parse(raw);
        return {
          url: (data.url || data.Url || data.publicUrl || data.PublicUrl || "").toString().trim(),
          storageKey: (data.storageKey || data.StorageKey || "").toString().trim()
        };
      }catch{}
    }

    return { url: raw, storageKey: "" };
  }

  // SEMPRE pega a URL oficial após upload (é a mais correta)
  async function getOfficialUrl(){
    const res = await fetch(API_BASE + "/api/funcionarios/" + EMP_ID + "/assinatura/url", {
      credentials: "include",
      cache: "no-store",
      headers: { "Accept": "text/plain, application/json" }
    });

    if (res.status === 404) return "";

    const body = (await res.text().catch(() => "")).trim();
    if (!res.ok) return "";

    let raw = body;
    if (raw.startsWith("{")) {
      try{
        const data = JSON.parse(raw);
        raw = (data.url || data.Url || data.publicUrl || data.PublicUrl || "").toString().trim();
      }catch{}
    }

    return normalizeToStorageUrl(raw, EMP_ID);
  }

  async function waitUntilAvailable(u){
    if (!u) return false;
    for (let i=0; i<10; i++){
      try{
        const r = await fetch(u, { method: "HEAD", cache: "no-store" });
        if (r.ok) return true;
      }catch{}
      await new Promise(r => setTimeout(r, 250));
    }
    return false;
  }

  let running = false;

  async function run(){
    if (running) return;
    running = true;

    try{
      const root  = document.querySelector("[data-sig-root]");
      const sigEl = root && root.querySelector(".js-sigToCapture");
      const loadEl= root && root.querySelector(".js-loadProg");
      const secondsEl = root && root.querySelector(".js-seconds");
      const fpsEl     = root && root.querySelector(".js-fps");

      if (!root || !sigEl) throw new Error("Assinatura não encontrada no DOM");

      ensureLibs();
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      await ensureLogoNotTainting();

      let seconds = parseFloat((secondsEl && secondsEl.value) || "4");
      let fps = parseInt((fpsEl && fpsEl.value) || "30", 10);
      seconds = Math.min(7, Math.max(1, seconds));
      fps = Math.min(60, Math.max(6, fps));

      const CAPTURE_SCALE = 2;

      let totalFrames = Math.max(2, Math.round(seconds * fps));
      if (totalFrames > MAX_FRAMES) totalFrames = MAX_FRAMES;

      const delay = Math.max(10, Math.round(1000 / fps));

      document.body.classList.add("exporting");

      const cssRadius = 22;
      const radiusScaled = cssRadius * CAPTURE_SCALE;

      setAnimState(0, loadEl);
      await raf(); await raf();

      const raw0 = await captureFrame(sigEl, CAPTURE_SCALE);
      const fr0  = makeRoundedMatteCtx(raw0, radiusScaled);

      const gif = new GIF({
        workers: Math.min(4, navigator.hardwareConcurrency || 2),
        quality: 5,
        dither: false,
        workerScript: WORKER_URL,
        repeat: 0,
        width: fr0.canvas.width,
        height: fr0.canvas.height
      });

      gif.on("finished", async (blob) => {
        try{
          document.body.classList.remove("exporting");

          // 1) upload
          const up = await uploadGifBlob(blob);

          // 2) SEMPRE tenta pegar URL OFICIAL após upload
          let url = await getOfficialUrl();

          // 3) fallback (caso o /url ainda demore)
          if (!url) url = normalizeToStorageUrl(up.url, EMP_ID);

          // 4) último fallback: template (evita ficar sem nada)
          if (!url) url = buildByTemplate(EMP_ID, "assinatura.gif");

          await waitUntilAvailable(url);

          try { await navigator.clipboard.writeText(url); } catch {}

          window.location.replace(url);

        }catch(e){
          running = false;
          const msg = (e && (e.message || String(e))) || "Erro desconhecido";
          showErr(
            "Erro ao gerar/upload da assinatura:\\n" +
            msg +
            "\\n\\nDica: abra o DevTools (F12) nesta aba e veja Network (POST /assinatura/upload e GET /assinatura/url)."
          );
        }
      });

      gif.addFrame(fr0.ctx, { delay, copy:false });

      for (let i=1; i<totalFrames; i++){
        const p = i / (totalFrames - 1);
        setAnimState(p, loadEl);
        await raf(); await raf();

        const raw = await captureFrame(sigEl, CAPTURE_SCALE);
        const fr  = makeRoundedMatteCtx(raw, radiusScaled);
        gif.addFrame(fr.ctx, { delay, copy:false });
      }

      gif.render();

    }catch(e){
      running = false;
      const msg = (e && (e.message || String(e))) || "Erro desconhecido";
      showErr(msg);
    }
  }

  window.addEventListener("load", () => setTimeout(run, 60));
})();
      `;

      const fullHTML = `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <base href="${escapeHTML(PAGE_BASE)}">
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
      try {
        const msg = err?.message || String(err);
        w.document.open();
        w.document.write(
          `<pre style="margin:0;padding:16px;color:#fff;background:#111;white-space:pre-wrap">` +
            escapeText("Erro: " + msg) +
            `</pre>`
        );
        w.document.close();
      } catch {}
    }
  }

  // Exposto globalmente
  window.gerarAssinaturaFuncionario = gerarAssinaturaFuncionario;
})();