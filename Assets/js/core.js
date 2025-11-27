'use strict';

/* ===================== REFS BÁSICAS ===================== */

// Atalho para pegar elemento por id
function $(id) {
  return document.getElementById(id);
}

/* ===================== UTILS ===================== */

const two = (n) => String(n).padStart(2, '0');

const toYMD = (d) =>
  d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());

const fromYMD = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

const nowTime = () => {
  const n = new Date();
  return `${two(n.getHours())}:${two(n.getMinutes())}:${two(n.getSeconds())}`;
};

const todayYMD = () => toYMD(new Date());

const diffHHMM = (mins) => {
  const sign = mins < 0 ? '-' : '';
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return sign + two(h) + ':' + two(m);
};

const brDate = (d) =>
  d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

const escapeHTML = (str) =>
  String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m])
  );

const bytesHuman = (b) => {
  if (b < 1024) return b + ' B';
  const kb = b / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  const mb = kb / 1024;
  return mb.toFixed(1) + ' MB';
};

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tipo-' + Date.now();

/* ===================== TOAST / ALERT ===================== */

// container de toasts (é criado se não existir)
const toastRoot =
  document.getElementById('toastContainer') ||
  (() => {
    const div = document.createElement('div');
    div.id = 'toastContainer';
    document.body.appendChild(div);
    return div;
  })();

function notify(message, type = 'info', { duration = 3400 } = {}) {
  if (!window.__nativeAlert) {
    // preserva o alert nativo antes de qualquer override
    window.__nativeAlert = window.alert.bind(window);
  }

  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `
    <div class="msg">${escapeHTML(String(message))}</div>
    <span class="close">&times;</span>
  `;
  toastRoot.appendChild(el);

  // animação
  setTimeout(() => el.classList.add('show'), 10);

  const t = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, duration);

  el.querySelector('.close').onclick = () => {
    clearTimeout(t);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  };
}

// substitui alert() padrão para usar o toast
window.alert = (msg) => notify(msg, 'info');

/* ===================== STORAGE KEYS ===================== */

const LS_KEYS = {
  ME: 'rh_me',
  PUNCHES: 'batimentos',
  FUNCS: 'rh_funcionarios'
};

const KEY_DOC_TEMPLATES = 'rh_doc_templates';
const KEY_DOC_LAYOUT = 'rh_doc_layout';
const KEY_DOCS_IMPORT = 'rh_docs_important'; // por funcionário
const KEY_ALERTS = 'rh_alerts';
// documentos simples anexados (por funcionário)
const KEY_GEN_DOCS = 'rh_docs_general';

// VT/VR (as funções que usam isso continuam no home.js por enquanto)
const KEY_VT_SETTINGS = 'rh_benef_vt_settings';
const KEY_VT_MAP = 'rh_benef_vt';
const KEY_VR_SETTINGS = 'rh_benef_vr_settings';
const KEY_VR_MAP = 'rh_benef_vr';

/* ===================== STORAGE HELPERS ===================== */

const getMe = () =>
  JSON.parse(
    localStorage.getItem(LS_KEYS.ME) ||
      '{"nome":"Gustavo (exemplo)","funcao":"Colaborador"}'
  );

const setMe = (o) =>
  localStorage.setItem(LS_KEYS.ME, JSON.stringify(o || {}));

const getAllPunches = () =>
  JSON.parse(localStorage.getItem(LS_KEYS.PUNCHES) || '[]');

const setAllPunches = (a) =>
  localStorage.setItem(LS_KEYS.PUNCHES, JSON.stringify(a || []));

const getTemplates = () =>
  JSON.parse(localStorage.getItem(KEY_DOC_TEMPLATES) || '[]');

const setTemplates = (a) =>
  localStorage.setItem(KEY_DOC_TEMPLATES, JSON.stringify(a || []));

const getImpDocsMap = () =>
  JSON.parse(localStorage.getItem(KEY_DOCS_IMPORT) || '{}');

const setImpDocsMap = (o) =>
  localStorage.setItem(KEY_DOCS_IMPORT, JSON.stringify(o || {}));

// documentos simples anexos gerais
const getGenDocsMap = () =>
  JSON.parse(localStorage.getItem(KEY_GEN_DOCS) || '{}');

const setGenDocsMap = (o) =>
  localStorage.setItem(KEY_GEN_DOCS, JSON.stringify(o || {}));

const getAlerts = () =>
  JSON.parse(localStorage.getItem(KEY_ALERTS) || '[]');

const setAlerts = (a) =>
  localStorage.setItem(KEY_ALERTS, JSON.stringify(a || []));

// gerador de ids simples
const uid = (p = 'id') =>
  `${p}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
