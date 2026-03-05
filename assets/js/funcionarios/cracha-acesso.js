// Assets/JS/cracha-acesso.js
// CRACHÁ DE ACESSO (modalCracha) — LAYOUT ORIGINAL (SEM FORÇAR GRID/TAMANHO)
// ✅ Mantém o visual "como era antes" (quem manda é o CSS do módulo cracha.css)
// ✅ Cursos em tópicos (sem quebrar o cartão) + Texto em MAIÚSCULO
// ✅ Impressão "igual ao preview" (escala automática para caber em 86mm x 54mm sem recortar)
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Base da API
  const API_BASE = String(window.API_BASE || '').replace(/\/+$/, '');

  const modalCracha     = $('modalCracha');
  const btnFecharCracha = $('btnFecharCracha');
  const btnCrachaGerar  = $('btnCrachaGerar');

  const crachaFoto      = $('crachaFoto');
  const crachaNome      = $('crachaNome');
  const crachaCpf       = $('crachaCpf');
  const crachaFuncao    = $('crachaFuncao');
  const crachaCursos    = $('crachaCursos');
  const crachaContrato  = $('crachaContrato');

  const notify =
    (window.notify && typeof window.notify === 'function')
      ? window.notify
      : (msg) => alert(msg);

  let crachaAbort = null;

  // =========================
  // Helpers
  // =========================
  function apiUrl(path) {
    const b = API_BASE.replace(/\/+$/, '');
    if (b.toLowerCase().endsWith('/api') && String(path).startsWith('/api/')) {
      return b.slice(0, -4) + path;
    }
    return b + path;
  }

  function upper(v) {
    const s = String(v ?? '').trim();
    return s ? s.toUpperCase() : '';
  }

  function onlyDigits(v) {
    return String(v ?? '').replace(/\D+/g, '');
  }

  function formatCPF(v) {
    const d = onlyDigits(v);
    if (d.length !== 11) return v ? String(v) : '—';
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function pick(obj, keys, fallback = '') {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return fallback;
  }

  function cleanMeaningfulText(val) {
    const s = upper(val);
    if (!s) return '';
    const bad = new Set([
      '—', '-', 'N/A', 'NA',
      'NÃO INFORMADO', 'NAO INFORMADO',
      'NÃO DEFINIDO', 'NAO DEFINIDO',
      'SEM INFORMAÇÃO', 'SEM INFORMACAO'
    ]);
    return bad.has(s) ? '' : s;
  }

  function mapContrato(val) {
    const raw = String(val ?? '').trim();
    if (!raw) return '';
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n === 1) return 'CLT';
    if (n === 2) return 'PJ';
    return '';
  }

  function getCursosArray(val) {
    if (Array.isArray(val)) {
      return val
        .map((c) => String(c?.nome ?? c?.Nome ?? c ?? '').trim())
        .filter(Boolean);
    }
    if (val === null || val === undefined) return [];
    const s = String(val).trim();
    if (!s || s === '—') return [];
    return s
      .split(/[,;\n]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // Cursos como lista (tópicos) — sem explodir o layout
  function renderCursos(el, cursosArr) {
    if (!el) return;
    el.innerHTML = '';

    const arr = (Array.isArray(cursosArr) ? cursosArr : [])
      .map((x) => upper(x))
      .filter(Boolean);

    if (arr.length === 0) {
      el.textContent = 'NÃO POSSUI CURSOS';
      return;
    }

    const MAX_ITENS = 4; // ajuste se quiser mais/menos
    const ul = document.createElement('ul');
    ul.className = 'cracha-cursos-list';
    ul.style.listStyle = 'disc';
    ul.style.paddingLeft = '18px';
    ul.style.margin = '0';

    const show = arr.slice(0, MAX_ITENS);
    for (const nome of show) {
      const li = document.createElement('li');
      li.textContent = nome;
      ul.appendChild(li);
    }
    if (arr.length > MAX_ITENS) {
      const li = document.createElement('li');
      li.textContent = `+ ${arr.length - MAX_ITENS} CURSO(S)`;
      ul.appendChild(li);
    }

    el.appendChild(ul);
  }

  function defaultAvatar() {
    try {
      if (typeof window.defaultAvatarDataURL === 'function') {
        return window.defaultAvatarDataURL();
      }
    } catch {}

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#00E0FF"/>
            <stop offset="1" stop-color="#FF2FB9"/>
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="24" fill="url(#g)" opacity="0.25"/>
        <circle cx="64" cy="50" r="22" fill="#cfe0ef"/>
        <rect x="24" y="78" width="80" height="34" rx="17" fill="#cfe0ef"/>
      </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  }

  function setTextUpper(el, txt, fallback = '—') {
    if (!el) return;
    const raw = String(txt ?? '').trim();
    el.textContent = raw ? raw.toUpperCase() : String(fallback).toUpperCase();
  }

  async function fetchJson(url, signal) {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
      signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
    }
    return await res.json();
  }

  async function fetchFotoAsDataURL(url, signal) {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      signal
    });
    if (!res.ok) throw new Error(`Foto HTTP ${res.status}`);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('Falha ao ler foto (FileReader).'));
      r.readAsDataURL(blob);
    });
    return dataUrl;
  }

  // =========================
  // Modal open/close
  // =========================
  function showCracha() {
    if (!modalCracha) return;
    modalCracha.style.display = 'flex';
    modalCracha.classList.add('open');
    modalCracha.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
  }

  function hideCracha() {
    if (!modalCracha) return;
    try { crachaAbort?.abort(); } catch {}
    crachaAbort = null;
    modalCracha.style.display = 'none';
    modalCracha.classList.remove('open');
    modalCracha.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
  }

  // =========================
  // Preencher dados
  // =========================
  function fillCracha(obj) {
    const f = obj || {};

    const nome = upper(pick(f, ['nome', 'Nome', 'nomeCompleto', 'NomeCompleto'], 'Funcionário')) || 'FUNCIONÁRIO';
    const cpfRaw = pick(f, ['cpf', 'CPF', 'Cpf'], '');
    const cpf = formatCPF(cpfRaw);

    const funcao = upper(pick(f, ['funcao', 'Funcao', 'cargo', 'Cargo'], '—')) || '—';

    const cursosVal = (f?.cursos ?? f?.Cursos ?? f?.cursosDescricao ?? f?.CursosDescricao);
    const cursosArr = getCursosArray(cursosVal);

    const contratoTextoRaw = pick(f, ['tipoContratoTexto', 'TipoContratoTexto', 'contratoTexto', 'ContratoTexto'], '');
    const contratoTexto = cleanMeaningfulText(contratoTextoRaw);

    const contratoNumero = pick(f, ['tipoContrato', 'TipoContrato', 'contrato', 'Contrato'], '');
    const mapped = mapContrato(contratoNumero);

    const contrato = contratoTexto || mapped;

    const fotoDataUrl = String(pick(f, ['fotoDataUrl', 'FotoDataUrl'], '')).trim();
    const fotoFinal = fotoDataUrl || defaultAvatar();

    if (crachaFoto) {
      try { crachaFoto.crossOrigin = 'anonymous'; } catch {}
      crachaFoto.src = fotoFinal;
      crachaFoto.alt = `FOTO DE ${nome}`;
      // NÃO mexe em tamanho/estilo aqui — deixa pro CSS do módulo cracha.css
    }

    setTextUpper(crachaNome, nome, 'FUNCIONÁRIO');
    setTextUpper(crachaCpf, cpf, '—');
    setTextUpper(crachaFuncao, funcao, '—');
    renderCursos(crachaCursos, cursosArr);
    setTextUpper(crachaContrato, contrato, 'TIPO DE CONTRATO NÃO INFORMADO');
  }

  // =========================
  // Carregar dados via API
  // =========================
  async function loadCrachaFromApi(funcionarioId, seed = null) {
    try { crachaAbort?.abort(); } catch {}
    crachaAbort = new AbortController();
    const { signal } = crachaAbort;

    if (seed) {
      fillCracha(seed);
    } else {
      fillCracha({
        nome: 'Carregando...',
        cpf: '',
        funcao: '—',
        cursos: [],
        tipoContratoTexto: '',
        fotoDataUrl: defaultAvatar()
      });
    }

    const urlCracha = apiUrl(`/api/funcionarios/${encodeURIComponent(funcionarioId)}/cracha`);
    const dto = await fetchJson(urlCracha, signal);

    let fotoDataUrl = '';
    try {
      const urlFoto = apiUrl(`/api/funcionarios/${encodeURIComponent(funcionarioId)}/foto`);
      fotoDataUrl = await fetchFotoAsDataURL(urlFoto, signal);
    } catch {
      fotoDataUrl = defaultAvatar();
    }

    fillCracha({ ...dto, fotoDataUrl });
  }

  // =========================
  // Função global
  // =========================
  window.openCrachaFuncionario = function (funcionario) {
    if (!funcionario) {
      notify('Funcionário não encontrado para o crachá.', 'warn');
      return;
    }

    const id =
      (typeof funcionario === 'number' || typeof funcionario === 'string')
        ? Number(funcionario)
        : Number(funcionario?.id ?? funcionario?.Id ?? funcionario?.funcionarioId ?? funcionario?.FuncionarioId);

    showCracha();

    if (!id || Number.isNaN(id)) {
      fillCracha(funcionario);
      notify('Aviso: não encontrei o ID do funcionário para buscar dados completos do verso.', 'warn');
      return;
    }

    loadCrachaFromApi(id, (typeof funcionario === 'object' ? funcionario : null))
      .catch((err) => {
        console.error('[Cracha] Erro ao carregar via API:', err);
        if (typeof funcionario === 'object') fillCracha(funcionario);
        notify('Não foi possível carregar os dados do crachá. Verifique a API.', 'warn');
      });
  };

  // =========================
  // Events
  // =========================
  btnFecharCracha?.addEventListener('click', hideCracha);
  modalCracha?.addEventListener('click', (e) => {
    if (e.target === modalCracha) hideCracha();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalCracha && modalCracha.style.display === 'flex') {
      hideCracha();
    }
  });

  // =========================
  // GERAR / IMPRIMIR — "IGUAL AO PREVIEW" (SEM RECORTAR)
  // - Mede o tamanho real do cartão em tela (CSS atual)
  // - Congela esse tamanho no clone
  // - Escala para caber exatamente em 86mm x 54mm (ID-1)
  // =========================
  btnCrachaGerar?.addEventListener('click', () => {
    if (!modalCracha) return;

    const card = modalCracha.querySelector('.cracha-card');
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const cardW = Math.max(1, Math.round(rect.width));
    const cardH = Math.max(1, Math.round(rect.height));

    // mm -> px (CSS pixels em 96dpi)
    const mmToPx = (mm) => (mm / 25.4) * 96;
    const targetW = mmToPx(86);
    const targetH = mmToPx(54);

    // escala para caber (sem recortar)
    const scale = Math.min(targetW / cardW, targetH / cardH);

    const cardClone = card.cloneNode(true);
    // congela tamanho do clone para o print ficar idêntico ao preview
    cardClone.style.width = `${cardW}px`;
    cardClone.style.height = `${cardH}px`;
    cardClone.style.maxWidth = 'none';
    cardClone.style.maxHeight = 'none';

    // pega CSS carregado (links + <style>) para preservar o mesmo visual
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => n.outerHTML)
      .join('\n');

    const win = window.open('', '_blank', 'width=980,height=720');
    if (!win) return;

    const doc = win.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Imprimir Crachá</title>
  ${styles}
  <style>
    @page{
      size: 86mm 54mm;
      margin: 0;
    }
    html, body{
      width: 86mm;
      height: 54mm;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      overflow: hidden !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page{
      position: relative;
      width: 86mm;
      height: 54mm;
      overflow: hidden;
      background: #fff;
    }
    .scale-wrap{
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(${scale});
      transform-origin: center;
    }
    /* Some com botões */
    button, .btn, .no-print, ::-webkit-scrollbar{
      display:none !important;
    }
    /* Ajuda no recorte (opcional) */
    .print-cut{
      position:absolute;
      inset:0;
      border: 0.2mm dashed rgba(0,0,0,.22);
      pointer-events:none;
    }
    /* Garante foto certinha */
    img{
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <div class="print-page">
    <div class="scale-wrap">${cardClone.outerHTML}</div>
    <div class="print-cut"></div>
  </div>

  <script>
    (function(){
      const imgs = Array.from(document.images || []);
      const waitImgs = Promise.all(imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => { img.onload = img.onerror = res; });
      }));
      waitImgs.then(() => setTimeout(() => window.print(), 250));
    })();
  </script>
</body>
</html>`);
    doc.close();
    win.focus();
  });
})();
