// Assets/JS/doc.assinatura.js
// Módulo de Documentos & Assinaturas (wizard + templates + PDF)
// Adaptado do documentos_aba.html para funcionar dentro da aba "Documentos & Assinaturas"
// do seu home.html, usando os botões #btnTemplates e #btnGerarPDF.

(function () {
  'use strict';

  // Só inicializa se a raiz da aba existir
  const docsRoot = document.getElementById('docs-sign-root');
  if (!docsRoot) return;

  /* ========= CONSTANTES/UTILS ========= */

  const VAR_REGEX = /\{\s*([a-zA-Z0-9_.|]+)\s*\}/g;

  // Base da API: usa window.API_BASE se existir; senão mesma origem; se file:// cai no localhost
  const API_BASE = String(
    window.API_BASE ||
      (location.origin && location.origin.startsWith('http') ? location.origin : '')
  ).replace(/\/+$/, '');

  // Endpoint (CRUD) de templates
  const API_TEMPLATES = API_BASE + '/api/documentos-templates';

  const uid = () =>
    String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);

  const escapeHTML = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  function resolvePath(obj, path) {
    try {
      return path
        .split('.')
        .reduce((a, k) => (a && a[k] != null ? a[k] : undefined), obj);
    } catch {
      return undefined;
    }
  }

  function applyPipes(value, pipe) {
    if (value == null) return '';
    const s = String(value);
    switch (pipe) {
      case 'upper':
        return s.toUpperCase();
      case 'lower':
        return s.toLowerCase();
      case 'title':
        return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
      case 'money':
        return Number(s).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        });
      case 'date':
        return new Date(s).toLocaleDateString('pt-BR');
      default:
        return s;
    }
  }

  function replaceVariables(html, data) {
    const today = new Date().toLocaleDateString('pt-BR');
    return html.replace(VAR_REGEX, (_, inner) => {
      const [path, pipe] = String(inner).split('|');
      const val = path === 'hoje' ? today : resolvePath(data, path);
      return applyPipes(val, pipe);
    });
  }

  function extractVariables(html) {
    const set = new Set();
    let m;
    while ((m = VAR_REGEX.exec(html))) {
      set.add(String(m[1]).split('|')[0]);
    }
    return Array.from(set).sort();
  }

  /* ========= FUNCIONÁRIOS =========
     - Primeiro tenta integrar com o sistema (se existir alguma função global).
     - Se não achar nada, usa 2 exemplos mock.
  ================================== */

  function loadFuncionariosFromApp() {
    // Tenta algumas APIs prováveis do seu sistema (se existirem)
    try {
      if (typeof window.getFuncionariosParaDocs === 'function') {
        const r = window.getFuncionariosParaDocs();
        if (Array.isArray(r) && r.length) return r;
      }
      if (typeof window.getFuncionarios === 'function') {
        const r = window.getFuncionarios();
        if (Array.isArray(r) && r.length) return r;
      }
      if (typeof window.getAllFuncionarios === 'function') {
        const r = window.getAllFuncionarios();
        if (Array.isArray(r) && r.length) return r;
      }
      // fallback: usa apenas o usuário logado, se existir getMe()
      if (typeof window.getMe === 'function') {
        const me = window.getMe();
        if (me && typeof me === 'object') {
          return [
            {
              id: me.id || 'me',
              nome: me.nome || 'Usuário atual',
              cpf: me.cpf || '',
              cargo: me.funcao || me.cargo || '',
              salario: me.salario || 0,
              admissao: me.admissao || me.dataAdmissao || '',
              email: me.email || '',
              telefone: me.telefone || '',
              endereco: me.endereco || {
                logradouro: '',
                cidade: me.cidade || '',
                estado: '',
                cep: ''
              }
            }
          ];
        }
      }
    } catch {
      // se algo der errado, cai no mock abaixo
    }
    return null;
  }

  let FUNCIONARIOS =
    loadFuncionariosFromApp() ||
    [
      {
        id: '1',
        nome: 'Colaborador Exemplo 1',
        cpf: '123.456.789-00',
        cargo: 'Analista de RH',
        salario: 5500.75,
        admissao: '2024-03-18',
        email: 'colab1@empresa.com.br',
        telefone: '+55 (11) 99999-0000',
        endereco: {
          logradouro: 'Av. Paulista, 1000',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01310-000'
        },
        ferias: {
          periodo_aquisitivo: '2024-03-18 a 2025-03-17',
          inicio: '2025-12-01',
          fim: '2025-12-30'
        }
      },
      {
        id: '2',
        nome: 'Colaborador Exemplo 2',
        cpf: '987.654.321-00',
        cargo: 'Engenheiro Civil',
        salario: 7800,
        admissao: '2023-08-02',
        email: 'colab2@empresa.com.br',
        telefone: '+55 (11) 98888-7777',
        endereco: {
          logradouro: 'Rua das Flores, 200',
          cidade: 'Campinas',
          estado: 'SP',
          cep: '13000-000'
        }
      }
    ];

  const BUILTIN_TEMPLATES = [
  ];

  /* ========= TEMPLATES (API) =========
   - NÃO usa armazenamento local (conforme pedido).
   - Templates personalizados são carregados/salvos via WebAPI:
     GET/POST/PUT/DELETE /api/documentos-templates
==================================== */

const TEMPLATE_STATE = {
  list: [],              // itens da listagem (sem html)
  loaded: false,
  detailCache: new Map() // id -> detail (com html/layoutJson)
};

