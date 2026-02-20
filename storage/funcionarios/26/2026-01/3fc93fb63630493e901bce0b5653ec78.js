/* ===================== FUNCIONÁRIOS (SEM LOCALSTORAGE / TUDO VIA API) ===================== */
(() => {
  'use strict';


  /* ===================== MAPA RÁPIDO =====================
   * Fluxo principal:
   *   boot() -> syncFuncionariosFromAPI() -> renderFuncionarios()
   *   clique no card -> openFuncionario() / closeFuncionario()
   *
   * Assinatura/GIF:
   *   gerarAssinaturaFuncionario(id) abre popup e usa:
   *     setAnimState() + captureFrame() + gif.js para renderizar frames
   *     makeRoundedMatteCtx() recorta cantos arredondados no resultado
   *
   * Explorer/Docs:
   *   apiImpDocs* / renderImpDocsTable()
   *   apiExplorer* / feRefresh() / feRenderTree() / feRenderList()
   * ================================================ */

  /* ===================== CONFIG ===================== */
  const API_BASE = (window.API_BASE || 'http://localhost:5253').replace(/\/+$/, '');

  /* ===================== STATE (MEMÓRIA) ===================== */
  const STATE = {
    viewerRole: 2, // 1=Admin | 2=Gestão/RH | 3=Segurança do Trabalho
    funcionarios: [],
    currentEmpId: null,

    // docs importantes e explorer devem vir do back:
    impDocs: [],          // docs do funcionário atual
    explorerItems: [],    // items do funcionário atual
    feCurrentFolderId: null,
    feSelection: null,
    feCopyBuffer: null,
  };

  /* ===================== HELPERS ===================== */
  const $ = (id) => document.getElementById(id);

  const escapeHTML = (s) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const notify =
    window.notify && typeof window.notify === 'function'
      ? window.notify
      : (msg, type) => {
          try { console[type === 'error' ? 'error' : 'log'](msg); } catch {}
          alert(msg);
        };

  const two = (n) => String(n).padStart(2, '0');
  const bytesHuman = (bytes) => {
    const b = Number(bytes || 0);
    if (!b) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0, v = b;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };
  const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');

  /**
   * Retorna um DataURL (imagem base64) mínimo para usar como avatar placeholder quando não há foto.
   */
  function defaultAvatarDataURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/awq8z8AAAAASUVORK5CYII=';
  }

  /**
   * Chama com segurança uma função global (window[fnName]) se ela existir, sem quebrar o fluxo em caso de erro.
   */
  function safeCall(fnName) {
    try {
      const fn = window[fnName];
      if (typeof fn === 'function') fn();
    } catch {}
  }

  /* ===================== REGRAS DE VISIBILIDADE (ownerRole) ===================== */
  /**
   * Regra de visibilidade: decide se o usuário (viewerRole) pode ver um item/registro de um determinado ownerRole.
   */
  function canSeeOwnerRole(ownerRole, viewerRole) {
    const o = Number(ownerRole || 0);
    const v = Number(viewerRole || 0);

    if (v === 1) return true;            // Admin vê tudo
    if (v === 2) return o === 2 || o === 3; // Gestão vê Gestão + Segurança
    if (v === 3) return o === 3;         // Segurança vê só Segurança
    return true;
  }

  /* ===================== API CORE ===================== */
  /**
   * Wrapper de fetch padronizado: monta URL com API_BASE, aplica headers, tenta parsear JSON e lança erro amigável quando a resposta não é OK.
   */
  async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = { ...(options.headers || {}) };

    const res = await fetch(url, {
      mode: 'cors',
      // se você usa cookie/sessão, descomente:
      // credentials: 'include',
      ...options,
      headers,
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

    if (!res.ok) {
      const msg = (data && data.message) || (typeof data === 'string' && data) || `Erro na API (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.url = url;
      throw err;
    }
    return data;
  }

  /**
   * Tenta várias funções de requisição (fallback de endpoints). Retorna a primeira que der certo; se todas falharem, lança o último erro.
   */
  async function apiTryMany(requests) {
    let lastErr = null;
    for (const fn of requests) {
      try { return await fn(); }
      catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('Falha na API');
  }

  /* ===================== AUTH / ROLE (SEM LOCALSTORAGE) ===================== */
  /**
   * Obtém o perfil (role) do usuário logado consultando endpoints comuns (/auth/me etc.) e aplica fallback via window.USER_ROLE.
   */
  async function apiGetViewerRole() {
    // Preferência: o back devolve o usuário logado com perfil.
    // Ajuste o endpoint do seu back se necessário.
    const data = await apiTryMany([
      () => apiFetch('/api/auth/me', { method: 'GET' }),
      () => apiFetch('/api/usuarios/me', { method: 'GET' }),
      () => apiFetch('/api/conta/me', { method: 'GET' }),
    ]);

    const role =
      Number(data?.tipoUsuario ?? data?.TipoUsuario ?? data?.role ?? data?.Role ?? 0);

    // fallback sem LS: pode injetar no HTML: window.USER_ROLE = 3;
    const winRole = Number(window.USER_ROLE || 0);

    const finalRole = (role === 1 || role === 2 || role === 3) ? role :
                      (winRole === 1 || winRole === 2 || winRole === 3) ? winRole : 2;

    return finalRole;
  }

  /* ===================== FUNCIONÁRIOS (API) ===================== */
  /**
   * Lista funcionários via API, com busca opcional (q). Tenta GET e depois POST /list como fallback.
   */
  async function apiListFuncionarios(q = '') {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return await apiTryMany([
      () => apiFetch(`/api/funcionarios${qs}`, { method: 'GET' }),
      () =>
        apiFetch(`/api/funcionarios/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q }),
        }),
    ]);
  }

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
// + POPUP com CSS + BOTÃO que BAIXA GIF (cantos arredondados + role fiel)
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
    <body style="background:#0b1020;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial">
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
    const resp = await fetch(`http://localhost:5253/api/funcionarios/${id}/assinatura`);
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

    // ✅ Ajuste se seus libs estiverem em outra pasta:
    // ex: new URL("assets/libs/gif.min.js", baseHref).href
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
    // HTML da assinatura (role com TEXTO + IMG SVG)
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
            <div class="scanner-line js-scanLine"></div>

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

                  <!-- ✅ Role: texto (preview) + svg (export) -->
                  <span class="role-wrap">
                    <span class="role-text js-roleText">${escapeHTML(func.funcao)}</span>
                    <img class="role-svg js-roleSvg" alt="${escapeHTML(func.funcao)}" />
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

                  <a class="contact-item" href="https://www.rcrengenharia.tech" target="_blank" rel="noreferrer">
                    <span class="ico" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
                          stroke="currentColor" stroke-width="2"/>
                        <path d="M2 12h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <span class="contact-text">www.rcrengenharia.tech</span>
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
    // CSS — versão “preto predominante” + cantos arredondados + Arial no nome
    // + troca role para SVG no export (pra ficar fiel no GIF)
    // ======================================================
    const SIG6_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

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
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
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
  --radius:24px;
  --muted:#c0cfdf;
}

/* ✅ CARD arredondado (preview) */
.sig6 .signature-card{
  position:relative;
  width:720px;
  height:240px;

  border-radius: var(--radius);
  overflow:hidden;

  border:1px solid transparent;

  /* ✅ preto domina (mais de 75%) */
  background:
    linear-gradient(90deg,
      #000000 0%,
      #000000 60%,
      #02030a 88%,
      #05070b 97%,
      #0c0610 99%,
      #140018 100%
    ) padding-box,
    linear-gradient(135deg,
      rgba(0,224,255,.40),
      rgba(255,47,185,.10)
    ) border-box;

  display:flex;
  box-shadow: 0 18px 44px rgba(0,0,0,.97);
  font-family: 'Poppins', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  isolation:isolate;
}

.sig6 .signature-card::before{
  content:"";
  position:absolute;
  inset:0;
  z-index:1;
  pointer-events:none;
  background:
    radial-gradient(circle at 22% 45%, rgba(0,224,255,.035), transparent 62%),
    radial-gradient(circle at 99% 50%, rgba(255,47,185,.08), transparent 48%),
    radial-gradient(circle at 92% 88%, rgba(255,47,185,.045), transparent 58%),
    radial-gradient(circle at 50% 50%, rgba(0,0,0,.15), rgba(0,0,0,.70)),
    linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.70));
}

