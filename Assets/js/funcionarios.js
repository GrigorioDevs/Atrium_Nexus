/* ===================== FUNCIONÁRIOS ===================== */
(() => {
  'use strict';

  // Refs de DOM usadas neste módulo
  const $ = (id) => document.getElementById(id);

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

  const impDocsTable = $('impDocsTable');
  const btnAddImpDoc = $('btnAddImpDoc');
  const impDocFile = $('impDocFile');
  const impDocName = $('impDocName');
  const impDocType = $('impDocType');
  const impDocIssue = $('impDocIssue');
  const impDocDue = $('impDocDue');

  // (Documentos simples antigos – não usamos mais a tabela, agora é explorer)
  const genDocsTable = $('genDocsTable');
  const btnAddGenDoc = $('btnAddGenDoc');
  const genDocFile = $('genDocFile');

  const notifDot = $('notifDot');
  const btnAlerts = $('btnAlerts');
  const modalAlerts = $('modalAlerts');
  const btnCloseAlerts = $('btnCloseAlerts');
  const alertsTable = $('alertsTable');

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
  const btnSalvarCadastro = $('btnSalvarCadastro');
  const btnLimparCadastro = $('btnLimparCadastro');

  // ====== Explorer de arquivos (Documentos do funcionário) ======
  const feTree = $('feTree');
  const feList = $('feList');
  const fePath = $('fePath');
  const feUpload = $('feUpload');
  const feBtnNewFolder = $('feBtnNewFolder');
  const feBtnRename = $('feBtnRename');
  const feBtnDelete = $('feBtnDelete');
  const feBtnCopy = $('feBtnCopy');
  const feBtnPaste = $('feBtnPaste');
  const feBtnDownload = $('feBtnDownload'); // botão "Baixar"
  const cadCell = $('cadCell');


  let feCurrentEmpId = null;      // funcionário atual
  let feCurrentFolderId = null;   // null = raiz
  let feSelection = null;         // { type:'folder'|'file', id }
  let feCopyBuffer = null;        // { empId, type, id }

  // ========= CONTEXTO (Segurança do Trabalho x Gestão de Funcionários) =========
  // Segurança do Trabalho = aba #tabFuncionarios
  // Gestão de Funcionários = aba #tabFuncGestao
  function getEmpContext() {
    if (!empGrid) return 'unknown';
    if (empGrid.closest('#tabFuncionarios')) return 'seguranca';
    if (empGrid.closest('#tabFuncGestao')) return 'gestao';
    return 'unknown';
  }

// FORMATAÇÃO EMAIL//

document.getElementById('cadEmail')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\s+/g, '');
});

// FORMATAÇÃO RG E CPF  //

function onlyDigits(s){ return String(s || '').replace(/\D+/g,''); }

// mantém cursor ao aplicar máscara
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

/* ========= CPF ========= */
function maskCPFLive(value){
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function formatCPF(value){
  const d = onlyDigits(value);
  if (d.length !== 11) return '';
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function isValidCPF(value){
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false; // 00000000000 etc.

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11); if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11); if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

/* ========= RG (somente máscara no padrão 00.000.000-0) ========= */
function maskRGLive(value){
  const d = onlyDigits(value).slice(0, 9); // 9 dígitos: 00.000.000-0
  if (!d) return '';
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}-${d.slice(8)}`;
}

function formatRG(value){
  const d = onlyDigits(value);
  if (d.length !== 9) return ''; // se quiser aceitar outros tamanhos, eu ajusto
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}-${d.slice(8)}`;
}


// CPF: máscara ao vivo + validação no blur
cadCPF?.addEventListener('input', (e) => {
  const el = e.target;
  const caret = el.selectionStart ?? el.value.length;
  const digitsBefore = onlyDigits(el.value.slice(0, caret)).length;
  applyMaskedWithCaret(el, maskCPFLive(el.value), digitsBefore);
});

cadCPF?.addEventListener('blur', () => {
  const raw = (cadCPF.value || '').trim();
  if (!onlyDigits(raw)) { cadCPF.value = ''; return; }

  const fmt = formatCPF(raw);
  if (!fmt || !isValidCPF(raw)) {
    notify?.('CPF inválido.', 'warn');
    // mantém o que o usuário digitou (já mascarado), ou limpe se preferir:
    // cadCPF.value = '';
    return;
  }
  cadCPF.value = fmt;
});

// RG: máscara ao vivo + checagem simples de tamanho no blur
cadRG?.addEventListener('input', (e) => {
  const el = e.target;
  const caret = el.selectionStart ?? el.value.length;
  const digitsBefore = onlyDigits(el.value.slice(0, caret)).length;
  applyMaskedWithCaret(el, maskRGLive(el.value), digitsBefore);
});

cadRG?.addEventListener('blur', () => {
  const raw = (cadRG.value || '').trim();
  if (!onlyDigits(raw)) { cadRG.value = ''; return; }

  const fmt = formatRG(raw);
  if (!fmt) {
    notify?.('RG incompleto. Use 9 dígitos no padrão 00.000.000-0.', 'warn');
    return;
  }
  cadRG.value = fmt;
});




// ============= FORMATAÇÃO CELULAR ============== //

  function onlyDigits(s) {
  return String(s || '').replace(/\D+/g, '');
}