async function apiCall(url, { method = 'GET', body = null } = {}) {
  const headers = {
    Accept: 'application/json, text/plain, */*'
  };
  if (body !== null) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body !== null ? JSON.stringify(body) : undefined
  });

  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!res.ok) {
    const msg =
      (data && data.title) ||
      (data && data.detail) ||
      (typeof data === 'string' ? data : null) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

async function loadTemplatesList(ct) {
  const data = await apiCall(API_TEMPLATES, { method: 'GET' });
  const list = Array.isArray(data) ? data : [];
  TEMPLATE_STATE.list = list.map((x) => ({
    id: x.id,
    nome: x.nome,
    dataCriacao: x.dataCriacao,
    usuarioCriacaoId: x.usuarioCriacaoId,
    alteracao: x.alteracao,
    usuarioId: x.usuarioId,
    builtin: false
  }));
  TEMPLATE_STATE.loaded = true;
  return TEMPLATE_STATE.list;
}

async function ensureTemplatesLoaded() {
  if (TEMPLATE_STATE.loaded) return TEMPLATE_STATE.list;
  return loadTemplatesList();
}

function getBuiltInTemplateById(id) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) || null;
}

async function getTemplateDetail(id, { force = false } = {}) {
  // built-in tem HTML local
  const builtin = getBuiltInTemplateById(id);
  if (builtin) return builtin;

  if (!force && TEMPLATE_STATE.detailCache.has(id)) {
    return TEMPLATE_STATE.detailCache.get(id);
  }

  const detail = await apiCall(`${API_TEMPLATES}/${id}`, { method: 'GET' });
  if (detail && detail.id) TEMPLATE_STATE.detailCache.set(detail.id, detail);
  return detail;
}

async function createTemplate(payload) {
  const created = await apiCall(API_TEMPLATES, { method: 'POST', body: payload });
  if (created && created.id) TEMPLATE_STATE.detailCache.set(created.id, created);
  await loadTemplatesList();
  return created;
}

async function updateTemplate(id, payload) {
  const updated = await apiCall(`${API_TEMPLATES}/${id}`, { method: 'PUT', body: payload });
  if (updated && updated.id) TEMPLATE_STATE.detailCache.set(updated.id, updated);
  await loadTemplatesList();
  return updated;
}

async function deleteTemplate(id) {
  await apiCall(`${API_TEMPLATES}/${id}`, { method: 'DELETE' });
  TEMPLATE_STATE.detailCache.delete(id);
  await loadTemplatesList();
  return true;
}

function getTemplatesForSelect() {
  // Para o <select> só precisa id/nome.
  const user = TEMPLATE_STATE.list || [];
  return [...BUILTIN_TEMPLATES, ...user];
}

function getAllTemplatesShallow() {
  // Compat: usado em alguns pontos antigos.
  return getTemplatesForSelect();
}

/* ========= ELEMENTOS (DOM) ========= */

  // Atenção: aqui uso IDs do seu home.html
  const btnTemplates =
    document.getElementById('btnTemplates') ||
    document.getElementById('btn-templates'); // fallback
  const btnOpen =
    document.getElementById('btnGerarPDF') ||
    document.getElementById('btn-open'); // fallback

  const wizard = document.getElementById('wizard');
  const wizardModal = document.getElementById('wizardModal');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const btnClose = document.getElementById('btn-close');
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');
  const btnConcluir = document.getElementById('btn-concluir');

  const templateSel = document.getElementById('template');
  const funcSel = document.getElementById('func');
  const funcWrap = document.getElementById('func-wrap');

  // ======= CORREÇÃO VISUAL DO BLOCO "VINCULAR FUNCIONÁRIO" =======
  // Remove aquele retângulo/fundo azul quando clica nas opções de vínculo
  if (funcWrap) {
    const styleFixVinc = document.createElement('style');
    styleFixVinc.textContent = `
      #func-wrap input[type="radio"],
      #func-wrap input[type="radio"]:focus,
      #func-wrap input[type="radio"]:focus-visible,
      #func-wrap select:focus,
      #func-wrap select:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }
      #func-wrap label {
        user-select: none;
      }
    `;
    document.head.appendChild(styleFixVinc);
  }
  // ===============================================================

  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const varsBox = document.getElementById('vars');
  const chkPrev = document.getElementById('chk-preview');
  const btnClear = document.getElementById('btn-clear');
  const printArea = document.getElementById('print-area');

  // Modal de Templates
  const tplModal = document.getElementById('tplModal');
  const btnCloseTpl = document.getElementById('btn-close-tpl');
  const tplListView = document.getElementById('tplListView');
  const tplEditView = document.getElementById('tplEditView');
  const tplList = document.getElementById('tplList');
  const btnNewTpl = document.getElementById('btn-new-tpl');
  const btnBackList = document.getElementById('btn-back-list');
  const btnSaveTpl = document.getElementById('btn-save-tpl');
  const tplName = document.getElementById('tplName');
  const tplEditor = document.getElementById('tplEditor');
  const docxTpl = document.getElementById('docxTpl');
  const docxTplBtn = document.getElementById('docxTplBtn');
  const docxTplInfo = document.getElementById('docxTplInfo');
  const tplVars = document.getElementById('tplVars');
  const btnClearTpl = document.getElementById('btn-clear-tpl');

  /* ======= ELEMENTOS DE LAYOUT ======= */

  const lyFontFamily = document.getElementById('ly-font-family');
  const lyFontSize = document.getElementById('ly-font-size');
  const lyLineHeight = document.getElementById('ly-line-height');
  const lyPSpacing = document.getElementById('ly-p-spacing');
  const lyH1 = document.getElementById('ly-h1');
  const lyH2 = document.getElementById('ly-h2');
  const lyH3 = document.getElementById('ly-h3');
  const lyPageFormat = document.getElementById('ly-page-format');
  const lyOrientation = document.getElementById('ly-orientation');
  const lyMT = document.getElementById('ly-mt');
  const lyMR = document.getElementById('ly-mr');
  const lyMB = document.getElementById('ly-mb');
  const lyML = document.getElementById('ly-ml');
  const lyLogoEnabled = document.getElementById('ly-logo-enabled');
  const lyLogoSize = document.getElementById('ly-logo-size');
  const lyLogoAlign = document.getElementById('ly-logo-align');
  const lyLogoSpace = document.getElementById('ly-logo-space');
  const lyLogoFile = document.getElementById('ly-logo-file');
  const lyLogoFileBtn = document.getElementById('ly-logo-file-btn');
  const lyLogoFileInfo = document.getElementById('ly-logo-file-info');
  const lySave = document.getElementById('ly-save');
  const lyReset = document.getElementById('ly-reset');
  const lyLogoResizeFirst = document.getElementById('ly-logo-resize-first');

  // Se por algum motivo elementos críticos não existirem, não inicializa
  if (!wizard || !wizardModal || !templateSel || !editor || !preview) {
    return;
  }

  // Estado
  let currentTemplate = BUILTIN_TEMPLATES[0];
  let currentFuncionario = FUNCIONARIOS[0];
  let editingTemplateId = null;

  /* ========= LAYOUT ========= */

  const DEFAULT_LAYOUT = {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 11,
    lineHeight: 1.4,
    paragraphSpacing: 8,
    h1: 1.6,
    h2: 1.3,
    h3: 1.15,
    pageFormat: 'a4',
    orientation: 'p',
    marginTop: 20,
    marginRight: 15,
    marginBottom: 20,
    marginLeft: 15,
    logoEnabled: false,
    logoData: '',
    logoSize: 120,
    logoAlign: 'center',
    logoSpace: 12,
    logoResizeFirst: true
  };

  let LAYOUT = { ...DEFAULT_LAYOUT };