/* scanner */
.sig6 .scanner-line{
  position:absolute;
  top:0; left:-140%;
  width:60%;
  height:100%;
  background: linear-gradient(90deg,
    transparent,
    rgba(0,224,255,.14) 40%,
    rgba(255,47,185,.14) 60%,
    transparent
  );
  transform: skewX(-25deg);
  animation: sig6scan 4.5s infinite linear;
  z-index:2;
  pointer-events:none;
  opacity:.9;
}
@keyframes sig6scan{
  0%{ left:-140%; }
  100%{ left:220%; }
}

.sig6 .inner-content{
  position:relative;
  z-index:3;
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  padding: 0 40px;
  gap: 18px;
}

.sig6 .logo-section{
  flex:0 0 230px;
  display:flex;
  justify-content:center;
  align-items:center;
}
.sig6 .logo-img{
  width:185px;
  height:auto;
  display:block;
  filter: drop-shadow(0 0 20px rgba(0,224,255,.30))
          drop-shadow(0 0 10px rgba(255,47,185,.10));
}

.sig6 .info-section{
  flex:1;
  padding-left:26px;
  padding-right:12px;
  border-left:1px solid rgba(255,255,255,.14);
  min-width:0;
}

/* ✅ NOME em ARIAL */
.sig6 .name{
  font-family: Arial, Helvetica, sans-serif !important;
  font-size:27px;
  font-weight:800;
  letter-spacing:.4px;
  color:#ffffff;
  text-shadow:
    0 0 10px rgba(0,224,255,.16),
    0 0 14px rgba(255,47,185,.10);
  line-height:1.1;
  display:inline-block;
}

/* ✅ ROLE: preview com gradiente */
.sig6 .role-wrap{ display:block; margin: 6px 0 18px; }
.sig6 .role-text{
  font-family: 'Orbitron', Arial, Helvetica, sans-serif;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 7px;
  line-height: 1.2;

  background: linear-gradient(90deg, var(--c1), #7C3AED, var(--c2));
  -webkit-background-clip:text;
  background-clip:text;
  color: transparent;
  -webkit-text-fill-color: transparent;

  text-shadow:
    0 0 10px rgba(0,224,255,.18),
    0 0 10px rgba(124,58,237,.14),
    0 0 10px rgba(255,47,185,.12);

  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* ✅ role SVG (só no export) */
.sig6 .role-svg{
  display:none;
  height:14px;
  width:auto;
}
body.exporting .sig6 .role-text{ display:none !important; }
body.exporting .sig6 .role-svg{ display:block !important; }

.sig6 .contact-grid{
  display:grid;
  grid-template-columns: 1fr;
  gap:6px;
}

.sig6 .contact-item{
  font-size:11.2px;
  line-height:1.2;
  color: var(--muted);
  display:flex;
  align-items:flex-start;
  gap:12px;
  text-decoration:none;
  min-width:0;
}

.sig6 .ico{
  width:18px; height:18px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  color: var(--c1);
  filter: drop-shadow(0 0 10px rgba(0,224,255,.65));
  flex:0 0 auto;
  margin-top:1px;
}

.sig6 .contact-text{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.sig6 .contact-text.multiline{
  white-space:normal;
  overflow:visible;
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
  background: linear-gradient(90deg, var(--c1), var(--c2), var(--c1));
  background-size:240% 100%;
  box-shadow: 0 0 14px rgba(0,224,255,.42);
  animation: sig6move 5s infinite ease-in-out, sig6barshine 3s linear infinite;
}
@keyframes sig6barshine{ to{ background-position: 240% 0; } }
@keyframes sig6move{
  0%,100%{ width:18%; left:0%; }
  50%{ width:62%; left:38%; }
}

/* ✅ Export: desliga animações CSS (JS controla frame) */
body.exporting .sig6 .scanner-line,
body.exporting .sig6 .loading-progress{
  animation: none !important;
}

/* ✅ boost leve no export (melhor vibração no gif) */
body.exporting .sig6 .js-sigToCapture{
  filter: saturate(1.05) contrast(1.03) brightness(1.02);
}
    `;

    // ======================================================
    // Script do GIF (popup)
    // - cantos arredondados no GIF (matte)
    // - cria GIF com width/height ANTES do render
    // - role vira SVG no export (igual preview)
    // ======================================================
    const popupGifScript = `
(function(){
  const MATTE_HEX = "#ffffff";   // ✅ mude conforme o fundo do e-mail (ex.: "#f3f3f3")
  const MAX_FRAMES = 240;        // ✅ 60fps * 4s = 240 (seguro)
  
  /**
   * Delay utilitário (Promise) para ceder o loop e permitir atualizações de UI durante a geração do GIF.
   */
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
  /**
   * Aguarda 1 frame de animação (requestAnimationFrame). Útil para garantir que o DOM pintou antes de capturar o canvas.
   */
  function raf(){ return new Promise(requestAnimationFrame); }

  /**
   * Valida se as dependências de geração de GIF (GIF e html2canvas) foram carregadas na popup antes de iniciar a renderização.
   */
  function ensureGifLoaded(){
    if (typeof window.GIF !== "function") throw new Error("GIF library not loaded");
    if (typeof window.html2canvas !== "function") throw new Error("html2canvas not loaded");
  }

  /**
   * Captura um frame da assinatura (elemento DOM) em um canvas via html2canvas (com escala para melhorar qualidade).
   */
  async function captureFrame(el, scale){
    return window.html2canvas(el, {
      backgroundColor: null,
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false
    });
  }

  /**
   * Define o estado da animação (scanner + progress bar) com base em p (0..1) para gerar frames consistentes no GIF.
   */
  function setAnimState(p, scanEl, loadEl){
    scanEl.style.left = (-140 + (360 * p)) + "%";

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

  /**
   * Desenha o path de um retângulo com cantos arredondados em um contexto canvas 2D.
   */
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

  /**
   * Cria um 'matte' em canvas para recortar o GIF com cantos arredondados (as quinas ficam transparentes).
   */
  function makeRoundedMatteCtx(sourceCanvas, radiusPx, matteHex){
    const out = document.createElement("canvas");
    out.width = sourceCanvas.width;
    out.height = sourceCanvas.height;

    const ctx = out.getContext("2d", { willReadFrequently: true });

    // matte (quinas)
    ctx.fillStyle = matteHex;
    ctx.fillRect(0, 0, out.width, out.height);

    ctx.save();
    roundedRectPath(ctx, 0, 0, out.width, out.height, radiusPx);
    ctx.clip();
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    return { canvas: out, ctx };
  }

  /**
   * Escapa caracteres especiais para inserir texto com segurança dentro de SVG (evita quebrar o markup).
   */
  function escapeXml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;")
      .replaceAll("'","&apos;");
  }

  /**
   * Atualiza o texto do cargo dentro de um SVG (para manter visual do cargo fiel no export/capture).
   */
  function updateRoleSvgFor(root){
    const roleTextEl = root.querySelector(".js-roleText");
    const roleSvgEl  = root.querySelector(".js-roleSvg");
    if (!roleTextEl || !roleSvgEl) return;

    const text = (roleTextEl.textContent || "").trim();
    const rect = roleTextEl.getBoundingClientRect();

    const sig = root.closest(".sig6");
    const st = getComputedStyle(sig);
    const c1 = (st.getPropertyValue("--c1") || "#00E0FF").trim();
    const c2 = (st.getPropertyValue("--c2") || "#FF2FB9").trim();
    const mid = "#7C3AED";

    const W = Math.max(10, Math.ceil(rect.width));
    const H = 18;

    const svg =
\`<svg xmlns="http://www.w3.org/2000/svg" width="\${W}" height="\${H}" viewBox="0 0 \${W} \${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="\${c1}"/>
      <stop offset="0.5" stop-color="\${mid}"/>
      <stop offset="1" stop-color="\${c2}"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="0.7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <text x="0" y="13"
        fill="url(#g)"
        font-family="Orbitron, Arial, Helvetica, sans-serif"
        font-size="11"
        font-weight="800"
        letter-spacing="7"
        filter="url(#glow)"
        style="text-transform:uppercase;">
    \${escapeXml(text)}
  </text>
</svg>\`;

    roleSvgEl.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    roleSvgEl.width = W;
    roleSvgEl.height = H;
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
    const scanEl = root.querySelector(".js-scanLine");
    const loadEl = root.querySelector(".js-loadProg");

    try{
      ensureGifLoaded();
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      let seconds = parseFloat(secondsEl?.value || "4");
      let fps = parseInt(fpsEl?.value || "30", 10);
      seconds = Math.min(7, Math.max(1, seconds));
      fps = Math.min(60, Math.max(6, fps));

      // ✅ 60fps precisa ser leve (scale 1). Até 30fps fica top em scale 2.
      const CAPTURE_SCALE = (fps >= 50) ? 1 : 2;

      let totalFrames = Math.max(2, Math.round(seconds * fps));
      if (totalFrames > MAX_FRAMES){
        totalFrames = MAX_FRAMES;
        statusEl && (statusEl.textContent = "Limitei para 240 frames (mais leve).");
        await sleep(400);
      }

      const delay = Math.max(10, Math.round(1000 / fps));

      btn.disabled = true;
      statusEl && (statusEl.textContent = "Preparando...");

      // ✅ gera SVG do cargo ANTES do exporting (pra medir largura do texto)
      updateRoleSvgFor(root);

      document.body.classList.add("exporting");

      // radius real do elemento (px) e escala junto do capture
      const cssRadius = parseFloat(getComputedStyle(sigEl).borderTopLeftRadius) || 24;
      const radiusScaled = cssRadius * CAPTURE_SCALE;

      // 1º frame para obter width/height antes de criar o GIF
      setAnimState(0, scanEl, loadEl);
      await raf(); await raf();

      const raw0 = await captureFrame(sigEl, CAPTURE_SCALE);
      const fr0  = makeRoundedMatteCtx(raw0, radiusScaled, MATTE_HEX);

      const gif = new GIF({
        workers: Math.min(4, navigator.hardwareConcurrency || 2),
        quality: (fps >= 50 ? 12 : 6), // menor = melhor qualidade (mas mais lento)
        dither: (fps >= 50 ? false : "FloydSteinberg"),
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
        a.download = \`Assinatura-RCR-\${fps}fps.gif\`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        statusEl && (statusEl.textContent = \`Pronto! \${fps}fps (\${totalFrames} frames)\`);
      });

      // ✅ adiciona 1º frame (ctx arredondado)
      gif.addFrame(fr0.ctx, { delay, copy:false });
      statusEl && (statusEl.textContent = \`Capturando: 1/\${totalFrames}\`);

      for (let i=1; i<totalFrames; i++){
        const p = i / (totalFrames - 1);
        setAnimState(p, scanEl, loadEl);
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
      statusEl && (statusEl.textContent = "Erro ao gerar GIF. Veja o console (F12).");
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

  <!-- ✅ libs com URL absoluta (mais robusto na popup) -->
  <script src="${escapeHTML(GIF_MIN_URL)}"></script>
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
</head>
<body>
  ${signatureHTML}

  <script>
    ${popupGifScript}
  </script>
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
/* ===================== FIM DA ASSINATURA ===================== */

/**
 * Cria um novo funcionário via API (POST) e retorna o registro criado.
 */
async function apiCreateFuncionario(payload) {
    return await apiFetch(`/api/funcionarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
}

/**
 * Faz upload de uma foto (FormData) para o funcionário. Usa endpoints alternativos como fallback.
 */
async function apiUploadFoto(empId, file) {
    const fd = new FormData();
    fd.append('file', file);

    // ✅ Você também tinha 404 em GET /foto — mas o POST pode existir.
    // De qualquer forma, o ideal é o back devolver { fotoUrl: "..." }.
    return await apiTryMany([
      () => apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/foto`, { method: 'POST', body: fd }),
      () => apiFetch(`/api/funcionarios/upload-foto/${encodeURIComponent(empId)}`, { method: 'POST', body: fd }),
    ]);
}

/**
 * Atualiza o campo de cursos do funcionário via endpoints alternativos (PUT /cursos ou PATCH do registro).
 */
async function apiUpdateCursos(empId, cursosText) {
    // Segurança não pode chamar isso (regra também no front)
    return await apiTryMany([
      () =>
        apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/cursos`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursos: cursosText }),
        }),
      () =>
        apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursos: cursosText }),
        }),
    ]);
}