// máscara enquanto digita/cola (vai “montando” o formato)
function maskBRPhoneLive(value) {
  const d = onlyDigits(value).slice(0, 11); // limita em 11 dígitos
  if (!d) return '';

  if (d.length < 3) return `(${d}`;
  const dd = d.slice(0, 2);
  const rest = d.slice(2);

  // 10 dígitos (fixo) -> (DD) 1234-5678
  // 11 dígitos (cel)  -> (DD) 91234-5678
  if (rest.length <= 4) return `(${dd}) ${rest}`;
  if (rest.length <= 8) return `(${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

// formatação final (para salvar/normalizar). Retorna '' se inválido.
function formatBRPhone(value) {
  const d = onlyDigits(value);
  if (!(d.length === 10 || d.length === 11)) return '';

  const dd = d.slice(0, 2);
  const rest = d.slice(2);

  if (rest.length === 9) return `(${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `(${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

// mantém o cursor “no lugar” ao aplicar máscara
function applyMaskedWithCaret(inputEl, maskedValue, digitsBeforeCaret) {
  inputEl.value = maskedValue;
  if (!Number.isFinite(digitsBeforeCaret)) return;

  // acha posição do cursor onde a quantidade de dígitos à esquerda bate
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
    const masked = maskBRPhoneLive(el.value);
    applyMaskedWithCaret(el, masked, digitsBefore);
  });

  // ao sair do campo, “fecha” no formato final ou limpa se inválido
  cadCell?.addEventListener('blur', () => {
    const raw = cadCell.value || '';
    if (!onlyDigits(raw)) { cadCell.value = ''; return; }
    const fmt = formatBRPhone(raw);
    cadCell.value = fmt || ''; // se inválido, limpa (ou você pode manter e avisar)
  });cadCell?.addEventListener('input', (e) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = onlyDigits(el.value.slice(0, caret)).length;
    const masked = maskBRPhoneLive(el.value);
    applyMaskedWithCaret(el, masked, digitsBefore);
  });

  // ao sair do campo, “fecha” no formato final ou limpa se inválido
  cadCell?.addEventListener('blur', () => {
    const raw = cadCell.value || '';
    if (!onlyDigits(raw)) { cadCell.value = ''; return; }
    const fmt = formatBRPhone(raw);
    cadCell.value = fmt || ''; // se inválido, limpa (ou você pode manter e avisar)
  });

  if (!empGrid && !modalFuncionario && !modalCadastroUsuario) {
    return;
  }

  /* ===================== DADOS / UTIL ===================== */

  const funcionariosSeed = [
    {
      id: 'f1',
      nome: 'Luana Ferreira',
      idade: 28,
      funcao: 'Assistente de RH',
      cargo: 'Assistente de RH',
      salario: 3200,
      optVR: true,
      optVT: true,
      foto: '',
      ativo: true
    },
    {
      id: 'f2',
      nome: 'Bruno Martins',
      idade: 35,
      funcao: 'Engenheiro Civil',
      cargo: 'Engenheiro',
      salario: 6800,
      optVR: false,
      optVT: true,
      foto: '',
      ativo: true
    }
  ];

  function getFuncionariosLS() {
    let arr = JSON.parse(localStorage.getItem(LS_KEYS.FUNCS) || 'null');
    if (!Array.isArray(arr) || arr.length === 0) {
      arr = funcionariosSeed;
      localStorage.setItem(LS_KEYS.FUNCS, JSON.stringify(arr));
    }
    arr.forEach((f, i) => {
      if (!f.id) f.id = 'fid_' + i;
      if (typeof f.celular === 'undefined') f.celular = '';
      f.celular = formatBRPhone(f.celular) || '';
      if (typeof f.ativo === 'undefined') f.ativo = true;
      if (typeof f.cargo === 'undefined') f.cargo = f.funcao || '';
      if (typeof f.salario !== 'number') f.salario = 0;
      if (typeof f.optVR === 'undefined') f.optVR = false;
      if (typeof f.optVT === 'undefined') f.optVT = false;
    });
    localStorage.setItem(LS_KEYS.FUNCS, JSON.stringify(arr));
    return arr;
  }

  function setFuncionariosLS(arr) {
    localStorage.setItem(LS_KEYS.FUNCS, JSON.stringify(arr || []));
  }

  function defaultAvatarDataURL() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00E0FF"/><stop offset="1" stop-color="#FF2FB9"/></linearGradient></defs>
        <rect width="128" height="128" rx="24" fill="url(#g)" opacity="0.25"/>
        <circle cx="64" cy="50" r="22" fill="#cfe0ef"/>
        <rect x="24" y="78" width="80" height="34" rx="17" fill="#cfe0ef"/>
      </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  }

  // Título muda dependendo do contexto (Segurança não “promete” que dá pra trocar)
  function photoOrFallback(url) {
    const ctx = typeof getEmpContext === 'function' ? getEmpContext() : 'unknown';
    const canChange = ctx === 'gestao';
    const titleImg = canChange ? 'Clique para alterar foto' : 'Foto do funcionário';
    const titleDiv = canChange ? 'Clique para adicionar foto' : 'Foto do funcionário';

    return url && url.trim()
      ? `<img class="emp-avatar" src="${url}" alt="Foto" title="${titleImg}">`
      : `<div class="emp-avatar" title="${titleDiv}"></div>`;
  }

  // ==== Helper genérico: converte qualquer File em DataURL ====
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // ==== Helper específico pra FOTO (reduz JPG/PNG pra caber no localStorage) ====
  async function imageFileToDataURL(file) {
    const dataURL = await fileToDataURL(file);

    // se não for imagem, só devolve o que veio
    if (!file.type || !file.type.startsWith('image/')) return dataURL;

    // SVG costuma ser bem pequeno, não precisa redimensionar
    if (file.type === 'image/svg+xml') return dataURL;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 512; // tamanho máximo em px (largura/altura)
        let { width, height } = img;
        if (width <= MAX && height <= MAX) {
          return resolve(dataURL); // já está pequeno, usa como está
        }

        const ratio = Math.min(MAX / width, MAX / height);
        const newW = Math.round(width * ratio);
        const newH = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, newW, newH);

        const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const outData = canvas.toDataURL(outType, 0.85); // 85% quality pra jpeg
        resolve(outData);
      };
      img.onerror = () => resolve(dataURL); // se der BO, usa original mesmo
      img.src = dataURL;
    });
  }

  /* ===================== LISTA / BUSCA ===================== */

  function renderFuncionarios(q = '') {
    if (!empGrid) return;
    const all = getFuncionariosLS();
    const term = q.trim().toLowerCase();
    const list =
      term.length > 0
        ? all.filter((f) => f.nome.toLowerCase().includes(term))
        : all;

    empGrid.innerHTML =
      list
        .map((f) => {
          const inactiveClass = f.ativo ? '' : 'inactive';
          const offBadge = f.ativo ? '' : `<span class="emp-badge-off">INATIVO</span>`;
          const nameSafe = escapeHTML(f.nome);
          const roleSafe = escapeHTML(f.funcao);

          const menu = `
          <div class="emp-menu" data-id="${f.id}" title="Opções" aria-haspopup="menu" aria-expanded="false">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </div>
          <div class="emp-menu-dropdown" data-menu="${f.id}" role="menu">
            ${
              f.ativo
                ? `<button data-action="desativar" data-id="${f.id}">
                     <i class="fa-regular fa-circle-xmark"></i> Desativar
                   </button>`
                : `<button data-action="ativar" data-id="${f.id}">
                     <i class="fa-regular fa-circle-check"></i> Ativar
                   </button>`
            }
          </div>`;

          return `
          <div class="emp-card ${inactiveClass}" data-id="${f.id}">
            ${menu}
            ${offBadge}
            ${photoOrFallback(f.foto)}
            <div>
              <div class="emp-name">${nameSafe}</div>
              <div class="emp-role">${roleSafe} • ${escapeHTML(String(f.idade))} anos</div>
            </div>
          </div>`;
        })
        .join('') || `<div style="color:#9fb1c3">Nenhum funcionário encontrado.</div>`;
  }
  renderFuncionarios();

  function syncSearchInputs(val) {
    try {
      if (typeof val !== 'string') val = '';
      if (funcSearch && funcSearch.value !== val) funcSearch.value = val;
      if (funcSearchGestao && funcSearchGestao.value !== val)
        funcSearchGestao.value = val;
    } catch {}
  }

  funcSearch?.addEventListener('input', (e) => {
    syncSearchInputs(e.target.value);
    renderFuncionarios(e.target.value);
  });

  funcClear?.addEventListener('click', () => {
    syncSearchInputs('');
    renderFuncionarios('');
  });

  funcSearchBtn?.addEventListener('click', () =>
    renderFuncionarios(funcSearch?.value || '')
  );

  funcSearchGestao?.addEventListener('input', (e) => {
    syncSearchInputs(e.target.value);
    renderFuncionarios(e.target.value);
  });

  funcClearGestao?.addEventListener('click', () => {
    syncSearchInputs('');
    renderFuncionarios('');
  });

  funcSearchGestaoBtn?.addEventListener('click', () =>
    renderFuncionarios(funcSearchGestao?.value || '')
  );

  /* ===================== MODAL FUNCIONÁRIO ===================== */

  let currentEmpId = null;
  let currentEmpContext = 'unknown'; // 'seguranca' ou 'gestao'

  /* Mini-modal “Documentos importantes” */
  let impDocsMiniModal = null;

  function ensureImpDocsMiniModal() {
    if (impDocsMiniModal) return impDocsMiniModal;
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.id = 'modalImpDocs';
    wrap.innerHTML = `
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="impDocsTitle">
        <div class="modal-header" id="impDocsTitle">Documentos importantes</div>
        <div class="modal-body" id="impDocsMiniBody"></div>
        <div class="modal-footer">
          <button class="btn btn-light" id="btnCloseImpDocs">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) closeImpDocsMini();
    });

    document.addEventListener('keydown', (e) => {
      if (wrap.style.display === 'flex' && e.key === 'Escape') closeImpDocsMini();
    });

    wrap.querySelector('#btnCloseImpDocs')?.addEventListener('click', () =>
      closeImpDocsMini()
    );

    impDocsMiniModal = wrap;
    return impDocsMiniModal;
  }

  function openImpDocsMini() {
    const modal = ensureImpDocsMiniModal();
    const pane = $('paneDocsImportantes');
    const body = $('impDocsMiniBody');
    if (!pane || !body) return;

    if (body.children.length === 0) {
      while (pane.firstChild) body.appendChild(pane.firstChild);
    }
    renderImpDocsTable();
    modal.style.display = 'flex';
  }

  function closeImpDocsMini(silent = false) {
    if (!impDocsMiniModal) return;
    const pane = $('paneDocsImportantes');
    const body = $('impDocsMiniBody');
    if (pane && body && body.children.length > 0) {
      while (body.firstChild) pane.appendChild(body.firstChild);
    }
    impDocsMiniModal.style.display = 'none';
    if (!silent) {
      document
        .querySelectorAll('#modalFuncionario .emp-tab-btn')
        .forEach((b) => b.classList.remove('active'));
      $('btnTabDocsSimples')?.classList.add('active');
      document
        .querySelectorAll('#modalFuncionario .emp-pane')
        .forEach((p) => p.classList.remove('active'));
      $('paneDocsSimples')?.classList.add('active');
    }
  }

  // Alternância das abas do modal do funcionário
  modalFuncionario?.addEventListener('click', (e) => {
    const btn = e.target.closest('.emp-tab-btn');
    if (!btn) return;
    e.preventDefault();

    const targetSel = btn.getAttribute('data-target');

    if (targetSel === '#paneDocsImportantes') {
      openImpDocsMini();
      return;
    }

    document
      .querySelectorAll('#modalFuncionario .emp-tab-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    document
      .querySelectorAll('#modalFuncionario .emp-pane')
      .forEach((p) => p.classList.remove('active'));
    const pane = document.querySelector(targetSel);
    if (pane) pane.classList.add('active');
  });

  function openFuncionario(empId) {
    const all = getFuncionariosLS();
    const f = all.find((x) => x.id === empId);
    if (!f) return;
    currentEmpId = f.id;
    currentEmpContext = getEmpContext(); // guarda se veio de Segurança ou Gestão

    if (funcModalNome) funcModalNome.textContent = f.nome;
    if (funcModalFuncao)
      funcModalFuncao.textContent = `${f.funcao} • ${f.idade} anos`;
    if (funcModalAvatar) {
      funcModalAvatar.src = f.foto || defaultAvatarDataURL();
      funcModalAvatar.title = 'Clique para alterar a foto';
      funcModalAvatar.style.cursor = 'pointer';
    }

    document
      .querySelectorAll('#modalFuncionario .emp-tab-btn')
      .forEach((b) => b.classList.remove('active'));
    document
      .querySelectorAll('#modalFuncionario .emp-pane')
      .forEach((p) => p.classList.remove('active'));
    $('btnTabDocsSimples')?.classList.add('active');
    $('paneDocsSimples')?.classList.add('active');

    closeImpDocsMini(true);

    // Explorer de arquivos
    initFileExplorerForEmp(currentEmpId);

    // Documentos importantes
    renderImpDocsTable();

    modalFuncionario && (modalFuncionario.style.display = 'flex');
  }

  function closeFuncionario() {
    closeImpDocsMini(true);
    modalFuncionario && (modalFuncionario.style.display = 'none');
  }
  fecharFuncionario?.addEventListener('click', closeFuncionario);

  /* ===================== MENU DE AÇÕES / FOTO ===================== */

  function closeAllEmpMenus() {
    document
      .querySelectorAll('.emp-menu-dropdown.open')
      .forEach((el) => el.classList.remove('open'));
    document
      .querySelectorAll('.emp-menu[aria-expanded="true"]')
      .forEach((el) => el.setAttribute('aria-expanded', 'false'));
  }

  function toggleEmpMenu(id) {
    const dd = document.querySelector(
      `.emp-menu-dropdown[data-menu="${id}"]`
    );
    const btn = document.querySelector(`.emp-menu[data-id="${id}"]`);
    if (!dd || !btn) return;
    const willOpen = !dd.classList.contains('open');
    closeAllEmpMenus();
    if (willOpen) {
      dd.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  // Respeita contexto: Segurança NÃO pode ativar/desativar
  function setFuncionarioAtivo(id, ativo) {
    if (getEmpContext() === 'seguranca') {
      notify('Alterar status só é permitido na Gestão de Funcionários.', 'warn');
      return;
    }
    const arr = getFuncionariosLS();
    const idx = arr.findIndex((f) => f.id === id);
    if (idx < 0) return;
    arr[idx].ativo = !!ativo;
    setFuncionariosLS(arr);
    notify(
      ativo ? 'Funcionário ativado.' : 'Funcionário desativado.',
      'success'
    );
    renderFuncionarios(funcSearch?.value || '');
    renderVT();
    renderVR();
  }

  // Respeita contexto: Segurança NÃO pode excluir
  function excluirFuncionario(id) {
    if (getEmpContext() === 'seguranca') {
      notify('Excluir funcionário só é permitido na Gestão de Funcionários.', 'warn');
      return;
    }

    const arr = getFuncionariosLS();
    const f = arr.find((x) => x.id === id);
    if (!f) return;
    if (!confirm(`Excluir definitivamente “${f.nome}”?`)) return;

    const novo = arr.filter((x) => x.id !== id);
    setFuncionariosLS(novo);

    try {
      const vrMap = getVRMap();
      delete vrMap[id];
      setVRMap(vrMap);
      const vtMap = getVTMap();
      delete vtMap[id];
      setVTMap(vtMap);
      const imp = getImpDocsMap();
      delete imp[id];
      setImpDocsMap(imp);
      const gen = getGenDocsMap();
      delete gen[id];
      setGenDocsMap(gen);
      const alerts = getAlerts().filter((a) => a.empId !== id);
      setAlerts(alerts);
      updateNotifDot();
    } catch {}

    if (currentEmpId === id) {
      currentEmpId = null;
      modalFuncionario && (modalFuncionario.style.display = 'none');
    }

    notify('Funcionário excluído.', 'success');
    renderFuncionarios(funcSearch?.value || '');
    renderVT();
    renderVR();
  }

  // seletor de foto reutilizável (trocar foto pelo card/modal)
  let hiddenPhotoInput = null;

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

  async function changePhotoForEmp(empId) {
    // Segurança do Trabalho não pode trocar foto
    if (getEmpContext() === 'seguranca') {
      notify('Alterar foto só é permitido na Gestão de Funcionários.', 'warn');
      return;
    }

    const input = ensureHiddenPhotoInput();
    input.value = '';
    input.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const dataURL = await imageFileToDataURL(f);
        const arr = getFuncionariosLS();
        const idx = arr.findIndex((x) => x.id === empId);
        if (idx >= 0) {
          arr[idx].foto = dataURL;
          try {
            setFuncionariosLS(arr);
          } catch (err) {
            console.error(err);
            return notify(
              'Não foi possível salvar a foto (armazenamento cheio).',
              'error'
            );
          }
          renderFuncionarios(funcSearch?.value || '');
          if (currentEmpId === empId && funcModalAvatar)
            funcModalAvatar.src = dataURL;
          notify('Foto atualizada.', 'success');
        }
      } catch {
        notify('Não foi possível carregar a imagem.', 'error');
      }
    };
    input.click();
  }

  // Avatar clicável no modal
  funcModalAvatar?.addEventListener('click', () => {
    if (!currentEmpId) return;
    if (currentEmpContext === 'seguranca') {
      notify('Alterar foto só é permitido na Gestão de Funcionários.', 'warn');
      return;
    }
    changePhotoForEmp(currentEmpId);
  });

  // Eventos na grid de funcionários
  empGrid?.addEventListener('click', (e) => {
    const ctx = getEmpContext();

    // Clique na foto/placeholder -> alterar foto
    const avatar = e.target.closest('.emp-avatar');
    if (avatar) {
      e.stopPropagation();
      if (ctx === 'seguranca') {
        notify('Alterar foto só é permitido na Gestão de Funcionários.', 'warn');
        return;
      }
      const card = e.target.closest('.emp-card');
      const id = card?.getAttribute('data-id');
      if (id) changePhotoForEmp(id);
      return;
    }

    const onMenuBtn = e.target.closest('.emp-menu');
    const onMenuDD = e.target.closest('.emp-menu-dropdown');
    const onAction = e.target.closest('.emp-menu-dropdown [data-action]');

    // 3 pontinhos
    if (onMenuBtn) {
      e.stopPropagation();
      if (ctx === 'seguranca') {
        notify('Ativar, desativar ou excluir só é permitido na Gestão de Funcionários.', 'warn');
        return;
      }
      const id = onMenuBtn.getAttribute('data-id');
      toggleEmpMenu(id);
      return;
    }

    // Dentro do dropdown sem ação
    if (onMenuDD && !onAction) {
      e.stopPropagation();
      return;
    }

    // Ações do dropdown
    if (onAction) {
      e.stopPropagation();
      if (ctx === 'seguranca') {
        notify('Ativar, desativar ou excluir só é permitido na Gestão de Funcionários.', 'warn');
        return;
      }
      const act = onAction.getAttribute('data-action');
      const id = onAction.getAttribute('data-id');
      if (act === 'desativar') setFuncionarioAtivo(id, false);
      if (act === 'ativar') setFuncionarioAtivo(id, true);
      if (act === 'excluir') excluirFuncionario(id);
      closeAllEmpMenus();
      return;
    }

    // Clique no card -> abre modal (permitido em ambos contextos)
    const card = e.target.closest('.emp-card');
    if (!card) return;
    const id = card.getAttribute('data-id');
    if (id) openFuncionario(id);
  });

  // Fechar menus clicando fora
  document.addEventListener('click', (e) => {
    if (
      !e.target.closest('.emp-menu') &&
      !e.target.closest('.emp-menu-dropdown')
    ) {
      closeAllEmpMenus();
    }
  });

  /* ===================== DOCUMENTOS IMPORTANTES ===================== */

  async function fileToDataURL_imp(file) {
    const MAX = 4 * 1024 * 1024;
    if (file.size > MAX) {
      notify(
        'Arquivo grande (>' + MAX / 1024 / 1024 + 'MB). Considere armazenar fora do navegador.',
        'warn'
      );
    }
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function renderImpDocsTable() {
    if (!impDocsTable) return;
    const map = getImpDocsMap();
    const list = map[currentEmpId] || [];
    if (!list.length) {
      impDocsTable.innerHTML = `<tr><td colspan="5" style="color:#9fb1c3">Nenhum documento importante.</td></tr>`;
      return;
    }
    impDocsTable.innerHTML = list
      .map((d, idx) => {
        const issue = d.issue ? new Date(d.issue + 'T00:00:00') : null;
        const due = d.due ? new Date(d.due + 'T00:00:00') : null;
        const issueLabel = issue
          ? `${two(issue.getDate())}/${two(issue.getMonth() + 1)}/${issue.getFullYear()}`
          : '—';
        const dueLabel = due
          ? `${two(due.getDate())}/${two(due.getMonth() + 1)}/${due.getFullYear()}`
          : '—';
        const bellIcon = d.subscribed
          ? 'fa-solid fa-bell'
          : 'fa-regular fa-bell';
        const bellTitle = d.subscribed
          ? 'Lembrete ativado'
          : 'Ativar lembrete';
        return `<tr>
          <td style="text-align:left">${escapeHTML(
            d.name || '(sem nome)'
          )}</td>
          <td>${escapeHTML(d.type || '—')}</td>
          <td>${issueLabel}</td>
          <td>${dueLabel}</td>
          <td>
            ${
              d.dataURL
                ? `<a class="btn btn-light" href="${d.dataURL}" download="${encodeURIComponent(
                    d.name || 'documento'
                  )}" target="_blank"><i class="fa-solid fa-download"></i> Baixar</a>`
                : ''
            }
            <button class="btn btn-light" data-imp-sub="${idx}" title="${bellTitle}">
              <i class="${bellIcon}"></i>
            </button>
            <button class="btn btn-ghost" data-imp-del="${idx}"><i class="fa-solid fa-trash"></i> Excluir</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  btnAddImpDoc?.addEventListener('click', async () => {
    if (!currentEmpId)
      return notify('Abra um funcionário primeiro.', 'warn');
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

    let dataURL = '';
    try {
      dataURL = await fileToDataURL_imp(file);
    } catch {}

    const map = getImpDocsMap();
    map[currentEmpId] = map[currentEmpId] || [];
    const id = uid('doc');
    map[currentEmpId].push({
      id,
      name,
      type,
      issue,
      due,
      uploadedAt: new Date().toISOString(),
      size: file.size || 0,
      dataURL,
      subscribed: false
    });
    setImpDocsMap(map);

    if (impDocFile) impDocFile.value = '';
    if (impDocName) impDocName.value = '';
    if (impDocType) impDocType.value = '';
    if (impDocIssue) impDocIssue.value = '';
    if (impDocDue) impDocDue.value = '';

    renderImpDocsTable();
    notify('Documento importante adicionado.', 'success');
    checkImportantDocExpirations();
  });

  impDocsTable?.addEventListener('click', (e) => {
    const del = e.target.closest('[data-imp-del]');
    const sub = e.target.closest('[data-imp-sub]');
    const map = getImpDocsMap();
    const list = map[currentEmpId] || [];

    if (del) {
      const idx = Number(del.getAttribute('data-imp-del'));
      if (!Number.isFinite(idx)) return;
      if (!confirm('Excluir este documento importante?')) return;
      list.splice(idx, 1);
      map[currentEmpId] = list;
      setImpDocsMap(map);
      renderImpDocsTable();
      notify('Documento excluído.', 'success');
      checkImportantDocExpirations();
    }
    if (sub) {
      const idx = Number(sub.getAttribute('data-imp-sub'));
      if (!Number.isFinite(idx)) return;
      const item = list[idx];
      item.subscribed = !item.subscribed;
      map[currentEmpId] = list;
      setImpDocsMap(map);
      renderImpDocsTable();

      if (item.subscribed) {
        const alerts = getAlerts();
        alerts.push({
          id: uid('al'),
          refKey: `sub|${currentEmpId}|${item.id}`,
          type: 'subscription',
          empId: currentEmpId,
          empNome: funcModalNome?.textContent || '',
          docName: item.name,
          due: item.due,
          createdAt: new Date().toISOString(),
          unread: true,
          status: 'Lembrete salvo'
        });
        setAlerts(alerts);
        updateNotifDot();
        notify('Lembrete ativado para este documento.', 'success');
        checkImportantDocExpirations();
      } else {
        notify('Lembrete desativado para este documento.', 'info');
      }
    }
  });

  /* ===================== DOCUMENTOS (EXPLORER TIPO WINDOWS) ===================== */

  function getEmpDocsFlat(empId) {
    const map = getGenDocsMap();
    let list = map[empId];
    if (!Array.isArray(list)) list = [];

    let changed = false;
    list.forEach((item) => {
      if (!item.type) {
        item.type = 'file';
        changed = true;
      }
      if (typeof item.parentId === 'undefined') {
        item.parentId = null;
        changed = true;
      }
    });

    if (changed) {
      map[empId] = list;
      setGenDocsMap(map);
    }

    return list;
  }

  function setEmpDocsFlat(empId, list) {
    const map = getGenDocsMap();
    map[empId] = list;
    setGenDocsMap(map);
  }

  function feRefresh() {
    if (!feTree || !feList || !fePath || !feCurrentEmpId) return;
    const list = getEmpDocsFlat(feCurrentEmpId);

    if (feCurrentFolderId) {
      const stillExists = list.some(
        (it) => it.type === 'folder' && it.id === feCurrentFolderId
      );
      if (!stillExists) feCurrentFolderId = null;
    }

    feRenderPath(list);
    feRenderTree(list);
    feRenderList(list);
  }

  function feRenderPath(list) {
    if (!fePath) return;
    const crumbs = [];
    let folderId = feCurrentFolderId;

    while (folderId) {
      const f = list.find(
        (it) => it.id === folderId && it.type === 'folder'
      );
      if (!f) break;
      crumbs.unshift({ id: f.id, name: f.name || 'Pasta' });
      folderId = f.parentId ?? null;
    }

    let html =
      `<span class="fe-bc${feCurrentFolderId ? '' : ' current'}" data-id="">Documentos</span>`;
    if (crumbs.length) {
      html =
        `<span class="fe-bc" data-id="">Documentos</span> / ` +
        crumbs
          .map((c, idx) => {
            const last = idx === crumbs.length - 1;
            return `<span class="fe-bc${last ? ' current' : ''}" data-id="${
              c.id
            }">${escapeHTML(c.name)}</span>`;
          })
          .join(' / ');
    }
    fePath.innerHTML = html;
  }

  fePath?.addEventListener('click', (e) => {
    const el = e.target.closest('.fe-bc');
    if (!el) return;
    const id = el.dataset.id || '';
    feCurrentFolderId = id || null;
    feSelection = null;
    feRefresh();
  });

  function feRenderTree(list) {
    if (!feTree) return;

    function renderFolder(parentId) {
      const children = list
        .filter(
          (it) => it.type === 'folder' && (it.parentId ?? null) === parentId
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      if (!children.length) return '';
      return `<ul class="fe-tree-list">
        ${children
          .map(
            (f) => `
          <li>
            <div class="fe-tree-folder ${
              feCurrentFolderId === f.id ? 'active' : ''
            }" data-id="${f.id}">
              <span class="fe-icon"><i class="fa-regular fa-folder"></i></span>
              <span class="fe-label">${escapeHTML(f.name || 'Pasta')}</span>
            </div>
            ${renderFolder(f.id)}
          </li>`
          )
          .join('')}
      </ul>`;
    }

    const rootActive = feCurrentFolderId == null;
    feTree.innerHTML = `
      <div class="fe-tree-root">
        <div class="fe-tree-folder ${
          rootActive ? 'active' : ''
        }" data-id="">
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
    feCurrentFolderId = id || null;
    feSelection = null;
    feRefresh();
  });

  function feRenderList(list) {
    if (!feList) return;
    const tbody = feList.querySelector('tbody');
    if (!tbody) return;

    const parentId = feCurrentFolderId ?? null;
    const folders = list
      .filter(
        (it) => it.type === 'folder' && (it.parentId ?? null) === parentId
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const files = list
      .filter(
        (it) => it.type !== 'folder' && (it.parentId ?? null) === parentId
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    if (!folders.length && !files.length) {
      tbody.innerHTML =
        `<tr class="fe-empty"><td colspan="4">Pasta vazia</td></tr>`;
      return;
    }

    const rows = [];

    folders.forEach((f) => {
      rows.push(`
        <tr data-type="folder" data-id="${f.id}">
          <td>
            <span class="fe-icon"><i class="fa-regular fa-folder"></i></span>
            ${escapeHTML(f.name || 'Pasta')}
          </td>
          <td>Pasta</td>
          <td>—</td>
          <td>—</td>
        </tr>
      `);
    });

    files.forEach((file) => {
      const when = file.uploadedAt ? new Date(file.uploadedAt) : null;
      const whenLabel = when
        ? `${two(when.getDate())}/${two(
            when.getMonth() + 1
          )}/${when.getFullYear()} ${two(when.getHours())}:${two(
            when.getMinutes()
          )}`
        : '—';
      rows.push(`
        <tr data-type="file" data-id="${file.id}">
          <td>
            <span class="fe-icon"><i class="fa-regular fa-file-lines"></i></span>
            ${escapeHTML(file.name || '(sem nome)')}
          </td>
          <td>Arquivo</td>
          <td>${bytesHuman(file.size || 0)}</td>
          <td>${whenLabel}</td>
        </tr>
      `);
    });

    tbody.innerHTML = rows.join('');

    if (feSelection) {
      const row = tbody.querySelector(
        `tr[data-type="${feSelection.type}"][data-id="${feSelection.id}"]`
      );
      if (row) row.classList.add('selected');
      else feSelection = null;
    }
  }

  feList?.addEventListener('click', (e) => {
    const row = e.target.closest('tbody tr[data-id]');
    if (!row) return;
    const tbody = feList.querySelector('tbody');
    if (!tbody) return;
    tbody
      .querySelectorAll('tr.selected')
      .forEach((tr) => tr.classList.remove('selected'));
    row.classList.add('selected');
    feSelection = { type: row.dataset.type, id: row.dataset.id };
  });

  // Duplo clique: pasta -> entra; arquivo -> abre/baixa imediato
  feList?.addEventListener('dblclick', (e) => {
    const row = e.target.closest('tbody tr[data-id]');
    if (!row) return;
    const type = row.dataset.type;
    const id = row.dataset.id;
    const list = getEmpDocsFlat(feCurrentEmpId);
    if (type === 'folder') {
      feCurrentFolderId = id;
      feSelection = null;
      feRefresh();
      return;
    }
    if (type === 'file') {
      const file = list.find(
        (it) => it.id === id && it.type !== 'folder'
      );
      if (!file || !file.dataURL) return;
      const a = document.createElement('a');
      a.href = file.dataURL;
      a.download = file.name || 'arquivo';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });

  // Upload (qualquer tipo) – permite múltiplos
  if (feUpload) {
    feUpload.setAttribute('multiple', '');
    feUpload.removeAttribute('accept');
  }

  feUpload?.addEventListener('change', async (e) => {
    if (!feCurrentEmpId) {
      notify('Abra um funcionário primeiro.', 'warn');
      return;
    }
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let list = getEmpDocsFlat(feCurrentEmpId);
    const parentId = feCurrentFolderId ?? null;

    for (const file of files) {
      try {
        const dataURL = await fileToDataURL(file);
        list.push({
          id: uid('gdoc'),
          type: 'file',
          parentId,
          name: file.name,
          size: file.size || 0,
          uploadedAt: new Date().toISOString(),
          dataURL,
          mime: file.type || ''
        });
      } catch {
        notify(
          'Não foi possível importar "' + file.name + '".',
          'error'
        );
      }
    }
    setEmpDocsFlat(feCurrentEmpId, list);
    feUpload.value = '';
    feRefresh();
  });

  // Nova pasta
  feBtnNewFolder?.addEventListener('click', () => {
    if (!feCurrentEmpId)
      return notify('Abra um funcionário primeiro.', 'warn');
    let name = prompt('Nome da nova pasta:', 'Nova pasta');
    if (!name) return;
    name = name.trim();
    if (!name) return;
    const parentId = feCurrentFolderId ?? null;
    const list = getEmpDocsFlat(feCurrentEmpId);
    list.push({
      id: uid('fd'),
      type: 'folder',
      parentId,
      name
    });
    setEmpDocsFlat(feCurrentEmpId, list);
    feRefresh();
  });

  // Renomear
  feBtnRename?.addEventListener('click', () => {
    if (!feCurrentEmpId) return;
    if (!feSelection)
      return notify(
        'Selecione uma pasta ou arquivo para renomear.',
        'warn'
      );
    const list = getEmpDocsFlat(feCurrentEmpId);
    const item = list.find(
      (it) => it.id === feSelection.id && it.type === feSelection.type
    );
    if (!item) return;
    const newName = prompt('Novo nome:', item.name || '');
    if (!newName) return;
    item.name = newName.trim() || item.name;
    setEmpDocsFlat(feCurrentEmpId, list);
    feRefresh();
  });

  function feDeleteFolderRecursive(list, folderId) {
    const idsToRemove = new Set([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const it of list) {
        if (
          it.parentId &&
          idsToRemove.has(it.parentId) &&
          !idsToRemove.has(it.id)
        ) {
          idsToRemove.add(it.id);
          changed = true;
        }
      }
    }
    return list.filter((it) => !idsToRemove.has(it.id));
  }

  // Excluir
  feBtnDelete?.addEventListener('click', () => {
    if (!feCurrentEmpId) return;
    if (!feSelection)
      return notify(
        'Selecione uma pasta ou arquivo para excluir.',
        'warn'
      );
    let list = getEmpDocsFlat(feCurrentEmpId);
    const { type, id } = feSelection;
    const item = list.find((it) => it.id === id && it.type === type);
    if (!item) return;
    const isFolder = type === 'folder';
    if (
      !confirm(
        isFolder
          ? 'Excluir esta pasta e todo o conteúdo?'
          : `Excluir o arquivo "${item.name}"?`
      )
    ) {
      return;
    }
    if (isFolder) {
      list = feDeleteFolderRecursive(list, id);
      if (feCurrentFolderId === id)
        feCurrentFolderId = item.parentId ?? null;
    } else {
      list = list.filter((it) => it.id !== id);
    }
    feSelection = null;
    setEmpDocsFlat(feCurrentEmpId, list);
    feRefresh();
  });

  // Copiar / Colar
  feBtnCopy?.addEventListener('click', () => {
    if (!feCurrentEmpId) return;
    if (!feSelection)
      return notify(
        'Selecione uma pasta ou arquivo para copiar.',
        'warn'
      );
    feCopyBuffer = {
      empId: feCurrentEmpId,
      type: feSelection.type,
      id: feSelection.id
    };
    notify(
      'Copiado. Vá até a pasta de destino e clique em "Colar".',
      'info'
    );
  });

  function feDuplicateFolderSubtree(list, srcFolderId, targetParentId) {
    const newList = [...list];

    function dfs(oldId, newParentId) {
      const srcFolder = list.find(
        (it) => it.id === oldId && it.type === 'folder'
      );
      if (!srcFolder) return;

      const newId = uid('fd');
      const newFolder = {
        id: newId,
        type: 'folder',
        parentId: newParentId,
        name: srcFolder.name + ' - cópia'
      };
      newList.push(newFolder);

      list
        .filter(
          (it) => it.type !== 'folder' && it.parentId === oldId
        )
        .forEach((file) => {
          const newFileId = uid('gdoc');
          newList.push({
            ...file,
            id: newFileId,
            parentId: newId,
            uploadedAt: new Date().toISOString()
          });
        });

      list
        .filter(
          (it) => it.type === 'folder' && it.parentId === oldId
        )
        .forEach((child) => {
          dfs(child.id, newId);
        });
    }

    dfs(srcFolderId, targetParentId);
    return newList;
  }

  feBtnPaste?.addEventListener('click', () => {
    if (!feCurrentEmpId) return;
    if (!feCopyBuffer)
      return notify(
        'Nada para colar. Use o botão Copiar primeiro.',
        'warn'
      );
    if (feCopyBuffer.empId !== feCurrentEmpId) {
      return notify(
        'Por enquanto só é possível colar dentro do mesmo funcionário.',
        'warn'
      );
    }

    const list = getEmpDocsFlat(feCurrentEmpId);
    const parentId = feCurrentFolderId ?? null;

    if (feCopyBuffer.type === 'file') {
      const src = list.find(
        (it) => it.id === feCopyBuffer.id && it.type !== 'folder'
      );
      if (!src)
        return notify(
          'O arquivo copiado não existe mais.',
          'error'
        );
      const copy = {
        ...src,
        id: uid('gdoc'),
        parentId,
        uploadedAt: new Date().toISOString()
      };
      const newList = [...list, copy];
      setEmpDocsFlat(feCurrentEmpId, newList);
      feRefresh();
      return;
    }

    if (feCopyBuffer.type === 'folder') {
      const src = list.find(
        (it) => it.id === feCopyBuffer.id && it.type === 'folder'
      );
      if (!src)
        return notify(
          'A pasta copiada não existe mais.',
          'error'
        );
      const newList = feDuplicateFolderSubtree(list, src.id, parentId);
      setEmpDocsFlat(feCurrentEmpId, newList);
      feRefresh();
    }
  });

  // Download (arquivo simples ou pasta como .zip)
  async function feDownloadSelected() {
    if (!feSelection || !feCurrentEmpId) {
      return notify(
        'Selecione um arquivo ou pasta para baixar.',
        'warn'
      );
    }

    const list = getEmpDocsFlat(feCurrentEmpId);
    const item = list.find((it) => it.id === feSelection.id);
    if (!item) {
      return notify('Item não encontrado.', 'error');
    }

    // Arquivo simples: baixa direto, sem JSZip
    if (item.type !== 'folder') {
      if (!item.dataURL) {
        return notify('Arquivo sem dados armazenados.', 'warn');
      }
      const a = document.createElement('a');
      a.href = item.dataURL;
      a.download = item.name || 'arquivo';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    // Pasta: compacta como .zip usando JSZip
    let JSZipCtor = window.JSZip;
    if (typeof JSZipCtor === 'undefined') {
      try {
        await loadJSZip();
        JSZipCtor = window.JSZip;
      } catch (err) {
        console.error(err);
        return notify(
          'Não foi possível carregar o módulo de compactação (JSZip).',
          'error'
        );
      }
    }

    if (typeof JSZipCtor !== 'function') {
      return notify(
        'JSZip não está disponível para compactar a pasta.',
        'error'
      );
    }

    const zip = new JSZipCtor();

    function addFolderToZip(folderId, basePath) {
      const folderItems = list.filter(
        (it) => it.parentId === folderId
      );
      for (const it of folderItems) {
        if (it.type === 'folder') {
          addFolderToZip(
            it.id,
            `${basePath}${it.name || 'pasta'}/`
          );
        } else if (it.dataURL) {
          const data = it.dataURL.split(',')[1] || '';
          zip.file(
            `${basePath}${it.name || 'arquivo'}`,
            data,
            { base64: true }
          );
        }
      }
    }

    addFolderToZip(item.id, `${item.name || 'pasta'}/`);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name || 'pasta'}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  feBtnDownload?.addEventListener('click', feDownloadSelected);

  // Carrega JSZip dinamicamente (CDN) quando precisar
  function loadJSZip() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function initFileExplorerForEmp(empId) {
    feCurrentEmpId = empId;
    feCurrentFolderId = null;
    feSelection = null;
    if (feTree || feList || fePath) {
      getEmpDocsFlat(empId);
      feRefresh();
    }
  }

  /* ===================== ALERTAS ===================== */

  function updateNotifDot() {
    if (!notifDot) return;
    const anyUnread = getAlerts().some((a) => a.unread);
    if (anyUnread) notifDot.removeAttribute('hidden');
    else notifDot.setAttribute('hidden', '');
  }

  function checkImportantDocExpirations() {
    const map = getImpDocsMap();
    const allAlerts = getAlerts();
    const today = new Date();
    const soonDays = 7;
    const soonMs = soonDays * 24 * 3600 * 1000;

    function addAlertUnique(refKey, payload) {
      if (allAlerts.some((a) => a.refKey === refKey)) return;
      allAlerts.push({
        id: uid('al'),
        unread: true,
        createdAt: new Date().toISOString(),
        ...payload,
        refKey
      });
    }

    Object.entries(map).forEach(([empId, docs]) => {
      const emp = getFuncionariosLS().find((f) => f.id === empId);
      const empNome = emp?.nome || 'Funcionário';
      docs.forEach((d) => {
        if (!d.due) return;
        const due = new Date(d.due + 'T00:00:00');
        const diff = due - today;
        const isOver = diff < 0;
        const isSoon = diff >= 0 && diff <= soonMs;

        if (isOver) {
          addAlertUnique(`over|${empId}|${d.id}`, {
            type: 'due_over',
            empId,
            empNome,
            docName: d.name,
            due: d.due,
            status: 'Vencido'
          });
        } else if (isSoon) {
          addAlertUnique(`soon|${empId}|${d.id}`, {
            type: 'due_soon',
            empId,
            empNome,
            docName: d.name,
            due: d.due,
            status: `Vence em até ${soonDays} dias`
          });
        }
      });
    });

    setAlerts(allAlerts);
    updateNotifDot();
  }

  function renderAlertsTable() {
    if (!alertsTable) return;
    const list = getAlerts().sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
    alertsTable.innerHTML =
      list.length === 0
        ? `<tr><td colspan="5">Sem lembretes.</td></tr>`
        : list
            .map((al) => {
              const status =
                al.status ||
                (al.type === 'due_over'
                  ? 'Vencido'
                  : al.type === 'due_soon'
                  ? 'Próximo de vencer'
                  : 'Lembrete');
              const cls =
                al.type === 'due_over'
                  ? 'err'
                  : al.type === 'due_soon'
                  ? 'warn'
                  : al.unread
                  ? 'info'
                  : 'ok';
              return `<tr>
                <td>${escapeHTML(al.empNome || '—')}</td>
                <td>${escapeHTML(al.docName || '—')}</td>
                <td>${
                  al.due
                    ? al.due.split('-').reverse().join('/')
                    : '—'
                }</td>
                <td><span class="status-dot ${cls}"></span> ${escapeHTML(
                status
              )}</td>
                <td>
                  <button class="btn btn-light" data-alert-read="${al.id}">${
                al.unread ? 'Marcar como lido' : 'Lido'
              }</button>
                </td>
              </tr>`;
            })
            .join('');
  }

  btnAlerts?.addEventListener('click', () => {
    renderAlertsTable();
    modalAlerts && (modalAlerts.style.display = 'flex');
  });

  btnCloseAlerts?.addEventListener('click', () => {
    modalAlerts && (modalAlerts.style.display = 'none');
  });

  alertsTable?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-alert-read]');
    if (!b) return;
    const id = b.getAttribute('data-alert-read');
    const list = getAlerts();
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      list[idx].unread = false;
      setAlerts(list);
      renderAlertsTable();
      updateNotifDot();
    }
  });

  /* ===================== CADASTRO (MODAL) ===================== */

  (function mountCadastroModal() {
    const cadWrap = document.querySelector('.gestao-cadastro-wrap');
    const cadBox = cadWrap
      ? cadWrap.querySelector('.gestao-cadastro')
      : null;

    function openModal() {
      if (
        cadBox &&
        modalCadastroBody &&
        cadBox.parentElement !== modalCadastroBody
      ) {
        modalCadastroBody.appendChild(cadBox);
      }
      modalCadastroUsuario &&
        (modalCadastroUsuario.style.display = 'flex');
    }
    function closeModal() {
      if (cadWrap && cadBox && cadBox.parentElement !== cadWrap)
        cadWrap.appendChild(cadBox);
      modalCadastroUsuario &&
        (modalCadastroUsuario.style.display = 'none');
    }
    btnAbrirCadastro?.addEventListener('click', openModal);
    btnFecharCadastro?.addEventListener('click', closeModal);
    modalCadastroUsuario?.addEventListener('click', (e) => {
      if (e.target === modalCadastroUsuario) closeModal();
    });
    document.addEventListener(
      'keydown',
      (e) => e.key === 'Escape' && closeModal()
    );
  })();

  // Preview imediato da foto no cadastro (já usando o helper que reduz imagem)
  cadFoto?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) {
      if (cadFotoPreview) cadFotoPreview.src = '';
      return;
    }
    try {
      const dataURL = await imageFileToDataURL(f);
      if (cadFotoPreview) cadFotoPreview.src = dataURL;
    } catch {
      notify('Não foi possível carregar a imagem.', 'error');
    }
  });

  btnSalvarCadastro?.addEventListener('click', async () => {
    const nome = (cadNome?.value || '').trim();
    const funcao = (cadFuncao?.value || '').trim();
    if (!nome || !funcao)
      return notify('Nome e Função são obrigatórios.', 'warn');

    const rg = (cadRG?.value || '').trim();
    const cpf = (cadCPF?.value || '').trim();
    const idade =
      parseInt((cadIdade?.value || '0').trim(), 10) || 0;
    const cargo = cadCargo ? (cadCargo.value || '').trim() : funcao;
    const salario =
      parseFloat(String(cadSalario?.value || '0').replace(',', '.')) ||
      0;

    const optVR = !!cadOptVR?.checked;
    const optVT = !!cadOptVT?.checked;

    const vtUnitV = parseFloat(
      String(cadVtUnit?.value || '').replace(',', '.')
    );
    const vrDailyV = parseFloat(
      String(cadVrDaily?.value || '').replace(',', '.')
    );

    let foto = '';
    if (cadFoto?.files?.[0]) {
      try {
        foto = await imageFileToDataURL(cadFoto.files[0]);
      } catch {}
    }

    const arr = getFuncionariosLS();
    const id = 'fid_' + Date.now();
    arr.push({
      id,
      nome,
      funcao,
      rg,
      cpf,
      idade,
      cargo,
      salario,
      optVR,
      optVT,
      foto,
      ativo: true
    });

    try {
      setFuncionariosLS(arr);
    } catch (err) {
      console.error(err);
      return notify(
        'Não foi possível salvar o funcionário (armazenamento cheio).',
        'error'
      );
    }

    try {
      const vrMap = getVRMap();
      vrMap[id] = Object.assign(
        { enabled: optVR, sal: salario },
        vrMap[id] || {}
      );
      if (Number.isFinite(vrDailyV)) vrMap[id].daily = vrDailyV;
      setVRMap(vrMap);

      const vtMap = getVTMap();
      vtMap[id] = Object.assign(
        { enabled: optVT },
        vtMap[id] || {}
      );
      if (Number.isFinite(vtUnitV)) vtMap[id].unit = vtUnitV;
      setVTMap(vtMap);
    } catch {}

    // documento anexo inicial (opcional)
    if (cadDocumento?.files?.[0]) {
      try {
        const file = cadDocumento.files[0];
        const dataURL = await fileToDataURL(file);
        const imp = getImpDocsMap();
        imp[id] = imp[id] || [];
        imp[id].push({
          id: uid('doc'),
          name: file.name,
          type: 'Outros',
          issue: '',
          due: '',
          uploadedAt: new Date().toISOString(),
          size: file.size || 0,
          dataURL,
          subscribed: false
        });
        setImpDocsMap(imp);
      } catch {}
    }

    notify('Funcionário cadastrado!', 'success');

    [
      cadNome,
      cadFuncao,
      cadRG,
      cadCPF,
      cadIdade,
      cadCargo,
      cadSalario,
      cadAdmissao,
      cadVtUnit,
      cadVrDaily
    ].forEach((el) => el && (el.value = ''));
    if (cadDocumento) cadDocumento.value = '';
    if (cadFoto) cadFoto.value = '';
    if (cadFotoPreview) cadFotoPreview.src = '';
    if (cadOptVR) cadOptVR.checked = false;
    if (cadOptVT) cadOptVT.checked = false;

    renderFuncionarios(funcSearchGestao ? funcSearchGestao.value : '');
    renderVT();
    renderVR();
  });

  btnLimparCadastro?.addEventListener('click', () => {
    [
      cadNome,
      cadFuncao,
      cadRG,
      cadCPF,
      cadIdade,
      cadCargo,
      cadSalario,
      cadAdmissao,
      cadVtUnit,
      cadVrDaily
    ].forEach((el) => el && (el.value = ''));
    if (cadDocumento) cadDocumento.value = '';
    if (cadFoto) cadFoto.value = '';
    if (cadFotoPreview) cadFotoPreview.src = '';
    if (cadOptVR) cadOptVR.checked = false;
    if (cadOptVT) cadOptVT.checked = false;
  });
})();