function applyLayoutFromJson(layoutJson) {
  if (!layoutJson) return;
  try {
    const parsed =
      typeof layoutJson === 'string' ? JSON.parse(layoutJson) : layoutJson;
    if (parsed && typeof parsed === 'object') {
      LAYOUT = { ...DEFAULT_LAYOUT, ...parsed };
    }
  } catch {
    // ignora JSON inválido
  }
}

function getLayoutJson() {
  try {
    return JSON.stringify(LAYOUT);
  } catch {
    return null;
  }
}function mmToPt(mm) {
    return mm * (72 / 25.4);
  }

  function ptToPx(pt) {
    return pt * (96 / 72);
  }

  const PAGE_SIZES_PT = {
    a4: { w: 595.28, h: 841.89 },
    letter: { w: 612.0, h: 792.0 }
  };

  function getPageSizePt(layout) {
    const base = PAGE_SIZES_PT[layout.pageFormat] || PAGE_SIZES_PT.a4;
    return layout.orientation === 'l'
      ? { w: base.h, h: base.w }
      : { w: base.w, h: base.h };
  }

  function populateLayoutUI() {
    if (!lyFontFamily) return; // se os campos não existirem, ignora layout

    lyFontFamily.value = LAYOUT.fontFamily;
    lyFontSize.value = LAYOUT.fontSize;
    lyLineHeight.value = LAYOUT.lineHeight;
    lyPSpacing.value = LAYOUT.paragraphSpacing;
    lyH1.value = LAYOUT.h1;
    lyH2.value = LAYOUT.h2;
    lyH3.value = LAYOUT.h3;
    lyPageFormat.value = LAYOUT.pageFormat;
    lyOrientation.value = LAYOUT.orientation;
    lyMT.value = LAYOUT.marginTop;
    lyMR.value = LAYOUT.marginRight;
    lyMB.value = LAYOUT.marginBottom;
    lyML.value = LAYOUT.marginLeft;
    lyLogoEnabled.checked = LAYOUT.logoEnabled;
    lyLogoSize.value = LAYOUT.logoSize;
    lyLogoAlign.value = LAYOUT.logoAlign;
    lyLogoSpace.value = LAYOUT.logoSpace;
    lyLogoFileInfo.textContent = LAYOUT.logoData
      ? 'Imagem carregada'
      : 'Nenhum arquivo selecionado';
    lyLogoResizeFirst.checked = LAYOUT.logoResizeFirst;
  }

  function readLayoutFromUI() {
    if (!lyFontFamily) return;

    LAYOUT.fontFamily = lyFontFamily.value || DEFAULT_LAYOUT.fontFamily;
    LAYOUT.fontSize = Math.max(
      8,
      Math.min(20, Number(lyFontSize.value) || DEFAULT_LAYOUT.fontSize)
    );
    LAYOUT.lineHeight = Math.max(
      1,
      Math.min(2, Number(lyLineHeight.value) || DEFAULT_LAYOUT.lineHeight)
    );
    LAYOUT.paragraphSpacing = Math.max(
      0,
      Math.min(40, Number(lyPSpacing.value) || DEFAULT_LAYOUT.paragraphSpacing)
    );
    LAYOUT.h1 = Number(lyH1.value) || DEFAULT_LAYOUT.h1;
    LAYOUT.h2 = Number(lyH2.value) || DEFAULT_LAYOUT.h2;
    LAYOUT.h3 = Number(lyH3.value) || DEFAULT_LAYOUT.h3;
    LAYOUT.pageFormat = lyPageFormat.value;
    LAYOUT.orientation = lyOrientation.value;
    LAYOUT.marginTop = Number(lyMT.value) || DEFAULT_LAYOUT.marginTop;
    LAYOUT.marginRight = Number(lyMR.value) || DEFAULT_LAYOUT.marginRight;
    LAYOUT.marginBottom = Number(lyMB.value) || DEFAULT_LAYOUT.marginBottom;
    LAYOUT.marginLeft = Number(lyML.value) || DEFAULT_LAYOUT.marginLeft;
    LAYOUT.logoEnabled = !!lyLogoEnabled.checked;
    LAYOUT.logoSize = Math.max(
      24,
      Math.min(600, Number(lyLogoSize.value) || DEFAULT_LAYOUT.logoSize)
    );
    LAYOUT.logoAlign = lyLogoAlign.value;
    LAYOUT.logoSpace = Math.max(
      0,
      Math.min(80, Number(lyLogoSpace.value) || DEFAULT_LAYOUT.logoSpace)
    );
    LAYOUT.logoResizeFirst = !!lyLogoResizeFirst.checked;
  }

  function adjustContentImages(innerHTML) {
    if (!LAYOUT.logoResizeFirst) return innerHTML;
    const temp = document.createElement('div');
    temp.innerHTML = innerHTML;
    const img = temp.querySelector('img');
    if (img) {
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.style.width = 'var(--doc-logo-size)';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.marginBottom = 'var(--doc-logo-space)';

      if (LAYOUT.logoAlign === 'center') {
        img.style.marginLeft = 'auto';
        img.style.marginRight = 'auto';
      } else if (LAYOUT.logoAlign === 'right') {
        img.style.marginLeft = 'auto';
        img.style.marginRight = '0';
      } else {
        img.style.marginLeft = '0';
        img.style.marginRight = 'auto';
      }
    }
    return temp.innerHTML;
  }

  function buildDocHTML(innerHTML) {
    const processedHTML = adjustContentImages(innerHTML);

    const styleVars = `
        --doc-font-size:${LAYOUT.fontSize}px;
        --doc-line-height:${LAYOUT.lineHeight};
        --doc-paragraph-spacing:${LAYOUT.paragraphSpacing}px;
        --doc-font-family:${LAYOUT.fontFamily};
        --doc-h1-scale:${LAYOUT.h1};
        --doc-h2-scale:${LAYOUT.h2};
        --doc-h3-scale:${LAYOUT.h3};
        --doc-logo-size:${LAYOUT.logoSize}px;
        --doc-logo-space:${LAYOUT.logoSpace}px;
      `;
    const logoHTML =
      LAYOUT.logoEnabled && LAYOUT.logoData
        ? `<div class="doc-logo" style="text-align:${LAYOUT.logoAlign}"><img src="${LAYOUT.logoData}" alt="Logo"></div>`
        : '';
    return `<div class="doc-root" style="${styleVars}">${logoHTML}${processedHTML}</div>`;
  }

  function dataURLFromFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ========= SELECTS (Templates + Funcionários) ========= */

  function refreshTemplateSelect() {
  const allBuiltins = [...BUILTIN_TEMPLATES];
  const allUser = TEMPLATE_STATE.list || [];

  templateSel.innerHTML = '';

  allBuiltins.forEach((t) => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.nome;
    templateSel.appendChild(o);
  });

  if (allUser.length) {
    const og = document.createElement('optgroup');
    og.label = '— Personalizados —';
    allUser.forEach((t) => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.nome;
      og.appendChild(o);
    });
    templateSel.appendChild(og);
  }

  const all = [...allBuiltins, ...allUser];
  const wantedId = currentTemplate && currentTemplate.id;
  const exists = wantedId ? all.find((t) => t.id === wantedId) : null;

  // mantém seleção se existir, senão cai no primeiro built-in
  templateSel.value = exists ? wantedId : (allBuiltins[0] && allBuiltins[0].id);
  if (!exists) currentTemplate = allBuiltins[0];
}

