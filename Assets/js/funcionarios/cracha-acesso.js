// Assets/JS/cracha-acesso.js
// CRACHÁ DE ACESSO (modalCracha) — UNIFICADO + API (VERSO + FOTO) + TODO TEXTO EM MAIÚSCULO
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Base da API (fixado pra dev; se setar window.API_BASE no HTML ele usa)
  const API_BASE = String(window.API_BASE || 'http://localhost:5253').replace(/\/+$/, '');

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

  // Abort para evitar corrida quando clica rápido
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

  // ✅ Normaliza textos que vêm "vazios disfarçados"
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

  // ✅ Agora retorna vazio quando não for CLT/PJ (para cair no fallback)
  function mapContrato(val) {
    const raw = String(val ?? '').trim();
    if (!raw) return '';
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n === 1) return 'CLT';
    if (n === 2) return 'PJ';
    return '';
  }

  // transforma cursos em array de nomes
  function getCursosArray(val) {
    // backend ideal: cursos: [{ nome, ... }]
    if (Array.isArray(val)) {
      return val
        .map((c) => String(c?.nome ?? c?.Nome ?? '').trim())
        .filter(Boolean);
    }

    if (val === null || val === undefined) return [];

    const s = String(val).trim();
    if (!s || s === '—') return [];

    // aceita "NR-10, NR-35" ou linhas
    return s
      .split(/[,;\n]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // renderiza cursos como tópicos (bolinha) e em MAIÚSCULO
  function renderCursos(el, cursosArr) {
    if (!el) return;

    el.innerHTML = '';

    if (!Array.isArray(cursosArr) || cursosArr.length === 0) {
      el.textContent = 'NÃO POSSUI CURSOS';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'cracha-cursos-list';
    ul.style.listStyle = 'disc';
    ul.style.paddingLeft = '18px';
    ul.style.margin = '0';

    for (const nome of cursosArr) {
      const li = document.createElement('li');
      li.textContent = upper(nome);
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
    el.textContent = raw ? raw.toUpperCase() : fallback.toUpperCase();
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

    // CPF mantém formatação, mas força maiúsculo (não muda nada)
    const cpfRaw = pick(f, ['cpf', 'CPF', 'Cpf'], '');
    const cpf = formatCPF(cpfRaw);

    const funcao = upper(pick(f, ['funcao', 'Funcao', 'cargo', 'Cargo'], '—')) || '—';

    // Cursos em tópicos
    const cursosVal = (f?.cursos ?? f?.Cursos ?? f?.cursosDescricao ?? f?.CursosDescricao);
    const cursosArr = getCursosArray(cursosVal);

    // ✅ CONTRATO: se não vier válido, mostrar "TIPO DE CONTRATO NÃO INFORMADO"
    const contratoTextoRaw = pick(f, ['tipoContratoTexto', 'TipoContratoTexto', 'contratoTexto', 'ContratoTexto'], '');
    const contratoTexto = cleanMeaningfulText(contratoTextoRaw);

    const contratoNumero = pick(f, ['tipoContrato', 'TipoContrato', 'contrato', 'Contrato'], '');
    const mapped = mapContrato(contratoNumero);

    const contrato = contratoTexto || mapped; // se vazio, cai no fallback do setTextUpper

    // Foto
    const fotoDataUrl = String(pick(f, ['fotoDataUrl', 'FotoDataUrl'], '')).trim();
    const fotoFinal = fotoDataUrl || defaultAvatar();

    if (crachaFoto) {
      try { crachaFoto.crossOrigin = 'anonymous'; } catch {}
      crachaFoto.src = fotoFinal;
      crachaFoto.alt = `FOTO DE ${nome}`;
    }

    setTextUpper(crachaNome, nome, 'FUNCIONÁRIO');
    setTextUpper(crachaCpf, cpf, '—');
    setTextUpper(crachaFuncao, funcao, '—');

    renderCursos(crachaCursos, cursosArr);

    // ✅ regra aplicada aqui
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
  // Função global chamada pelo funcionarios.js
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
  // Events: fechar
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
  // GERAR / IMPRIMIR CARTÃO (PDF)
  // =========================
  btnCrachaGerar?.addEventListener('click', () => {
    if (!modalCracha) return;
    const card = modalCracha.querySelector('.cracha-card');
    if (!card) return;

    const htmlCard = card.outerHTML;

    const win = window.open('', '_blank', 'width=900,height=600');
    if (!win) return;

    const doc = win.document;
    doc.open();
    doc.write(`
      <html>
      <head>
        <meta charset="utf-8">
        <title>CRACHÁ DE ACESSO - RCR ENGENHARIA</title>
        <style>
          *{ box-sizing:border-box; margin:0; padding:0; }
          @page{ size: A4; margin: 0; }
          body{
            margin:0; padding:24px;
            background:#050b12; color:#e4edf7;
            font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            display:flex; align-items:center; justify-content:center;
            text-transform: uppercase;
          }
          .cracha-card{
            width:640px; max-width:100%;
            border-radius:20px; padding:22px 24px;
            background:
              linear-gradient(#050b12,#050b12) padding-box,
              linear-gradient(135deg,#00E0FF,#FF2FB9) border-box;
            border:2px solid transparent;
            box-shadow:0 18px 45px rgba(0,0,0,.75);
            display:flex; gap:18px;
          }
          .cracha-left{
            min-width:210px; padding-right:18px;
            border-right:1px solid rgba(255,255,255,.07);
            display:flex; flex-direction:column; align-items:center; gap:10px;
          }
          .cracha-foto-wrap{
            width:180px; height:180px;
            border-radius:24px; padding:3px;
            background:
              linear-gradient(#050b12,#050b12) padding-box,
              linear-gradient(135deg,#00E0FF,#FF2FB9) border-box;
            border:2px solid transparent;
            overflow:hidden;
            display:flex; align-items:center; justify-content:center;
          }
          .cracha-foto-wrap img{ width:100%; height:100%; object-fit:cover; }
          .cracha-nome{ font-weight:800; font-size:18px; text-align:center; }
          .cracha-cpf{ font-size:13px; opacity:.85; }

          .cracha-right{ flex:1; display:flex; flex-direction:column; gap:10px; }
          .cracha-field{ font-size:13px; display:flex; flex-direction:column; }
          .cracha-field .label{
            font-size:11px; text-transform:uppercase; letter-spacing:.08em;
            background:#1d4ed8; padding:2px 8px; border-radius:999px;
            align-self:flex-start; margin-bottom:4px;
          }
          .cracha-field .value{ font-size:14px; font-weight:600; }

          .cracha-cursos-list{ list-style: disc; padding-left: 18px; margin:0; }
          .cracha-cursos-list li{ margin: 2px 0; }

          .cracha-footer{
            margin-top:auto; padding-top:14px;
            border-top:1px dashed rgba(148,163,184,.6);
            display:flex; justify-content:flex-end; align-items:center;
            font-size:12px;
          }
          .cracha-empresa-sec{ font-weight:600; color:#60a5fa; }
          .cracha-footer button{ display:none !important; }

          @media print{
            body{ padding:0; background:#000; }
            .cracha-card{ box-shadow:none; }
          }
        </style>
      </head>
      <body>
        ${htmlCard}
        <script>
          window.onload = function(){ window.print(); };
        <\/script>
      </body>
      </html>
    `);
    doc.close();
  });
})();
