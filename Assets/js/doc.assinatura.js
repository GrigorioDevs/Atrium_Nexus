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
  const LS_KEY = 'ATRIUM_TEMPLATES_V1';
  const LS_LAYOUT = 'ATRIUM_LAYOUT_V1';

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
    {
      id: 'builtin_contrato',
      nome: 'Contrato de Trabalho – Padrão',
      html: `
          <h2 style="text-align:center">CONTRATO DE TRABALHO</h2>
          <p>Empregador: <strong>Atrium Tecnologia LTDA</strong></p>
          <p>Empregado: <strong>{nome}</strong>, CPF {cpf}, residente em {endereco.logradouro}, {endereco.cidade}/{endereco.estado}.</p>
          <p>O empregado exercerá a função de <strong>{cargo}</strong>, com salário mensal de {salario|money}, a partir de {admissao|date}.</p>
          <p>E-mail: {email} — Telefone: {telefone}</p>
          <p>Este contrato entra em vigor na data de {hoje}.</p>
      `,
      builtin: true
    },
    {
      id: 'builtin_ferias',
      nome: 'Aviso de Férias',
      html: `
          <h2 style="text-align:center">AVISO DE FÉRIAS</h2>
          <p>Colaborador(a): <strong>{nome}</strong> — CPF {cpf}</p>
          <p>Período aquisitivo: {ferias.periodo_aquisitivo}</p>
          <p>Período de gozo: {ferias.inicio|date} a {ferias.fim|date}</p>
          <p>Local: {endereco.cidade} — Data: {hoje}</p>
      `,
      builtin: true
    }
  ];

  /* ========= STORAGE ========= */

  const loadUserTemplates = () => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const saveUserTemplates = (list) =>
    localStorage.setItem(LS_KEY, JSON.stringify(list));

  const getAllTemplates = () => [...BUILTIN_TEMPLATES, ...loadUserTemplates()];

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
  let currentTemplate = getAllTemplates()[0];
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

  let LAYOUT = loadLayout() || { ...DEFAULT_LAYOUT };

  function loadLayout() {
    try {
      const raw = localStorage.getItem(LS_LAYOUT);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_LAYOUT, ...parsed };
    } catch {
      return null;
    }
  }

  function saveLayout() {
    localStorage.setItem(LS_LAYOUT, JSON.stringify(LAYOUT));
    alert('Configurações de layout salvas como padrão!');
  }

  function mmToPt(mm) {
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
    const allUser = loadUserTemplates();

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
    const exists = all.find((t) => t.id === (currentTemplate && currentTemplate.id));
    templateSel.value = exists ? currentTemplate.id : all[0] && all[0].id;
    if (!exists) currentTemplate = all[0];
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
    templateSel.addEventListener('change', (e) => {
      const id = e.target.value;
      const all = getAllTemplates();
      currentTemplate = all.find((t) => t.id === id) || all[0];
      editor.innerHTML = currentTemplate.html;
      updateVarsList();
      updatePreview();
    });
  }

  if (funcSel) {
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

  /* ========= MODAL TEMPLATES (CRUD localStorage) ========= */

  const openTplList = () => {
    if (!tplModal) return;
    tplModal.style.display = 'flex';
    if (tplListView) tplListView.style.display = '';
    if (tplEditView) tplEditView.style.display = 'none';
    renderTplList();
  };

  const closeTpl = () => {
    if (tplModal) tplModal.style.display = 'none';
  };

  if (btnTemplates) {
    btnTemplates.addEventListener('click', openTplList);
  }

  if (btnCloseTpl) {
    btnCloseTpl.addEventListener('click', closeTpl);
  }

  if (tplModal) {
    tplModal.addEventListener('click', (e) => {
      if (e.target === tplModal) closeTpl();
    });
  }

  if (btnNewTpl) {
    btnNewTpl.addEventListener('click', () => openTplEditor());
  }

  if (btnBackList) {
    btnBackList.addEventListener('click', openTplList);
  }

  function renderTplList() {
    if (!tplList) return;
    const all = getAllTemplates();
    tplList.innerHTML = all
      .map((t) => {
        const isBuiltin = !!t.builtin;
        const actions = isBuiltin
          ? `<button class="btn tiny-btn" data-act="use" data-id="${t.id}">Usar</button>
             <button class="btn secondary tiny-btn" data-act="dup" data-id="${t.id}">Duplicar</button>`
          : `<button class="btn tiny-btn" data-act="use" data-id="${t.id}">Usar</button>
             <button class="btn secondary tiny-btn" data-act="edit" data-id="${t.id}">Editar</button>
             <button class="btn secondary tiny-btn" data-act="dup" data-id="${t.id}">Duplicar</button>
             <button class="btn secondary tiny-btn" data-act="del" data-id="${t.id}">Excluir</button>`;
        return `<div class="item">
                  <div>
                    <div class="name">${t.nome}${
          isBuiltin ? ' <span class="tiny">(padrão)</span>' : ''
        }</div>
                    <div class="tiny">${
                      extractVariables(t.html)
                        .map((v) => `{${v}}`)
                        .join(' • ') || '— sem variáveis —'
                    }</div>
                  </div>
                  <div style="display:flex;gap:6px">${actions}</div>
                </div>`;
      })
      .join('');

    tplList.querySelectorAll('[data-act]').forEach((btn) => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      btn.addEventListener('click', () => {
        const all = getAllTemplates();
        const tpl = all.find((x) => x.id === id);
        if (!tpl) return;

        if (act === 'use') {
          currentTemplate = tpl;
          refreshTemplateSelect();
          templateSel.value = tpl.id;
          editor.innerHTML = tpl.html;
          updateVarsList();
          updatePreview();
          if (tplModal) tplModal.style.display = 'none';
          if (wizard) wizard.style.display = 'flex';
          goStep(1);
        } else if (act === 'edit') {
          openTplEditor(tpl);
        } else if (act === 'dup') {
          const user = loadUserTemplates();
          const copy = {
            id: uid(),
            nome: tpl.nome + ' (cópia)',
            html: tpl.html
          };
          saveUserTemplates([...user, copy]);
          renderTplList();
          refreshTemplateSelect();
          alert('Template duplicado.');
        } else if (act === 'del') {
          if (!confirm('Excluir este template?')) return;
          const user = loadUserTemplates().filter((x) => x.id !== id);
          saveUserTemplates(user);
          renderTplList();
          refreshTemplateSelect();
        }
      });
    });
  }

  function openTplEditor(template = null) {
    editingTemplateId = template && template.id ? template.id : null;
    if (tplListView) tplListView.style.display = 'none';
    if (tplEditView) tplEditView.style.display = '';
    if (tplName) tplName.value = (template && template.nome) || '';
    if (tplEditor)
      tplEditor.innerHTML =
        (template && template.html) || '<p>Digite/cole seu conteúdo aqui…</p>';
    updateTplVars();
    if (docxTpl) docxTpl.value = '';
    if (docxTplInfo) docxTplInfo.textContent = 'Nenhum arquivo selecionado';
  }

  if (docxTplBtn && docxTpl) {
    docxTplBtn.addEventListener('click', () => docxTpl.click());
  }

  if (docxTpl) {
    docxTpl.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (docxTplInfo) {
        docxTplInfo.textContent = file ? file.name : 'Nenhum arquivo selecionado';
      }
      if (!file) return;
      if (!/\.docx$/i.test(file.name)) {
        alert('Selecione um arquivo .docx');
        return;
      }
      if (!window.mammoth) {
        alert(
          'A biblioteca Mammoth (mammoth.browser.min.js) não está carregada. Sem ela não é possível importar .docx.'
        );
        return;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.convertToHtml({ arrayBuffer });
        tplEditor.innerHTML =
          result.value || '<p>(Documento sem conteúdo)</p>';
        updateTplVars();
      } catch (err) {
        console.error(err);
        alert('Falha ao importar o .docx');
      }
    });
  }

  function updateTplVars() {
    if (!tplVars || !tplEditor) return;
    const vars = extractVariables(tplEditor.innerHTML);
    tplVars.innerHTML = vars.length
      ? vars
          .map((v) => `<span class="pill" data-var="${v}">{${v}}</span>`)
          .join('')
      : `<small class="muted">Nenhuma variável detectada. Você pode digitar variáveis usando {chaves}.</small>`;
    tplVars.querySelectorAll('[data-var]').forEach((el) => {
      el.addEventListener('click', () => {
        insertAtCaret(tplEditor, `{${el.dataset.var}}`);
        tplEditor.focus();
        updateTplVars();
      });
    });
  }

  if (btnClearTpl && tplEditor) {
    btnClearTpl.addEventListener('click', () => {
      const text = tplEditor.innerText || '';
      const cleaned = text
        .replace(/\s{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n');
      tplEditor.innerHTML =
        '<p>' +
        cleaned
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean)
          .map(escapeHTML)
          .join('</p><p>') +
        '</p>';
      updateTplVars();
    });
  }

  if (btnSaveTpl) {
    btnSaveTpl.addEventListener('click', () => {
      const nome = (tplName.value || '').trim();
      if (!nome) {
        alert('Dê um nome ao template.');
        return;
      }
      const html = tplEditor.innerHTML;
      const user = loadUserTemplates();

      if (editingTemplateId) {
        const idx = user.findIndex((t) => t.id === editingTemplateId);
        if (idx >= 0) user[idx] = { ...user[idx], nome, html };
        else user.push({ id: editingTemplateId, nome, html });
        saveUserTemplates(user);
        alert('Template atualizado!');
      } else {
        user.push({ id: uid(), nome, html });
        saveUserTemplates(user);
        alert('Template criado!');
      }
      refreshTemplateSelect();
      openTplList();
    });
  }

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
      saveLayout();
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

  refreshTemplateSelect();
  populateFuncionarios();
  if (currentTemplate && editor) {
    editor.innerHTML = currentTemplate.html;
  }
  populateLayoutUI();
  updateVarsList();
  updatePreview();

  // Navegação do wizard
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