function populateFuncionarios() {
    if (!funcSel || !Array.isArray(FUNCIONARIOS) || FUNCIONARIOS.length === 0) {
      return;
    }
    funcSel.innerHTML = '';
    FUNCIONARIOS.forEach((f) => {
      const o = document.createElement('option');
      o.value = f.id;
      o.textContent = f.nome;
      funcSel.appendChild(o);
    });
    currentFuncionario = FUNCIONARIOS[0];
    funcSel.value = currentFuncionario.id;
  }

  /* ========= VARIÁVEIS / PREVIEW ========= */

  const getHTML = () => editor.innerHTML;

  function updateVarsList() {
    const vars = extractVariables(getHTML());
    varsBox.innerHTML = vars.length
      ? vars
          .map((v) => `<span class="pill" data-var="${v}">{${v}}</span>`)
          .join('')
      : `<small class="muted">Nenhuma variável encontrada. Use chaves, ex.: <code>{nome}</code>.</small>`;

    varsBox.querySelectorAll('[data-var]').forEach((el) => {
      el.addEventListener('click', () => {
        insertAtCaret(editor, `{${el.dataset.var}}`);
        editor.focus();
        updateVarsList();
        updatePreview();
      });
    });
  }

  function updatePreview() {
    const data = getVinculo() === 'sim' ? currentFuncionario || {} : {};
    const finalHTML = replaceVariables(getHTML(), data);
    const docHTML = buildDocHTML(finalHTML);

    const page = getPageSizePt(LAYOUT);
    const pageWidthPx = ptToPx(page.w);
    const padTopPx = ptToPx(mmToPt(LAYOUT.marginTop));
    const padRightPx = ptToPx(mmToPt(LAYOUT.marginRight));
    const padBottomPx = ptToPx(mmToPt(LAYOUT.marginBottom));
    const padLeftPx = ptToPx(mmToPt(LAYOUT.marginLeft));

    preview.innerHTML = `
        <div class="preview-page"
             style="width:${pageWidthPx}px; padding:${padTopPx}px ${padRightPx}px ${padBottomPx}px ${padLeftPx}px;">
          ${
            chkPrev && chkPrev.checked
              ? docHTML
              : buildDocHTML(getHTML())
          }
        </div>`;
  }

  function insertAtCaret(container, text) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      container.appendChild(document.createTextNode(text));
      return;
    }
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      container.appendChild(document.createTextNode(text));
      return;
    }
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function getVinculo() {
    const el = document.querySelector('input[name="vinc"]:checked');
    return (el && el.value) || 'sim';
  }

  /* ========= WIZARD (abrir/fechar/navegar) ========= */

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      wizard.style.display = 'flex';
      goStep(1);
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      wizard.style.display = 'none';
    });
  }

  if (wizard) {
    wizard.addEventListener('click', (e) => {
      if (e.target === wizard) wizard.style.display = 'none';
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => goStep(1));
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (isStep(1)) goStep(2);
    });
  }

  if (btnConcluir) {
    btnConcluir.addEventListener('click', exportPDF);
  }

  if (templateSel) {
  templateSel.addEventListener('change', async (e) => {
    const id = e.target.value;

    try {
      const tpl = await getTemplateDetail(id);
      if (!tpl) return;

      currentTemplate = tpl;

      // aplica conteúdo
      editor.innerHTML = tpl.html || '<p><br></p>';

      // aplica layout salvo no template (se existir)
      LAYOUT = { ...DEFAULT_LAYOUT };
      applyLayoutFromJson(tpl.layoutJson);
      populateLayoutUI();

      updateVarsList();
      updatePreview();
    } catch (err) {
      console.error(err);
      alert('Falha ao carregar o template. Veja o console.');
    }
  });
}if (funcSel) {
    funcSel.addEventListener('change', (e) => {
      currentFuncionario =
        FUNCIONARIOS.find((f) => f.id === e.target.value) || FUNCIONARIOS[0];
      updatePreview();
    });
  }

  // Toolbar de formatação
  document.querySelectorAll('.tb-btn[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.execCommand(btn.dataset.cmd, false, null);
    });
  });

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      const text = editor.innerText || '';
      const cleaned = text
        .replace(/\s{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n');
      editor.innerHTML =
        '<p>' +
        cleaned
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean)
          .map(escapeHTML)
          .join('</p><p>') +
        '</p>';
      updatePreview();
    });
  }

  if (chkPrev) {
    chkPrev.addEventListener('change', updatePreview);
  }

  /* ========= PDF COM QUEBRA DE PÁGINA ========= */

  async function exportPDF() {
    try {
      if (typeof html2canvas !== 'function') {
        alert(
          'A biblioteca html2canvas não está carregada. Verifique se o script foi incluído no HTML.'
        );
        return;
      }
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert(
          'A biblioteca jsPDF não está disponível. Verifique se o script foi incluído no HTML.'
        );
        return;
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        unit: 'pt',
        format: LAYOUT.pageFormat,
        orientation: LAYOUT.orientation === 'l' ? 'landscape' : 'portrait',
        compress: true
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const marginTop = mmToPt(LAYOUT.marginTop);
      const marginRight = mmToPt(LAYOUT.marginRight);
      const marginBottom = mmToPt(LAYOUT.marginBottom);
      const marginLeft = mmToPt(LAYOUT.marginLeft);

      const usableW = pageW - marginLeft - marginRight;
      const usableH = pageH - marginTop - marginBottom;

      const data = getVinculo() === 'sim' ? currentFuncionario || {} : {};
      const finalHTML = replaceVariables(getHTML(), data);
      const docHTML = buildDocHTML(finalHTML);

      const wrapper = printArea || document.getElementById('print-area');
      if (!wrapper) {
        alert('Área de impressão (#print-area) não encontrada.');
        return;
      }

      wrapper.innerHTML = `<div id="print-root" style="width:${usableW}px; font-family:Arial, Helvetica, sans-serif;">${docHTML}</div>`;

      const root = document.getElementById('print-root');
      const scale = 2;

      const canvas = await html2canvas(root, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: true,
        logging: false
      });

      const pxPerPt = canvas.width / usableW;
      const pageHeightPx = usableH * pxPerPt;

      let sY = 0;
      let pageIndex = 0;

      while (sY < canvas.height) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - sY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext('2d');

        ctx.drawImage(
          canvas,
          0,
          sY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        const imgData = pageCanvas.toDataURL('image/png');
        const sliceHpt = sliceHeight / pxPerPt;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          imgData,
          'PNG',
          marginLeft,
          marginTop,
          usableW,
          sliceHpt
        );

        sY += sliceHeight;
        pageIndex++;
      }

      pdf.save('documento_atrium.pdf');
      alert('PDF gerado e baixado!');
    } catch (err) {
      console.error(err);
      alert('Falha ao gerar PDF. Veja o console do navegador.');
    }
  }

  /* ========= MODAL TEMPLATES (WORKSPACE + TinyMCE) ========= */