/**
 * Resolve a URL final da foto (dataURL/http/relative) usando API_BASE quando necessário.
 */
function resolveFotoSrc(f) {
    // ✅ Não tenta mais GET /foto (pra não ficar 404 infinito).
    // Use o que o back te manda (fotoUrl). Se não vier, mostra placeholder.
    const fotoUrl = (f?.fotoUrl || f?.FotoUrl || '').trim();
    if (!fotoUrl) return '';

    if (fotoUrl.startsWith('data:')) return fotoUrl;
    if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) return fotoUrl;
    return `${API_BASE}/${fotoUrl.replace(/^\/+/, '')}`;
}


/* ===================== DOCS IMPORTANTES (API) ===================== */
/**
 * Lista documentos importantes do funcionário via API.
 */
async function apiImpDocsList(empId) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/docs-importantes`, { method: 'GET' });
}

/**
 * Envia (upload) um documento importante + metadados via FormData.
 */
async function apiImpDocsAdd(empId, file, meta) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', meta.name);
    fd.append('type', meta.type);
    fd.append('issue', meta.issue);
    fd.append('due', meta.due);

    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/docs-importantes`, {
      method: 'POST',
      body: fd,
    });
}

/**
 * Remove um documento importante do funcionário via API.
 */
async function apiImpDocsDelete(empId, docId) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/docs-importantes/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    });
}

  /* ===================== EXPLORER (API) ===================== */
  /**
   * Lista todos os itens (pastas/arquivos) do explorer de documentos do funcionário via API.
   */
  async function apiExplorerList(empId) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer`, { method: 'GET' });
  }

  /**
   * Cria uma pasta no explorer do funcionário (parentId opcional).
   */
  async function apiExplorerCreateFolder(empId, parentId, name) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: parentId ?? null, name, ownerRole: STATE.viewerRole }),
    });
  }

  /**
   * Renomeia um item (pasta/arquivo) no explorer via API.
   */
  async function apiExplorerRename(empId, itemId, newName) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/items/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
  }

  /**
   * Exclui um item (pasta/arquivo) do explorer via API.
   */
  async function apiExplorerDelete(empId, itemId) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Faz upload de um ou vários arquivos para uma pasta do explorer via FormData.
   */
  async function apiExplorerUploadFiles(empId, parentId, files) {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    if (parentId) fd.append('parentId', parentId);
    fd.append('ownerRole', String(STATE.viewerRole));

    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/files`, {
      method: 'POST',
      body: fd,
    });
  }

  /**
   * Executa operação de copiar/mover no explorer (conforme suporte do backend).
   */
  async function apiExplorerCopy(empId, srcItemId, targetParentId) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcItemId,
        targetParentId: targetParentId ?? null,
        ownerRole: STATE.viewerRole,
      }),
    });
  }



  /**
   * Gera um SVG inline para ícones do UI (pasta/arquivo/ações), evitando dependência externa.
   */
  function iconSVG(type) {
    if (type === 'phone') return `<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.6 3 3.6 5 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.3 21 3 12.7 3 2c0-.6.4-1 1-1h3.3c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    if (type === 'mail') return `<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4V6Z" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    if (type === 'map') return `<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-4.4 7-12a7 7 0 1 0-14 0c0 7.6 7 12 7 12Z" stroke="currentColor" stroke-width="1.6"/><path d="M12 10.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" stroke-width="1.6"/></svg>`;
    return `<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 1 0 0 20" stroke="currentColor" stroke-width="1.6"/><path d="M2 12h20" stroke="currentColor" stroke-width="1.6"/><path d="M12 2c3 3.3 4.5 6.7 4.5 10S15 18.7 12 22" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }

  /**
   * Formata um telefone brasileiro a partir de dígitos (10/11) para exibição amigável.
   */
  function formatPhoneBR(digitsOrText) {
    const d = String(digitsOrText || '').replace(/\D+/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return digitsOrText || '';
  }


/**
 * Abre a assinatura (HTML pronto) em uma nova aba/janela para visualização/preview.
 */
function openSignatureInNewTab(signatureBlockHTML, pageTitle) {
  const esc =
    (typeof escapeHTML === "function")
      ? escapeHTML
      : (s) =>
          String(s ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");

  // ✅ Sanidade: se você passar HTML que não é da SIG7, o layout vai “quebrar”
  if (!signatureBlockHTML || !String(signatureBlockHTML).includes("sig7")) {
    console.warn(
      "[SIG7] signatureBlockHTML parece não ser do modelo 7. " +
      "Garanta que você está chamando buildSignatureModel7(emp)."
    );
  }

  const baseHref = new URL(".", window.location.href).href;

  // ✅ Coloca as fontes (se seu ambiente bloquear Google Fonts, cai no fallback)
  const fonts = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
`;

  const fullHTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <base href="${esc(baseHref)}">
  <title>${esc(pageTitle || "Assinatura")}</title>
  ${fonts}
  <style>${css}</style>
</head>
<body style="margin:0;background:#0b1020;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:18px;">
  ${signatureBlockHTML || ""}
</body>
</html>`;

  const blob = new Blob([fullHTML], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const w = window.open(url, "_blank");
  if (!w) {
    if (typeof notify === "function") notify("Pop-up bloqueado. Permita pop-ups para abrir a assinatura.", "warn");
    else alert("Pop-up bloqueado. Permita pop-ups para abrir a assinatura.");
    return;
  }

  setTimeout(() => URL.revokeObjectURL(url), 5000);
}




/**
 * Busca um funcionário pelo id dentro do STATE.funcionarios (estado em memória).
 */
function getFuncionarioFromState(empId) {
  return STATE.funcionarios.find((x) => String(x.id ?? x.Id) === String(empId)) || null;
}

/**
 * Normaliza/mescla dados do funcionário (API) com defaults e com o estado atual, evitando undefined e inconsistências.
 */
function mergeEmp(local, remote) {
  // remote sobrescreve o local quando vier preenchido
  return { ...(local || {}), ...(remote || {}) };
}





  /* ===================== UI / BOOT ===================== */
  /**
   * Função de inicialização: coleta elementos do DOM, aplica regras por role, registra eventos e carrega lista inicial da API.
   */
  async function boot() {
    const empGrid = $('empGrid');

    const funcSearch = $('funcSearch');
    const funcSearchBtn = $('funcSearchBtn');
    const funcClear = $('funcClear');

    const funcSearchGestao = $('funcSearchGestao');
    const funcSearchGestaoBtn = $('funcSearchGestaoBtn');
    const funcClearGestao = $('funcClearGestao');

    const modalFuncionario = $('modalFuncionario');
    const funcModalNome = $('funcModalNome');
    const funcModalFuncao = $('funcModalFuncao');
    const funcModalAvatar = $('funcModalAvatar');
    const fecharFuncionario = $('fecharFuncionario');

    const btnAbrirCadastro = $('btnAbrirCadastro');
    const btnFecharCadastro = $('btnFecharCadastro');
    const modalCadastroUsuario = $('modalCadastroUsuario');
    const modalCadastroBody = $('modalCadastroBody');

    const cadFoto = $('cadFoto');
    const cadFotoPreview = $('cadFotoPreview');
    const cadNome = $('cadNome');
    const cadFuncao = $('cadFuncao');
    const cadRG = $('cadRG');
    const cadCPF = $('cadCPF');
    const cadIdade = $('cadIdade');
    const cadCargo = $('cadCargo');
    const cadSalario = $('cadSalario');
    const cadAdmissao = $('cadAdmissao');
    const cadVtUnit = $('cadVtUnit');
    const cadVrDaily = $('cadVrDaily');
    const cadDocumento = $('cadDocumento');

    const cadOptVR = $('cadOptVR');
    const cadOptVT = $('cadOptVT');

    const cadCell = $('cadCell');
    const cadEmail = $('cadEmail');

    const cadTipoContratoCLT = $('cadTipoContratoCLT');
    const cadTipoContratoPJ = $('cadTipoContratoPJ');

    const btnSalvarCadastro = $('btnSalvarCadastro');
    const btnLimparCadastro = $('btnLimparCadastro');

    // Cursos (segurança NÃO pode)
    const funcCursosInput = $('funcCursosInput');
    const btnSalvarCursos = $('btnSalvarCursos');
    const btnTabCursos = $('btnTabCursos');
    const paneCursos = $('paneCursos');

    // Docs importantes
    const impDocsTable = $('impDocsTable');
    const btnAddImpDoc = $('btnAddImpDoc');
    const impDocFile = $('impDocFile');
    const impDocName = $('impDocName');
    const impDocType = $('impDocType');
    const impDocIssue = $('impDocIssue');
    const impDocDue = $('impDocDue');

    // Explorer
    const feTree = $('feTree');
    const feList = $('feList');
    const fePath = $('fePath');
    const feUpload = $('feUpload');
    const feBtnNewFolder = $('feBtnNewFolder');
    const feBtnRename = $('feBtnRename');
    const feBtnDelete = $('feBtnDelete');
    const feBtnCopy = $('feBtnCopy');
    const feBtnPaste = $('feBtnPaste');
    const feBtnDownload = $('feBtnDownload');

    if (!empGrid && !modalFuncionario && !modalCadastroUsuario) return;

    // ===== role via API =====
    try {
      STATE.viewerRole = await apiGetViewerRole();
    } catch (err) {
      console.warn('Não foi possível obter role via API, usando fallback 2 (Gestão).', err);
      STATE.viewerRole = (Number(window.USER_ROLE) === 1 || Number(window.USER_ROLE) === 2 || Number(window.USER_ROLE) === 3)
        ? Number(window.USER_ROLE)
        : 2;
    }

    // ===== regra: segurança não vê “Cursos” =====
    function applyCursosVisibilityRules() {
      if (STATE.viewerRole === 3) {
        if (btnTabCursos) btnTabCursos.style.display = 'none';
        if (paneCursos) paneCursos.style.display = 'none';
        if (btnSalvarCursos) btnSalvarCursos.disabled = true;
        if (funcCursosInput) funcCursosInput.disabled = true;
      }
    }
    applyCursosVisibilityRules();

    /**
     * Sincroniza a lista de funcionários do backend para STATE.funcionarios e re-renderiza a grid.
     */
    async function syncFuncionariosFromAPI() {
      try {
        const data = await apiListFuncionarios('');
        const list = Array.isArray(data) ? data : (data?.items || []);
        STATE.funcionarios = list;
        renderFuncionarios('');
      } catch (err) {
        console.error(err);
        notify('Falha ao carregar funcionários do banco. Verifique API/CORS.', 'error');
        STATE.funcionarios = [];
        renderFuncionarios('');
      }
    }

    /**
     * Renderiza a grid de cards de funcionários (com busca) a partir do STATE.funcionarios.
     */
    function renderFuncionarios(q = '') {
      if (!empGrid) return;

      const term = String(q || '').trim().toLowerCase();
      const all = STATE.funcionarios;

      const list = term
        ? all.filter((f) => String(f.nome || f.Nome || '').toLowerCase().includes(term))
        : all;

      const photoOrFallback = (src, name) => {
        const rawName = String(name || '').trim();
        const safeName = escapeHTML(rawName || 'Funcionário');
        const initials = rawName
          ? rawName.split(/\s+/).slice(0, 2).map((p) => (p[0] || '').toUpperCase()).join('')
          : '?';

        const safeSrc = src ? escapeHTML(String(src)) : '';
        return `
          <div class="emp-avatar ${safeSrc ? '' : 'no-photo'}" aria-label="${safeSrc ? `Foto de ${safeName}` : `Sem foto de ${safeName}`}">
            <div class="emp-avatar-inner">
              ${safeSrc ? `<img src="${safeSrc}" alt="Foto de ${safeName}" loading="lazy" decoding="async" />`
                        : `<span class="emp-initial">${escapeHTML(initials)}</span>`}
            </div>
          </div>`;
      };

      empGrid.innerHTML =
        (list.map((f) => {
          const id = f.id ?? f.Id;
          const nome = f.nome ?? f.Nome ?? '';
          const funcao = f.funcao ?? f.Funcao ?? '';
          const idade = f.idade ?? f.Idade ?? '';
          const ativo = typeof f.ativo !== 'undefined' ? !!f.ativo : true;

          const inactiveClass = ativo ? '' : 'inactive';
          const offBadge = ativo ? '' : `<span class="emp-badge-off">INATIVO</span>`;

          const canManageStatus = STATE.viewerRole === 1 || STATE.viewerRole === 2;

          const menu = `
            <div class="emp-menu" data-id="${escapeHTML(String(id))}" title="Opções" aria-haspopup="menu" aria-expanded="false">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </div>
            <div class="emp-menu-dropdown" data-menu="${escapeHTML(String(id))}" role="menu">
              ${
                canManageStatus
                  ? (ativo
                      ? `<button data-action="desativar" data-id="${escapeHTML(String(id))}"><i class="fa-regular fa-circle-xmark"></i> Desativar</button>`
                      : `<button data-action="ativar" data-id="${escapeHTML(String(id))}"><i class="fa-regular fa-circle-check"></i> Ativar</button>`
                    ) +
                    `<button data-action="cracha" data-id="${escapeHTML(String(id))}"><i class="fa-regular fa-id-badge"></i> Crachá de acesso</button>`
                  : ''
              }
              <button data-action="assinatura" data-id="${escapeHTML(String(id))}">
                <i class="fa-regular fa-pen-to-square"></i> Gerar assinatura
              </button>
            </div>
          `;

          const fotoSrc = resolveFotoSrc(f);

          return `
            <div class="emp-card ${inactiveClass}" data-id="${escapeHTML(String(id))}">
              ${menu}
              ${offBadge}
              ${photoOrFallback(fotoSrc, nome)}
              <div>
                <div class="emp-name">${escapeHTML(nome)}</div>
                <div class="emp-role">${escapeHTML(funcao)}${idade ? ` • ${escapeHTML(String(idade))} anos` : ''}</div>
              </div>
            </div>`;
        }).join('')) || `<div style="color:#9fb1c3">Nenhum funcionário encontrado.</div>`;
    }

    // ===== Modal Funcionário =====
    async function openFuncionario(empId) {
      const local = STATE.funcionarios.find((x) => String(x.id ?? x.Id) === String(empId));
      if (!local) return;

      STATE.currentEmpId = String(local.id ?? local.Id);

      const nome = local.nome ?? local.Nome ?? '';
      const funcao = local.funcao ?? local.Funcao ?? '';
      const idade = local.idade ?? local.Idade ?? '';

      if (funcModalNome) funcModalNome.textContent = nome;
      if (funcModalFuncao) funcModalFuncao.textContent = `${funcao}${idade ? ` • ${idade} anos` : ''}`;

      if (funcModalAvatar) {
        const src = resolveFotoSrc(local);
        funcModalAvatar.src = src || defaultAvatarDataURL();
        funcModalAvatar.title = 'Clique para alterar a foto';
        funcModalAvatar.style.cursor = 'pointer';
      }

      // cursos: segurança bloqueado
      if (STATE.viewerRole !== 3) {
        if (funcCursosInput) funcCursosInput.value = local.cursos || '';
        if (btnSalvarCursos) btnSalvarCursos.disabled = false;
        if (funcCursosInput) funcCursosInput.disabled = false;
      } else {
        if (funcCursosInput) funcCursosInput.value = '';
      }

      // carrega docs importantes e explorer via API
      try {
        STATE.impDocs = await apiImpDocsList(STATE.currentEmpId);
      } catch (err) {
        console.warn(err);
        STATE.impDocs = [];
      }
      renderImpDocsTable();

      try {
        const allItems = await apiExplorerList(STATE.currentEmpId);
        STATE.explorerItems = Array.isArray(allItems) ? allItems : (allItems?.items || []);
      } catch (err) {
        console.warn(err);
        STATE.explorerItems = [];
      }
      STATE.feCurrentFolderId = null;
      STATE.feSelection = null;
      feRefresh();

      if (modalFuncionario) modalFuncionario.style.display = 'flex';
    }

    /**
     * Fecha o modal do funcionário e limpa estados/seleções relacionadas.
     */
    function closeFuncionario() {
      if (modalFuncionario) modalFuncionario.style.display = 'none';
    }
    fecharFuncionario?.addEventListener('click', closeFuncionario);

    // ===== Salvar cursos (API) =====
    btnSalvarCursos?.addEventListener('click', async () => {
      if (STATE.viewerRole === 3) {
        return notify('Perfil Segurança do Trabalho não tem acesso à aba Cursos.', 'warn');
      }
      if (!STATE.currentEmpId) return notify('Abra um funcionário antes de salvar cursos.', 'warn');

      const texto = (funcCursosInput?.value || '').trim();
      try {
        await apiUpdateCursos(STATE.currentEmpId, texto);
        notify('Cursos do funcionário salvos com sucesso.', 'success');
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao salvar cursos no servidor.', 'error');
      }
    });

    // ===== Foto upload (API) =====
    let hiddenPhotoInput = null;
    /**
     * Garante um <input type='file'> oculto para trocar foto sem poluir o layout; retorna a referência.
     */
    function ensureHiddenPhotoInput() {
      if (!hiddenPhotoInput) {
        hiddenPhotoInput = document.createElement('input');
        hiddenPhotoInput.type = 'file';
        hiddenPhotoInput.accept = 'image/*';
        hiddenPhotoInput.style.display = 'none';
        document.body.appendChild(hiddenPhotoInput);
      }
      return hiddenPhotoInput;
    }

    /**
     * Fluxo de troca de foto: abre seletor, envia para API e atualiza o funcionário no estado/DOM.
     */
    async function changePhotoForEmp(empId) {
      const input = ensureHiddenPhotoInput();
      input.value = '';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          const resp = await apiUploadFoto(empId, file);
          const fotoUrl = (resp?.fotoUrl || resp?.FotoUrl || '').trim();

          // atualiza na memória
          const idx = STATE.funcionarios.findIndex((x) => String(x.id ?? x.Id) === String(empId));
          if (idx >= 0) STATE.funcionarios[idx].fotoUrl = fotoUrl;

          renderFuncionarios(funcSearch?.value || funcSearchGestao?.value || '');

          if (funcModalAvatar && String(STATE.currentEmpId) === String(empId)) {
            funcModalAvatar.src = (fotoUrl ? resolveFotoSrc({ fotoUrl }) : '') || defaultAvatarDataURL();
          }

          notify('Foto atualizada.', 'success');
        } catch (err) {
          console.error(err);
          notify(err.message || 'Falha ao enviar foto.', 'error');
        }
      };
      input.click();
    }

    funcModalAvatar?.addEventListener('click', () => {
      if (!STATE.currentEmpId) return;
      changePhotoForEmp(STATE.currentEmpId);
    });

    // ===== Menus =====
    function closeAllEmpMenus() {
      document.querySelectorAll('.emp-menu-dropdown.open').forEach((el) => el.classList.remove('open'));
      document.querySelectorAll('.emp-menu[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
    }

    /**
     * Abre/fecha o dropdown de opções do card do funcionário (ativar/desativar/crachá...).
     */
    function toggleEmpMenu(id) {
      const dd = document.querySelector(`.emp-menu-dropdown[data-menu="${CSS.escape(String(id))}"]`);
      const btn = document.querySelector(`.emp-menu[data-id="${CSS.escape(String(id))}"]`);
      if (!dd || !btn) return;
      const willOpen = !dd.classList.contains('open');
      closeAllEmpMenus();
      if (willOpen) { dd.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      else { btn.setAttribute('aria-expanded', 'false'); }
    }

    /**
     * Marca um funcionário como ativo/inativo apenas no estado local (UI), sem persistência no backend.
     */
    function setFuncionarioAtivoLocalOnly(id, ativo) {
      // status também deveria ser API (mas você não passou endpoint).
      // Se você quiser, eu te monto PUT /api/funcionarios/{id}/ativo.
      if (!(STATE.viewerRole === 1 || STATE.viewerRole === 2)) {
        notify('Ativar/desativar só é permitido para Admin ou Gestão.', 'warn');
        return;
      }
      const idx = STATE.funcionarios.findIndex((f) => String(f.id ?? f.Id) === String(id));
      if (idx < 0) return;

      STATE.funcionarios[idx].ativo = !!ativo;
      notify(ativo ? 'Funcionário ativado (apenas UI).' : 'Funcionário desativado (apenas UI).', 'warn');
      renderFuncionarios(funcSearch?.value || funcSearchGestao?.value || '');
      safeCall('renderVT');
      safeCall('renderVR');
    }

    empGrid?.addEventListener('click', (e) => {
      const avatar = e.target.closest('.emp-avatar');
      if (avatar) {
        e.stopPropagation();
        const card = e.target.closest('.emp-card');
        const id = card?.getAttribute('data-id');
        if (id) changePhotoForEmp(id);
        return;
      }

      const onMenuBtn = e.target.closest('.emp-menu');
      const onMenuDD = e.target.closest('.emp-menu-dropdown');
      const onAction = e.target.closest('.emp-menu-dropdown [data-action]');

      if (onMenuBtn) {
        e.stopPropagation();
        toggleEmpMenu(onMenuBtn.getAttribute('data-id'));
        return;
      }

      if (onMenuDD && !onAction) { e.stopPropagation(); return; }

      if (onAction) {
        e.stopPropagation();
        const act = onAction.getAttribute('data-action');
        const id = onAction.getAttribute('data-id');

        if (act === 'desativar') setFuncionarioAtivoLocalOnly(id, false);
        if (act === 'ativar') setFuncionarioAtivoLocalOnly(id, true);

        if (act === 'cracha') {
          const f = STATE.funcionarios.find((x) => String(x.id ?? x.Id) === String(id));
          if (!f) notify('Funcionário não encontrado para o crachá.', 'warn');
          else if (typeof window.openCrachaFuncionario === 'function') window.openCrachaFuncionario(f);
        }

        if (act === 'assinatura') gerarAssinaturaFuncionario(id);

        closeAllEmpMenus();
        return;
      }

      const card = e.target.closest('.emp-card');
      if (!card) return;
      const id = card.getAttribute('data-id');
      if (id) openFuncionario(id);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.emp-menu') && !e.target.closest('.emp-menu-dropdown')) closeAllEmpMenus();
    });

    // ===== Search =====
    funcSearchBtn?.addEventListener('click', () => renderFuncionarios(funcSearch?.value || ''));
    funcClear?.addEventListener('click', () => { if (funcSearch) funcSearch.value = ''; renderFuncionarios(''); });
    funcSearch?.addEventListener('input', () => renderFuncionarios(funcSearch.value || ''));

    funcSearchGestaoBtn?.addEventListener('click', () => renderFuncionarios(funcSearchGestao?.value || ''));
    funcClearGestao?.addEventListener('click', () => { if (funcSearchGestao) funcSearchGestao.value = ''; renderFuncionarios(''); });
    funcSearchGestao?.addEventListener('input', () => renderFuncionarios(funcSearchGestao.value || ''));

    // ===== Cadastro Modal (mantive seu padrão) =====
    (function mountCadastroModal() {
      const cadWrap = document.querySelector('.gestao-cadastro-wrap');
      const cadBox = cadWrap ? cadWrap.querySelector('.gestao-cadastro') : null;

      /**
       * Abre um modal genérico (display/aria) e trava scroll conforme o CSS da tela.
       */
      function openModal() {
        if (cadBox && modalCadastroBody && cadBox.parentElement !== modalCadastroBody) modalCadastroBody.appendChild(cadBox);
        if (modalCadastroUsuario) modalCadastroUsuario.style.display = 'flex';
      }
      /**
       * Fecha um modal genérico (display/aria) e restaura estados de UI.
       */
      function closeModal() {
        if (cadWrap && cadBox && cadBox.parentElement !== cadWrap) cadWrap.appendChild(cadBox);
        if (modalCadastroUsuario) modalCadastroUsuario.style.display = 'none';
      }

      btnAbrirCadastro?.addEventListener('click', openModal);
      btnFecharCadastro?.addEventListener('click', closeModal);
      modalCadastroUsuario?.addEventListener('click', (e) => { if (e.target === modalCadastroUsuario) closeModal(); });
      document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
    })();

    cadEmail?.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\s+/g, ''); });

    // máscara celular
    function maskBRPhoneLive(value) {
      const d = onlyDigits(value).slice(0, 11);
      if (!d) return '';
      if (d.length < 3) return `(${d}`;
      const dd = d.slice(0, 2);
      const rest = d.slice(2);
      if (rest.length <= 4) return `(${dd}) ${rest}`;
      if (rest.length <= 8) return `(${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
      return `(${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    /**
     * Formata string de telefone (10/11 dígitos) em (DD) NNNN-NNNN ou (DD) NNNNN-NNNN.
     */
    function formatBRPhone(value) {
      const d = onlyDigits(value);
      if (!(d.length === 10 || d.length === 11)) return '';
      const dd = d.slice(0, 2);
      const rest = d.slice(2);
      if (rest.length === 9) return `(${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      return `(${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    /**
     * Aplica uma máscara a um input preservando a posição do cursor (caret), evitando 'pular' caracteres.
     */
    function applyMaskedWithCaret(inputEl, maskedValue, digitsBeforeCaret) {
      inputEl.value = maskedValue;
      if (!Number.isFinite(digitsBeforeCaret)) return;
      let pos = 0, digitsCount = 0;
      while (pos < maskedValue.length) {
        if (/\d/.test(maskedValue[pos])) digitsCount++;
        if (digitsCount >= digitsBeforeCaret) { pos++; break; }
        pos++;
      }
      inputEl.setSelectionRange(pos, pos);
    }
    cadCell?.addEventListener('input', (e) => {
      const el = e.target;
      const caret = el.selectionStart ?? el.value.length;
      const digitsBefore = onlyDigits(el.value.slice(0, caret)).length;
      applyMaskedWithCaret(el, maskBRPhoneLive(el.value), digitsBefore);
    });
    cadCell?.addEventListener('blur', () => {
      const raw = cadCell.value || '';
      if (!onlyDigits(raw)) { cadCell.value = ''; return; }
      cadCell.value = formatBRPhone(raw) || '';
    });

    // preview foto
    let __cadFotoObjUrl = null;
    cadFoto?.addEventListener('change', (e) => {
      const input = e.target;
      const f = input.files?.[0];

      if (__cadFotoObjUrl) { URL.revokeObjectURL(__cadFotoObjUrl); __cadFotoObjUrl = null; }
      if (!f) { if (cadFotoPreview) cadFotoPreview.src = 'assets/img/user.png'; return; }
      if (!f.type.startsWith('image/')) {
        notify('Selecione um arquivo de imagem.', 'warn');
        input.value = '';
        if (cadFotoPreview) cadFotoPreview.src = 'assets/img/user.png';
        return;
      }
      __cadFotoObjUrl = URL.createObjectURL(f);
      if (cadFotoPreview) {
        cadFotoPreview.src = __cadFotoObjUrl;
        cadFotoPreview.onload = () => { if (__cadFotoObjUrl) { URL.revokeObjectURL(__cadFotoObjUrl); __cadFotoObjUrl = null; } };
      }
    });

    // ===== Cadastrar (API) =====
    btnSalvarCadastro?.addEventListener('click', async () => {
      try {
        const nome = (cadNome?.value || '').trim();
        const funcao = (cadFuncao?.value || '').trim();
        if (!nome || !funcao) return notify('Nome e Função são obrigatórios.', 'warn');

        const rg = (cadRG?.value || '').trim();
        const cpf = (cadCPF?.value || '').trim();
        const idade = parseInt((cadIdade?.value || '0').trim(), 10) || 0;
        const cargo = (cadCargo?.value || '').trim() || funcao;
        const salario = parseFloat(String(cadSalario?.value || '0').replace(',', '.')) || 0;

        const optVR = !!cadOptVR?.checked;
        const optVT = !!cadOptVT?.checked;

        const vtUnitV = parseFloat(String(cadVtUnit?.value || '').replace(',', '.'));
        const vrDailyV = parseFloat(String(cadVrDaily?.value || '').replace(',', '.'));

        const email = (cadEmail?.value || '').trim() || null;
        const celularFmt = (cadCell?.value || '').trim() || null;
        const cellDigits = celularFmt ? onlyDigits(celularFmt) : null;

        const tipoContrato =
          cadTipoContratoCLT?.checked ? 1 :
          cadTipoContratoPJ?.checked  ? 2 : 0;

        const dataAdmissao = cadAdmissao?.value ? `${cadAdmissao.value}T00:00:00` : null;

        const payload = {
          nome,
          funcao,
          rg,
          email,
          celular: cellDigits,
          cpf: onlyDigits(cpf),
          idade,
          cargo,
          salario,
          recebeVr: optVR,
          recebeVt: optVT,
          tarifaVt: Number.isFinite(vtUnitV) ? vtUnitV : null,
          valorDiarioVr: Number.isFinite(vrDailyV) ? vrDailyV : null,
          tipoContrato,
          fotoUrl: null,
          dataAdmissao,
        };

        const created = await apiCreateFuncionario(payload);
        const id = created?.id ?? created?.Id;
        if (id == null) throw new Error('API não retornou o ID do funcionário.');

        // Foto
        if (cadFoto?.files?.[0]) {
          try { await apiUploadFoto(id, cadFoto.files[0]); }
          catch (err) { console.warn(err); notify('Funcionário salvo, mas falhou ao enviar foto.', 'warn'); }
        }

        // Documento inicial: seu back precisa desse endpoint se você quiser manter
        if (cadDocumento?.files?.[0]) {
          notify('Upload de documento inicial depende de endpoint no back (não incluído aqui).', 'warn');
        }

        notify('Funcionário cadastrado!', 'success');
        await syncFuncionariosFromAPI();

        // limpa campos
        [cadNome, cadFuncao, cadRG, cadCPF, cadEmail, cadCell, cadIdade, cadCargo, cadSalario, cadAdmissao, cadVtUnit, cadVrDaily]
          .forEach((el) => el && (el.value = ''));
        if (cadDocumento) cadDocumento.value = '';
        if (cadFoto) cadFoto.value = '';
        if (cadFotoPreview) cadFotoPreview.src = '';
        if (cadOptVR) cadOptVR.checked = false;
        if (cadOptVT) cadOptVT.checked = false;
        if (cadTipoContratoCLT) cadTipoContratoCLT.checked = false;
        if (cadTipoContratoPJ) cadTipoContratoPJ.checked = false;

        safeCall('renderVT');
        safeCall('renderVR');
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao cadastrar funcionário no servidor.', 'error');
      }
    });

    btnLimparCadastro?.addEventListener('click', () => {
      [cadNome, cadFuncao, cadRG, cadCPF, cadEmail, cadCell, cadIdade, cadCargo, cadSalario, cadAdmissao, cadVtUnit, cadVrDaily]
        .forEach((el) => el && (el.value = ''));
      if (cadDocumento) cadDocumento.value = '';
      if (cadFoto) cadFoto.value = '';
      if (cadFotoPreview) cadFotoPreview.src = '';
      if (cadOptVR) cadOptVR.checked = false;
      if (cadOptVT) cadOptVT.checked = false;
      if (cadTipoContratoCLT) cadTipoContratoCLT.checked = false;
      if (cadTipoContratoPJ) cadTipoContratoPJ.checked = false;
    });

    /* ===================== DOCUMENTOS IMPORTANTES (UI) ===================== */
    /**
     * Renderiza a tabela de documentos importantes (STATE.impDocs) no modal/mini-modal.
     */
    function renderImpDocsTable() {
      if (!impDocsTable || !STATE.currentEmpId) return;

      const list = Array.isArray(STATE.impDocs) ? STATE.impDocs : [];
      if (!list.length) {
        impDocsTable.innerHTML = `<tr><td colspan="5" style="color:#9fb1c3">Nenhum documento importante.</td></tr>`;
        return;
      }

      impDocsTable.innerHTML = list.map((d) => {
        const issue = d.issue ? new Date(String(d.issue).slice(0,10) + 'T00:00:00') : null;
        const due = d.due ? new Date(String(d.due).slice(0,10) + 'T00:00:00') : null;
        const issueLabel = issue ? `${two(issue.getDate())}/${two(issue.getMonth()+1)}/${issue.getFullYear()}` : '—';
        const dueLabel = due ? `${two(due.getDate())}/${two(due.getMonth()+1)}/${due.getFullYear()}` : '—';

        const downloadUrl = (d.downloadUrl || '').trim();

        return `<tr>
          <td style="text-align:left">${escapeHTML(d.name || '(sem nome)')}</td>
          <td>${escapeHTML(d.type || '—')}</td>
          <td>${issueLabel}</td>
          <td>${dueLabel}</td>
          <td>
            ${downloadUrl ? `<a class="btn btn-light" href="${escapeHTML(downloadUrl)}" target="_blank"><i class="fa-solid fa-download"></i> Baixar</a>` : ''}
            <button class="btn btn-ghost" data-imp-del="${escapeHTML(String(d.id))}">
              <i class="fa-solid fa-trash"></i> Excluir
            </button>
          </td>
        </tr>`;
      }).join('');
    }

    btnAddImpDoc?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return notify('Abra um funcionário primeiro.', 'warn');

      const file = impDocFile?.files?.[0] || null;
      const name = (impDocName?.value || '').trim();
      const type = (impDocType?.value || '').trim();
      const issue = (impDocIssue?.value || '').trim();
      const due = (impDocDue?.value || '').trim();

      if (!file) return notify('Selecione um arquivo.', 'warn');
      if (!name) return notify('Informe o nome do documento.', 'warn');
      if (!type) return notify('Informe o tipo do documento.', 'warn');
      if (!issue) return notify('Informe a data de emissão.', 'warn');
      if (!due) return notify('Informe a data de validade.', 'warn');

      try {
        await apiImpDocsAdd(STATE.currentEmpId, file, { name, type, issue, due });
        STATE.impDocs = await apiImpDocsList(STATE.currentEmpId);

        if (impDocFile) impDocFile.value = '';
        if (impDocName) impDocName.value = '';
        if (impDocType) impDocType.value = '';
        if (impDocIssue) impDocIssue.value = '';
        if (impDocDue) impDocDue.value = '';

        renderImpDocsTable();
        notify('Documento importante adicionado.', 'success');
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao adicionar documento importante.', 'error');
      }
    });

    impDocsTable?.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-imp-del]');
      if (!del || !STATE.currentEmpId) return;

      const docId = del.getAttribute('data-imp-del');
      if (!confirm('Excluir este documento importante?')) return;

      try {
        await apiImpDocsDelete(STATE.currentEmpId, docId);
        STATE.impDocs = await apiImpDocsList(STATE.currentEmpId);
        renderImpDocsTable();
        notify('Documento excluído.', 'success');
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao excluir documento.', 'error');
      }
    });

    /* ===================== EXPLORER (UI + VISIBILIDADE) ===================== */
    /**
     * Regra de visibilidade do Explorer: decide se o item (context/ownerRole) pode ser visto pelo viewerRole.
     */
    function canSeeItem(it) {
      return canSeeOwnerRole(it.ownerRole, STATE.viewerRole);
    }

    /**
     * Re-renderiza o Explorer (breadcrumbs, árvore de pastas, lista) com base em STATE.explorerItems e pasta atual.
     */
    function feRefresh() {
      if (!feTree || !feList || !fePath || !STATE.currentEmpId) return;

      const list = Array.isArray(STATE.explorerItems) ? STATE.explorerItems : [];

      // valida pasta atual
      if (STATE.feCurrentFolderId) {
        const stillExists = list.some((it) => it.type === 'folder' && it.id === STATE.feCurrentFolderId);
        if (!stillExists) STATE.feCurrentFolderId = null;
      }

      feRenderPath(list);
      feRenderTree(list);
      feRenderList(list);
    }

    /**
     * Renderiza o breadcrumb (caminho) da pasta atual no Explorer.
     */
    function feRenderPath(list) {
      if (!fePath) return;
      const crumbs = [];
      let folderId = STATE.feCurrentFolderId;

      while (folderId) {
        const f = list.find((it) => it.id === folderId && it.type === 'folder');
        if (!f) break;
        crumbs.unshift({ id: f.id, name: f.name || 'Pasta' });
        folderId = f.parentId ?? null;
      }

      let html = `<span class="fe-bc${STATE.feCurrentFolderId ? '' : ' current'}" data-id="">Documentos</span>`;
      if (crumbs.length) {
        html = `<span class="fe-bc" data-id="">Documentos</span> / ` +
          crumbs.map((c, idx) => {
            const last = idx === crumbs.length - 1;
            return `<span class="fe-bc${last ? ' current' : ''}" data-id="${c.id}">${escapeHTML(c.name)}</span>`;
          }).join(' / ');
      }
      fePath.innerHTML = html;
    }

    fePath?.addEventListener('click', (e) => {
      const el = e.target.closest('.fe-bc');
      if (!el) return;
      const id = el.dataset.id || '';
      STATE.feCurrentFolderId = id || null;
      STATE.feSelection = null;
      feRefresh();
    });

    /**
     * Renderiza a árvore de pastas (sidebar) do Explorer, incluindo seleção da pasta atual.
     */
    function feRenderTree(list) {
      if (!feTree) return;

      /**
       * Helper recursivo para montar HTML da árvore de pastas do Explorer.
       */
      function renderFolder(parentId) {
        const children = list
          .filter((it) => it.type === 'folder' && (it.parentId ?? null) === parentId)
          .filter(canSeeItem)
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

        if (!children.length) return '';

        return `<ul class="fe-tree-list">
          ${children.map((f) => `
            <li>
              <div class="fe-tree-folder ${STATE.feCurrentFolderId === f.id ? 'active' : ''}" data-id="${f.id}">
                <span class="fe-icon"><i class="fa-regular fa-folder"></i></span>
                <span class="fe-label">${escapeHTML(f.name || 'Pasta')}</span>
              </div>
              ${renderFolder(f.id)}
            </li>`).join('')}
        </ul>`;
      }

      const rootActive = STATE.feCurrentFolderId == null;
      feTree.innerHTML = `
        <div class="fe-tree-root">
          <div class="fe-tree-folder ${rootActive ? 'active' : ''}" data-id="">
            <span class="fe-icon"><i class="fa-regular fa-folder-open"></i></span>
            <span class="fe-label">Documentos</span>
          </div>
          ${renderFolder(null)}
        </div>`;
    }

    feTree?.addEventListener('click', (e) => {
      const node = e.target.closest('.fe-tree-folder');
      if (!node) return;
      const id = node.dataset.id || '';
      STATE.feCurrentFolderId = id || null;
      STATE.feSelection = null;
      feRefresh();
    });

    /**
     * Renderiza a tabela/lista de itens (pastas/arquivos) da pasta atual no Explorer.
     */
    function feRenderList(list) {
      if (!feList) return;
      const tbody = feList.querySelector('tbody');
      if (!tbody) return;

      const parentId = STATE.feCurrentFolderId ?? null;

      const folders = list
        .filter((it) => it.type === 'folder' && (it.parentId ?? null) === parentId)
        .filter(canSeeItem)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

      const files = list
        .filter((it) => it.type !== 'folder' && (it.parentId ?? null) === parentId)
        .filter(canSeeItem)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

      if (!folders.length && !files.length) {
        tbody.innerHTML = `<tr class="fe-empty"><td colspan="4">Pasta vazia</td></tr>`;
        return;
      }

      const rows = [];

      folders.forEach((f) => {
        rows.push(`
          <tr data-type="folder" data-id="${f.id}">
            <td><span class="fe-icon"><i class="fa-regular fa-folder"></i></span> ${escapeHTML(f.name || 'Pasta')}</td>
            <td>Pasta</td>
            <td>—</td>
            <td>—</td>
          </tr>`);
      });

      files.forEach((file) => {
        const when = file.uploadedAt ? new Date(file.uploadedAt) : null;
        const whenLabel = when
          ? `${two(when.getDate())}/${two(when.getMonth()+1)}/${when.getFullYear()} ${two(when.getHours())}:${two(when.getMinutes())}`
          : '—';

        rows.push(`
          <tr data-type="file" data-id="${file.id}">
            <td><span class="fe-icon"><i class="fa-regular fa-file-lines"></i></span> ${escapeHTML(file.name || '(sem nome)')}</td>
            <td>Arquivo</td>
            <td>${bytesHuman(file.size || 0)}</td>
            <td>${whenLabel}</td>
          </tr>`);
      });

      tbody.innerHTML = rows.join('');

      if (STATE.feSelection) {
        const row = tbody.querySelector(`tr[data-type="${STATE.feSelection.type}"][data-id="${STATE.feSelection.id}"]`);
        if (row) row.classList.add('selected');
        else STATE.feSelection = null;
      }
    }

    feList?.addEventListener('click', (e) => {
      const row = e.target.closest('tbody tr[data-id]');
      if (!row) return;
      const tbody = feList.querySelector('tbody');
      if (!tbody) return;

      tbody.querySelectorAll('tr.selected').forEach((tr) => tr.classList.remove('selected'));
      row.classList.add('selected');
      STATE.feSelection = { type: row.dataset.type, id: row.dataset.id };
    });

    feList?.addEventListener('dblclick', (e) => {
      const row = e.target.closest('tbody tr[data-id]');
      if (!row) return;

      const type = row.dataset.type;
      const id = row.dataset.id;

      if (type === 'folder') {
        STATE.feCurrentFolderId = id;
        STATE.feSelection = null;
        feRefresh();
        return;
      }

      if (type === 'file') {
        const file = STATE.explorerItems.find((it) => it.id === id && it.type !== 'folder');
        if (!file) return;

        const downloadUrl = (file.downloadUrl || '').trim();
        if (downloadUrl) {
          window.open(downloadUrl, '_blank', 'noopener');
          return;
        }

        notify('Arquivo sem downloadUrl retornado pelo back.', 'warn');
      }
    });

    // Upload
    if (feUpload) {
      feUpload.setAttribute('multiple', '');
      feUpload.removeAttribute('accept');
    }

    feUpload?.addEventListener('change', async (e) => {
      if (!STATE.currentEmpId) return notify('Abra um funcionário primeiro.', 'warn');
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      try {
        await apiExplorerUploadFiles(STATE.currentEmpId, STATE.feCurrentFolderId, files);
        const allItems = await apiExplorerList(STATE.currentEmpId);
        STATE.explorerItems = Array.isArray(allItems) ? allItems : (allItems?.items || []);
        feUpload.value = '';
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao enviar arquivos para o explorer.', 'error');
      }
    });

    // Nova pasta
    feBtnNewFolder?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return notify('Abra um funcionário primeiro.', 'warn');

      let name = prompt('Nome da nova pasta:', 'Nova pasta');
      if (!name) return;
      name = name.trim();
      if (!name) return;

      try {
        await apiExplorerCreateFolder(STATE.currentEmpId, STATE.feCurrentFolderId, name);
        const allItems = await apiExplorerList(STATE.currentEmpId);
        STATE.explorerItems = Array.isArray(allItems) ? allItems : (allItems?.items || []);
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao criar pasta.', 'error');
      }
    });

    // Renomear
    feBtnRename?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.feSelection) return notify('Selecione uma pasta ou arquivo para renomear.', 'warn');

      const item = STATE.explorerItems.find((it) => it.id === STATE.feSelection.id);
      if (!item) return;

      if (!canSeeItem(item)) return notify('Você não tem permissão para ver/alterar este item.', 'warn');

      const newName = prompt('Novo nome:', item.name || '');
      if (!newName) return;

      try {
        await apiExplorerRename(STATE.currentEmpId, item.id, newName.trim());
        const allItems = await apiExplorerList(STATE.currentEmpId);
        STATE.explorerItems = Array.isArray(allItems) ? allItems : (allItems?.items || []);
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao renomear.', 'error');
      }
    });

    // Excluir
    feBtnDelete?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.feSelection) return notify('Selecione uma pasta ou arquivo para excluir.', 'warn');

      const item = STATE.explorerItems.find((it) => it.id === STATE.feSelection.id);
      if (!item) return;

      if (!canSeeItem(item)) return notify('Você não tem permissão para excluir este item.', 'warn');

      const isFolder = STATE.feSelection.type === 'folder';
      if (!confirm(isFolder ? 'Excluir esta pasta e todo o conteúdo?' : `Excluir o arquivo "${item.name}"?`)) return;

      try {
        await apiExplorerDelete(STATE.currentEmpId, item.id);
        const allItems = await apiExplorerList(STATE.currentEmpId);
        STATE.explorerItems = Array.isArray(allItems) ? allItems : (allItems?.items || []);
        STATE.feSelection = null;
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao excluir.', 'error');
      }
    });

    // Copiar / Colar via API
    feBtnCopy?.addEventListener('click', () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.feSelection) return notify('Selecione uma pasta ou arquivo para copiar.', 'warn');

      const item = STATE.explorerItems.find((it) => it.id === STATE.feSelection.id);
      if (!item) return;
      if (!canSeeItem(item)) return notify('Você não tem permissão para copiar este item.', 'warn');

      STATE.feCopyBuffer = { id: item.id };
      notify('Copiado. Vá até a pasta de destino e clique em "Colar".', 'info');
    });

    feBtnPaste?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.feCopyBuffer) return notify('Nada para colar. Use o botão Copiar primeiro.', 'warn');

      try {
        await apiExplorerCopy(STATE.currentEmpId, STATE.feCopyBuffer.id, STATE.feCurrentFolderId);
        const allItems = await apiExplorerList(STATE.currentEmpId);
        STATE.explorerItems = Array.isArray(allItems) ? allItems : (allItems?.items || []);
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao colar.', 'error');
      }
    });

    // Download
    feBtnDownload?.addEventListener('click', () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.feSelection) return notify('Selecione um arquivo ou pasta para baixar.', 'warn');

      const item = STATE.explorerItems.find((it) => it.id === STATE.feSelection.id);
      if (!item) return notify('Item não encontrado.', 'error');

      if (!canSeeItem(item)) return notify('Você não tem permissão para baixar este item.', 'warn');

      const downloadUrl = (item.downloadUrl || '').trim();
      if (downloadUrl) {
        window.open(downloadUrl, '_blank', 'noopener');
        return;
      }

      notify('Sem downloadUrl retornado pelo back.', 'warn');
    });

    // ===== START =====
    await syncFuncionariosFromAPI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