(function initTemplateWorkspace() {
  if (
    !tplModal ||
    !btnTemplates ||
    !tplListView ||
    !tplEditView ||
    !tplList ||
    !tplName ||
    !tplEditor
  ) return;

  // (opcional) zona de drop para .docx
  const editorDropZone = document.getElementById('editorDropZone');

  // Variáveis permitidas no sistema (sidebar fixa)
  const FIXED_VARS = [
    { id: 'nome', label: 'Nome' },
    { id: 'funcao', label: 'Função' },
    { id: 'rg', label: 'RG' },
    { id: 'cpf', label: 'CPF' },
    { id: 'celular', label: 'Celular' },
    { id: 'email', label: 'E-mail' },
    { id: 'idade', label: 'Idade' },
    { id: 'data_admissao', label: 'Data de admissão' },
    { id: 'salario', label: 'Salário' },
    { id: 'tarifa_vt', label: 'Tarifa VT' },
    { id: 'tarifa_vr', label: 'Tarifa VR' },
    { id: 'tipo_contrato', label: 'Tipo de contrato' }
  ];

  // Estado
  let editingTemplateId = null;
  let bodyOverflowBackup = '';

  // ---------- Toast ----------
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) { console.log('[toast]', type, message); return; }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(v) {
    return String((v === null || v === undefined) ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- Helpers modal ----------
  function lockScroll() {
    bodyOverflowBackup = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    document.body.style.overflow = bodyOverflowBackup;
  }

  function openBackdrop(el) {
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
    lockScroll();
  }
  function closeBackdrop(el) {
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    unlockScroll();
  }

  function setView(view) {
    // view: 'list' | 'edit'
    if (view === 'list') {
      tplListView.style.display = 'block';
      tplEditView.style.display = 'none';
    } else {
      tplListView.style.display = 'none';
      tplEditView.style.display = 'flex';
    }
  }

  // ---------- TinyMCE ----------
  function hasTinyMCE() {
    return (
      typeof window.tinymce !== 'undefined' &&
      window.tinymce &&
      typeof window.tinymce.init === 'function'
    );
  }

  function getTiny() {
    try { return window.tinymce.get('tplEditor'); } catch { return null; }
  }

  function ensureTinyMCE() {
    if (!hasTinyMCE()) return Promise.resolve(null);
    const existing = getTiny();
    if (existing) return Promise.resolve(existing);

    const initResult = window.tinymce.init({
      selector: '#tplEditor',
      plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
      toolbar: 'undo redo | fontfamily fontsize blocks | bold italic underline strikethrough superscript subscript | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist | outdent indent | table charmap | removeformat',
      menubar: 'file edit view insert format tools table help',
      height: '100%',
      zindex: 53000,
      promotion: false,
      branding: false,
      resize: false,
      statusbar: true,
      content_style: `
        html { background:#e2e8f0; }
        body {
          background:#ffffff;
          color:#0f172a;
          width:210mm;
          min-height:297mm;
          padding:25mm 20mm;
          margin:20px auto;
          box-shadow:0 10px 30px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.05);
          box-sizing:border-box;
          font-family: 'Times New Roman', Times, serif;
          font-size:12pt;
          line-height:1.5;
        }
        p { margin-top:0; margin-bottom:12pt; }
        h1, h2, h3 { margin-top:18pt; margin-bottom:12pt; font-family: Arial, Helvetica, sans-serif; }
        table { width:100%; border-collapse: collapse; }
        table, th, td { border: 1px solid #cbd5e1; }
        th, td { padding: 6pt; }
      `
    });

    if (initResult && typeof initResult.then === 'function') {
      return initResult.then(() => getTiny());
    }
    return Promise.resolve(getTiny());
  }

  function setEditorContent(html) {
    const tiny = getTiny();
    if (tiny) tiny.setContent(html || '<p><br></p>');
    else tplEditor.innerHTML = html || '<p><br></p>';
  }

  function getEditorContent() {
    const tiny = getTiny();
    if (tiny) return tiny.getContent();
    return String(tplEditor.innerHTML || '').trim();
  }

  function insertVarAtCaret(varId) {
    const text = `{${varId}}`;
    const tiny = getTiny();
    if (tiny) {
      tiny.insertContent(
        `<span style="background-color: rgba(14,165,233,.25); padding:0 2px; border-radius:3px;">${text}</span>`
      );
      tiny.focus();
      setTimeout(() => {
        try {
          const html = tiny
            .getContent({ format: 'html' })
            .replace(/<span[^>]*>\s*(\{[^}]+\})\s*<\/span>/g, '$1');
          tiny.setContent(html);
          tiny.focus();
        } catch { /* noop */ }
      }, 50);
      return;
    }

    // fallback (contenteditable)
    tplEditor.focus();
    document.execCommand('insertText', false, text);
  }

  // ---------- Sidebar vars ----------
  function renderVarsSidebar() {
    if (!tplVars) return;
    tplVars.innerHTML = FIXED_VARS
      .map(
        (v) =>
          `<div class="pill" data-var="${v.id}" title="${v.label}"><i class="fa-solid fa-link"></i> {${v.id}}</div>`
      )
      .join('');

    tplVars.querySelectorAll('.pill').forEach((p) => {
      p.addEventListener('mousedown', (e) => {
        e.preventDefault(); // não perder foco do editor
        insertVarAtCaret(p.dataset.var);
      });
    });
  }

  // ---------- Helpers list ----------
  function varsPreviewFromHtml(html) {
    const set = new Set();
    let m;
    VAR_REGEX.lastIndex = 0;
    while ((m = VAR_REGEX.exec(html || ''))) set.add(String(m[1]).split('|')[0]);
    const arr = Array.from(set);
    if (!arr.length) return 'Sem variáveis detectadas';
    return arr.slice(0, 4).join(', ') + (arr.length > 4 ? '...' : '');
  }

  async function getUserTemplatesDetailed() {
    await ensureTemplatesLoaded();
    const list = TEMPLATE_STATE.list || [];

    // garante detalhes no cache (html/layoutJson)
    await Promise.all(
      list.map((t) =>
        getTemplateDetail(t.id).catch(() => null)
      )
    );

    return list
      .map((t) => TEMPLATE_STATE.detailCache.get(t.id))
      .filter(Boolean)
      .map((d) => ({ ...d, builtin: false }));
  }

  async function renderTplList() {
    const userDetails = await getUserTemplatesDetailed();
    const all = [...BUILTIN_TEMPLATES, ...userDetails];

    if (!all.length) {
      tplList.innerHTML =
        `<p class="muted" style="grid-column:1/-1; text-align:center; padding:40px;">Nenhum template encontrado.</p>`;
      return;
    }

    tplList.innerHTML = all
      .map((t) => {
        const isBuiltin = !!t.builtin;
        const preview = varsPreviewFromHtml(t.html);
        const badge = isBuiltin ? `<span class="tpl-badge">Padrão</span>` : '';

        const actions = isBuiltin
          ? `<button class="btn secondary" data-act="dup" data-id="${t.id}">
               <i class="fa-regular fa-copy" aria-hidden="true"></i> Duplicar
             </button>`
          : `<button class="btn secondary" data-act="edit" data-id="${t.id}">
               <i class="fa-solid fa-pen" aria-hidden="true"></i> Editar
             </button>
             <button class="btn secondary" data-act="dup" data-id="${t.id}">
               <i class="fa-regular fa-copy" aria-hidden="true"></i> Duplicar
             </button>
             <button class="btn danger" data-act="del" data-id="${t.id}">
               <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Excluir
             </button>`;

        return `
          <div class="tpl-item">
            <div class="tpl-item-header">
              <div>
                <strong>${escapeHtml(t.nome || 'Sem nome')}</strong>
                ${badge}
              </div>
            </div>
            <div class="tpl-vars-preview">
              <i class="fa-solid fa-code" style="opacity:.5; margin-right:4px;" aria-hidden="true"></i>
              ${escapeHtml(preview)}
            </div>
            <div class="tpl-actions">
              ${actions}
            </div>
          </div>
        `;
      })
      .join('');

    tplList.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;

        try {
          if (act === 'edit') {
            await openTplEditor(id);
            return;
          }

          if (act === 'dup') {
            // built-in ou custom: sempre cria um novo no banco
            const detail = await getTemplateDetail(id);
            const payload = {
              nome: `${detail.nome} (Cópia)`,
              html: detail.html || '',
              layoutJson: detail.layoutJson || getLayoutJson()
            };
            await createTemplate(payload);

            refreshTemplateSelect();
            await renderTplList();
            showToast('Template duplicado e salvo no banco!', 'success');
            return;
          }

          if (act === 'del') {
            if (!confirm('Deseja excluir este template?')) return;
            await deleteTemplate(id);

            // se estava selecionado no wizard, volta pro primeiro padrão
            if (currentTemplate && currentTemplate.id === id) {
              currentTemplate = BUILTIN_TEMPLATES[0];
              if (templateSel) templateSel.value = currentTemplate.id;
              if (editor) editor.innerHTML = currentTemplate.html;
              LAYOUT = { ...DEFAULT_LAYOUT };
              populateLayoutUI();
              updateVarsList();
              updatePreview();
            }

            refreshTemplateSelect();
            await renderTplList();
            showToast('Template excluído.', 'info');
            return;
          }
        } catch (err) {
          console.error(err);
          showToast('Falha ao executar ação. Veja o console.', 'error');
        }
      });
    });
  }

  // ---------- Open / Close ----------
  async function openTplList() {
    try {
      setView('list');
      openBackdrop(tplModal);
      renderVarsSidebar();
      await renderTplList();
    } catch (err) {
      console.error(err);
      showToast('Falha ao carregar templates do banco.', 'error');
    }
  }

  function closeTplModal() {
    closeBackdrop(tplModal);
    setView('list');
  }

  // click fora (backdrop)
  tplModal.addEventListener('mousedown', (e) => {
    if (e.target === tplModal) closeTplModal();
  });

  // ESC
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (tplModal.classList.contains('show')) closeTplModal();
  });

  // botões
  btnTemplates.addEventListener('click', () => openTplList());
  if (btnCloseTpl) btnCloseTpl.addEventListener('click', closeTplModal);

  if (btnNewTpl)
    btnNewTpl.addEventListener('click', () => {
      openTplEditor(null);
    });

  if (btnBackList)
    btnBackList.addEventListener('click', () => {
      openTplList();
    });

  // ---------- Editor view ----------
  async function openTplEditor(idOrNull) {
    setView('edit');

    let template = null;

    if (idOrNull) {
      const detail = await getTemplateDetail(idOrNull);
      if (detail && detail.builtin) {
        // padrão não edita: duplica
        showToast('Template padrão não pode ser editado. Duplique e edite a cópia.', 'info');
        return openTplList();
      }
      template = detail;
    }

    editingTemplateId = template ? template.id : null;

    tplName.value = template ? template.nome : '';
    const html = template ? template.html : '<p><br></p>';

    // aplica layout salvo do template (se existir)
    LAYOUT = { ...DEFAULT_LAYOUT };
    applyLayoutFromJson(template && template.layoutJson);
    populateLayoutUI();
    updatePreview();

    await ensureTinyMCE();
    setEditorContent(html);

    renderVarsSidebar();

    // reset file label
    const info = document.getElementById('docxTplInfo');
    if (info) info.textContent = 'Importar .docx';
  }

  // ---------- DOCX import ----------
  async function handleDocxImport(file) {
    if (!file) return;
    if (!String(file.name || '').toLowerCase().endsWith('.docx')) {
      showToast('Selecione um arquivo .docx válido.', 'error');
      return;
    }
    if (!window.mammoth) {
      showToast('Biblioteca Mammoth não carregada.', 'error');
      return;
    }

    const info = document.getElementById('docxTplInfo');
    if (info) info.textContent = 'Processando...';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const options = {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh"
        ],
        preserveEmptyParagraphs: true
      };
      const result = await window.mammoth.convertToHtml({ arrayBuffer }, options);
      await ensureTinyMCE();
      setEditorContent(result.value || '<p><br></p>');

      if (info) info.textContent = (file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name);
      showToast('Documento importado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      if (info) info.textContent = 'Importar .docx';
      showToast('Falha ao importar o arquivo. Verifique se o .docx está ok.', 'error');
    }
  }

  if (docxTplBtn && docxTpl) {
    docxTplBtn.addEventListener('click', () => docxTpl.click());
    docxTpl.addEventListener('change', (e) => {
      handleDocxImport(e.target.files?.[0]);
      e.target.value = '';
    });
  }

  if (editorDropZone) {
    editorDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      editorDropZone.classList.add('drag-active');
    });
    editorDropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      editorDropZone.classList.remove('drag-active');
    });
    editorDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      editorDropZone.classList.remove('drag-active');
      const f = e.dataTransfer?.files?.[0];
      if (f) handleDocxImport(f);
    });
  }

  // ---------- Save template (banco) ----------
  if (btnSaveTpl) {
    btnSaveTpl.addEventListener('click', async () => {
      const nome = String(tplName.value || '').trim();
      if (!nome) {
        showToast('Informe o nome do template.', 'error');
        tplName.focus();
        return;
      }

      await ensureTinyMCE();
      const html = getEditorContent();
      if (!html) {
        showToast('O template está vazio.', 'error');
        return;
      }

      // pega o layout atual (se existir UI de layout aberta)
      try { readLayoutFromUI(); } catch { /* ok */ }
      const layoutJson = getLayoutJson();

      try {
        if (editingTemplateId) {
          await updateTemplate(editingTemplateId, { nome, html, layoutJson });
        } else {
          const created = await createTemplate({ nome, html, layoutJson });
          editingTemplateId = created && created.id ? created.id : null;
        }

        refreshTemplateSelect();
        showToast('Template salvo no banco!', 'success');
        openTplList();
      } catch (err) {
        console.error(err);
        showToast('Falha ao salvar template no banco.', 'error');
      }
    });
  }
})();

/* ========= RESIZE DO WIZARD ========= */

  (function enableWizardResize() {
    const modal = wizardModal;
    const resE = document.getElementById('wizardResizeE');
    const resSE = document.getElementById('wizardResizeSE');
    if (!modal || !resE || !resSE) return;

    const limits = {
      minW: 680,
      minH: 480,
      maxW: Math.min(window.innerWidth * 0.98, 1600),
      maxH: Math.min(window.innerHeight * 0.95, 1200)
    };
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    let startX = 0,
      startY = 0,
      startW = 0,
      startH = 0,
      mode = null;

    function onMove(e) {
      if (!mode) return;
      if (mode === 'e' || mode === 'se') {
        const nw = clamp(
          startW + (e.clientX - startX),
          limits.minW,
          limits.maxW
        );
        modal.style.width = nw + 'px';
      }
      if (mode === 'se') {
        const nh = clamp(
          startH + (e.clientY - startY),
          limits.minH,
          limits.maxH
        );
        modal.style.height = nh + 'px';
        modal.style.maxHeight = '95vh';
      }
    }

    function stop() {
      mode = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', stop);
    }

    function start(e, m) {
      mode = m;
      startX = e.clientX;
      startY = e.clientY;
      const r = modal.getBoundingClientRect();
      startW = r.width;
      startH = r.height;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', stop);
    }

    resE.addEventListener('mousedown', (e) => start(e, 'e'));
    resSE.addEventListener('mousedown', (e) => start(e, 'se'));
    window.addEventListener('resize', () => {
      limits.maxW = Math.min(window.innerWidth * 0.98, 1600);
      limits.maxH = Math.min(window.innerHeight * 0.95, 1200);
    });
  })();

  /* ========= LISTENERS DE LAYOUT ========= */

  [
    lyFontFamily,
    lyFontSize,
    lyLineHeight,
    lyPSpacing,
    lyH1,
    lyH2,
    lyH3,
    lyPageFormat,
    lyOrientation,
    lyMT,
    lyMR,
    lyMB,
    lyML,
    lyLogoEnabled,
    lyLogoSize,
    lyLogoAlign,
    lyLogoSpace,
    lyLogoResizeFirst
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => {
      readLayoutFromUI();
      updatePreview();
    });
    el.addEventListener('change', () => {
      readLayoutFromUI();
      updatePreview();
    });
  });

  if (lyLogoFileBtn && lyLogoFile) {
    lyLogoFileBtn.addEventListener('click', () => lyLogoFile.click());
  }

  if (lyLogoFile) {
    lyLogoFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      lyLogoFileInfo.textContent = file
        ? file.name
        : 'Nenhum arquivo selecionado';
      if (!file) return;
      try {
        LAYOUT.logoData = await dataURLFromFile(file);
        updatePreview();
      } catch (err) {
        console.error(err);
        alert('Falha ao carregar a imagem do logo');
      }
    });
  }

  if (lySave) {
    lySave.addEventListener('click', () => {
      readLayoutFromUI();
      alert('Layout aplicado nesta sessão. Para persistir no banco, salve o template no gerenciador (Templates → Salvar).');
    });
  }

if (lyReset) {
    lyReset.addEventListener('click', () => {
      LAYOUT = { ...DEFAULT_LAYOUT };
      populateLayoutUI();
      updatePreview();
    });
  }

  /* ========= INICIALIZAÇÃO ========= */

(async function initDocumentoTemplates() {
  // Carrega templates personalizados do banco (se estiver autenticado).
  try {
    await ensureTemplatesLoaded();
  } catch (err) {
    // Se der 401/403, o sistema ainda funciona com templates padrão.
    console.warn('[templates] não foi possível carregar templates do banco:', err);
  }

  refreshTemplateSelect();
  populateFuncionarios();

  if (currentTemplate && editor) {
    editor.innerHTML = currentTemplate.html;
  }

  populateLayoutUI();
  updateVarsList();
  updatePreview();
})();// Navegação do wizard
  function isStep(n) {
    return (
      (n === 1 && step1 && step1.style.display !== 'none') ||
      (n === 2 && step2 && step2.style.display !== 'none')
    );
  }

  // ========= AJUSTE DA ALTURA / SCROLL NO STEP 2 =========
  function goStep(n) {
    if (!step1 || !step2 || !btnNext || !btnConcluir) return;

    if (n === 1) {
      // Etapa 1: escolha de template / funcionário
      step1.style.display = '';
      step2.style.display = 'none';
      btnNext.style.display = '';
      btnConcluir.style.display = 'none';

      if (wizardModal) {
        // volta a altura padrão e tira qualquer corte
        wizardModal.style.height = '';
        wizardModal.style.maxHeight = '95vh';
        wizardModal.style.overflow = 'visible';
      }
    } else {
      // Etapa 2: edição do documento / layout
      step1.style.display = 'none';
      step2.style.display = '';
      btnNext.style.display = 'none';
      btnConcluir.style.display = '';

      if (wizardModal) {
        // deixa a modal crescer conforme o conteúdo e permitir scroll se passar da tela
        wizardModal.style.height = '';
        wizardModal.style.maxHeight = '95vh';
        wizardModal.style.overflow = 'auto';
      }

      // garante que o preview é recalculado com o layout visível da etapa 2
      updatePreview();
    }
  }
  // ======================================================
})();
