/* ===================== FUNCIONÁRIOS ===================== */
/**
 * MISSÃO DO ARQUIVO (visão geral)
 * 1) Helpers e proteções (notify, escapeHTML, uid, bytesHuman, etc.)
 * 2) Máscaras e validações (CPF, RG, Celular, Email)
 * 3) Cliente de API (fetch padronizado + endpoints)
 * 4) Lista/Busca de funcionários (LocalStorage como “espelho”)
 * 5) Modal do funcionário (abrir/fechar + abas)
 * 6) Foto do funcionário (upload pro back + fallback)
 * 7) Documentos importantes (POST no banco + GET para exibir)
 * 8) Explorer (documentos simples) — mantido local (por enquanto)
 * 9) Alertas (sino + vencimentos)
 * 10) Cadastro do funcionário (POST no back + upload foto/doc inicial)
 */
(() => {
  'use strict';


  /* ===================== MAPA RÁPIDO =====================
   * Este arquivo é um módulo completo (legado/espelho em LocalStorage).
   * Fluxo principal:
   *   renderFuncionarios() -> openModal() / closeModal()
   *   changePhotoForEmp() -> apiUploadFoto()
   *   Docs importantes:
   *     loadImpDocsFromApi() -> renderImpDocsTableFromApi()
   *   Explorer:
   *     initFileExplorerForEmp() -> feRefresh() -> feRenderTree()/feRenderList()
   * ================================================ */

  /* ===================== [1] HELPERS / PROTEÇÕES ===================== */

  const $ = (id) => document.getElementById(id);

  // CSS.escape fallback (evita erro em browsers/ambientes sem CSS.escape)
  const cssEsc = (v) => {
    const s = String(v ?? '');
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
    return s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  };

  // notify seguro (usa o notify do seu core se existir)
  const notify =
    typeof window.notify === 'function'
      ? window.notify.bind(window)
      : (msg) => alert(String(msg));

  // escapeHTML seguro
  function escapeHTML(input) {
    const s = String(input ?? '');
    // replaceAll pode não existir em ambientes antigos; então usa split/join
    return s
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;')
      .split("'").join('&#39;');
  }

  // uid simples
  function uid(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  /**
   * Pad de 2 dígitos (ex.: 3 -> '03') para datas/horas.
   */
  function two(n) {
    return String(n).padStart(2, '0');
  }

  /**
   * Converte bytes em texto legível (B/KB/MB/GB) para exibição na UI.
   */
  function bytesHuman(bytes) {
    const b = Number(bytes || 0);
    if (!b) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = b;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  // Avatar padrão
  function defaultAvatarDataURL() {
    try {
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
    } catch {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/awq8z8AAAAASUVORK5CYII=';
    }
  }

  // File -> DataURL
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('Falha ao ler arquivo'));
      r.readAsDataURL(file);
    });
  }

  // Imagem -> DataURL (com redução)
  async function imageFileToDataURL(file) {
    const dataURL = await fileToDataURL(file);
    if (!file?.type?.startsWith('image/')) return dataURL;
    if (file.type === 'image/svg+xml') return dataURL;

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 512;
        let { width, height } = img;
        if (width <= MAX && height <= MAX) return resolve(dataURL);

        const ratio = Math.min(MAX / width, MAX / height);
        const newW = Math.round(width * ratio);
        const newH = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = newW;
        canvas.height = newH;

        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataURL); // ✅ CORREÇÃO: evita crash
        ctx.drawImage(img, 0, 0, newW, newH);

        const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const out = canvas.toDataURL(outType, 0.85);
        resolve(out);
      };
      img.onerror = () => resolve(dataURL);
      img.src = dataURL;
    });
  }

  window.defaultAvatarDataURL = window.defaultAvatarDataURL || defaultAvatarDataURL;
  window.imageFileToDataURL = window.imageFileToDataURL || imageFileToDataURL;

  // Se este módulo não tem nada na página, aborta
  const empGrid = $('empGrid');
  const modalFuncionario = $('modalFuncionario');
  const modalCadastroUsuario = $('modalCadastroUsuario');
  if (!empGrid && !modalFuncionario && !modalCadastroUsuario) return;

  /* ===================== [2] DOM REFS ===================== */

  // Busca / lista
  const funcSearch = $('funcSearch');
  const funcSearchBtn = $('funcSearchBtn');
  const funcClear = $('funcClear');

  const funcSearchGestao = $('funcSearchGestao');
  const funcSearchGestaoBtn = $('funcSearchGestaoBtn');
  const funcClearGestao = $('funcClearGestao');

  // Modal funcionário
  const funcModalNome = $('funcModalNome');
  const funcModalFuncao = $('funcModalFuncao');
  const funcModalAvatar = $('funcModalAvatar');
  const fecharFuncionario = $('fecharFuncionario');

  // Cadastro
  const btnAbrirCadastro = $('btnAbrirCadastro');
  const btnFecharCadastro = $('btnFecharCadastro');
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
  const btnSalvarCadastro = $('btnSalvarCadastro');
  const btnLimparCadastro = $('btnLimparCadastro');
  const cadTipoContratoCLT = $('cadTipoContratoCLT');
  const cadTipoContratoPJ = $('cadTipoContratoPJ');

  const cadCell = $('cadCell');
  const cadEmail = $('cadEmail');

  // Cursos
  const funcCursosInput = $('funcCursosInput');
  const btnSalvarCursos = $('btnSalvarCursos');

  // Alerts
  const notifDot = $('notifDot');
  const btnAlerts = $('btnAlerts');
  const modalAlerts = $('modalAlerts');
  const btnCloseAlerts = $('btnCloseAlerts');
  const alertsTable = $('alertsTable');

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

  /* ===================== [3] CONTEXTO (Segurança x Gestão) ===================== */

  /**
   * Retorna o contexto atual do usuário/aba (ex.: 'gestao' ou 'seguranca') para filtrar o que aparece no Explorer.
   */
  function getEmpContext() {
    if (!empGrid) return 'unknown';
    if (empGrid.closest('#tabFuncionarios')) return 'seguranca';
    if (empGrid.closest('#tabFuncGestao')) return 'gestao';
    return 'unknown';
  }

  /* ===================== [4] FORMATAÇÃO / MÁSCARAS ===================== */

  /**
   * Remove tudo que não for dígito de uma string (útil para CPF/RG/telefone).
   */
  function onlyDigits(s) {
    return String(s || '').replace(/\D+/g, '');
  }

  /**
   * Aplica máscara em um input preservando cursor (caret) para uma digitação suave.
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
    try { inputEl.setSelectionRange(pos, pos); } catch {}
  }

  // Email: remove espaços
  cadEmail?.addEventListener('input', (e) => {
    const el = e.target;
    el.value = String(el.value || '').replace(/\s+/g, '');
  });

  /* ===== CPF ===== */
  /**
   * Aplica máscara de CPF em tempo real enquanto digita.
   */
  function maskCPFLive(value) {
    const d = onlyDigits(value).slice(0, 11);
    if (!d) return '';
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  /**
   * Formata CPF (11 dígitos) para ###.###.###-##.
   */
  function formatCPF(value) {
    const d = onlyDigits(value);
    if (d.length !== 11) return '';
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  /**
   * Valida um CPF (dígitos verificadores) para impedir cadastros inválidos.
   */
  function isValidCPF(value) {
    const cpf = onlyDigits(value);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
    let d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (d1 !== parseInt(cpf[9], 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
    let d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    return d2 === parseInt(cpf[10], 10);
  }

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
      notify('CPF inválido.', 'warn');
      return;
    }
    cadCPF.value = fmt;
  });

  /* ===== RG (00.000.000-0) ===== */
  /**
   * Aplica máscara de RG em tempo real enquanto digita.
   */
  function maskRGLive(value) {
    const d = onlyDigits(value).slice(0, 9);
    if (!d) return '';
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
  }

  /**
   * Formata RG para padrão amigável (varia por UF, então é uma normalização básica).
   */
  function formatRG(value) {
    const d = onlyDigits(value);
    if (d.length !== 9) return '';
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
  }

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
      notify('RG incompleto. Use 9 dígitos no padrão 00.000.000-0.', 'warn');
      return;
    }
    cadRG.value = fmt;
  });

  /* ===== Celular BR ===== */
  /**
   * Aplica máscara de telefone BR em tempo real enquanto digita.
   */
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
   * Formata telefone BR (10/11 dígitos) para exibição.
   */
  function formatBRPhone(value) {
    const d = onlyDigits(value);
    if (!(d.length === 10 || d.length === 11)) return '';
    const dd = d.slice(0, 2);
    const rest = d.slice(2);
    if (rest.length === 9) return `(${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    return `(${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  cadCell?.addEventListener('input', (e) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = onlyDigits(el.value.slice(0, caret)).length;
    const masked = maskBRPhoneLive(el.value);
    applyMaskedWithCaret(el, masked, digitsBefore);
  });

  cadCell?.addEventListener('blur', () => {
    const raw = cadCell.value || '';
    if (!onlyDigits(raw)) { cadCell.value = ''; return; }
    const fmt = formatBRPhone(raw);
    cadCell.value = fmt || '';
  });

  /* ===================== [5] API (BACK-END) ===================== */

  const API_BASE = 'http://localhost:5253';

  /**
   * Wrapper de fetch padronizado com API_BASE, parse de JSON e erro amigável.
   */
  async function apiFetch(path, options = {}) {
    const url = API_BASE + path;

    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}) }
    });

    const text = await res.text();
    const data = text
      ? (() => { try { return JSON.parse(text); } catch { return text; } })()
      : null;

    if (!res.ok) {
      const msg =
        data && typeof data === 'object' && data.message
          ? data.message
          : typeof data === 'string'
            ? data
            : 'Erro na API';
      throw new Error(msg);
    }

    return data;
  }

  /**
   * Cria funcionário no backend (POST) e devolve o registro criado.
   */
  async function apiCreateFuncionario(payload) {
    return apiFetch('/api/funcionarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Faz upload de foto (FormData) para o funcionário no backend.
   */
  async function apiUploadFoto(funcionarioId, file) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return apiFetch(`/api/funcionarios/${funcionarioId}/foto`, {
      method: 'POST',
      body: fd
    });
  }

  /**
   * Envia um documento (arquivo) do funcionário via FormData, incluindo metadados (tipo, emissão, validade).
   */
  async function apiUploadDocumentoFuncionario(empId, {
    file,
    importante = false,
    nomeDocumento = '',
    tipoDocumento = '',
    dataEmissao = '',
    dataValidade = ''
  }) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('importante', String(!!importante));
    if (nomeDocumento) fd.append('nomeDocumento', nomeDocumento);
    if (tipoDocumento) fd.append('tipoDocumento', tipoDocumento);
    if (dataEmissao) fd.append('dataEmissao', dataEmissao);
    if (dataValidade) fd.append('dataValidade', dataValidade);

    return apiFetch(`/api/funcionarios/${empId}/documentos`, {
      method: 'POST',
      body: fd
    });
  }

  /**
   * Lista documentos do funcionário; aceita flag importante (true/false) para filtrar.
   */
  async function apiListDocumentosFuncionario(empId, importante) {
    const qs = `?importante=${importante ? 'true' : 'false'}`;
    return apiFetch(`/api/funcionarios/${empId}/documentos${qs}`, { method: 'GET' });
  }

  /**
   * Remove um documento específico do funcionário no backend.
   */
  async function apiDeleteDocumentoFuncionario(empId, docId) {
    return apiFetch(`/api/funcionarios/${empId}/documentos/${docId}`, { method: 'DELETE' });
  }


  /* ===================== [7] LISTA / BUSCA ===================== */

  /**
   * Renderiza a lista/grid de funcionários na UI (usando LocalStorage como espelho).
   */
  function renderFuncionarios(q = '') {
    if (!empGrid) return;
    const all = getFuncionariosLS();
    const term = q.trim().toLowerCase();

    const list =
      term.length > 0
        ? all.filter((f) => String(f.nome || '').toLowerCase().includes(term))
        : all;

    empGrid.innerHTML =
      list
        .map((f) => {
          const inactiveClass = f.ativo ? '' : 'inactive';
          const offBadge = f.ativo ? '' : `<span class="emp-badge-off">INATIVO</span>`;

          const menu = `
            <div class="emp-menu" data-id="${escapeHTML(f.id)}" title="Opções" aria-haspopup="menu" aria-expanded="false">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </div>
            <div class="emp-menu-dropdown" data-menu="${escapeHTML(f.id)}" role="menu">
              ${
                f.ativo
                  ? `<button data-action="desativar" data-id="${escapeHTML(f.id)}"><i class="fa-regular fa-circle-xmark"></i> Desativar</button>`
                  : `<button data-action="ativar" data-id="${escapeHTML(f.id)}"><i class="fa-regular fa-circle-check"></i> Ativar</button>`
              }
              <button data-action="cracha" data-id="${escapeHTML(f.id)}"><i class="fa-regular fa-id-badge"></i> Crachá de acesso</button>
            </div>`;

          const avatar = photoOrFallback(resolveFotoSrc(f));
          const idade = Number(f.idade || 0);

          return `
            <div class="emp-card ${inactiveClass}" data-id="${escapeHTML(f.id)}">
              ${menu}
              ${offBadge}
              ${avatar}
              <div>
                <div class="emp-name">${escapeHTML(f.nome || '')}</div>
                <div class="emp-role">${escapeHTML(f.funcao || '')} • ${escapeHTML(String(idade))} anos</div>
              </div>
            </div>`;
        })
        .join('') || `<div style="color:#9fb1c3">Nenhum funcionário encontrado.</div>`;
  }

  renderFuncionarios();

  /**
   * Mantém campos de busca sincronizados (ex.: search no topo e no modal).
   */
  function syncSearchInputs(val) {
    val = typeof val === 'string' ? val : '';
    if (funcSearch && funcSearch.value !== val) funcSearch.value = val;
    if (funcSearchGestao && funcSearchGestao.value !== val) funcSearchGestao.value = val;
  }

  funcSearch?.addEventListener('input', (e) => {
    syncSearchInputs(e.target.value);
    renderFuncionarios(e.target.value);
  });

  funcClear?.addEventListener('click', () => {
    syncSearchInputs('');
    renderFuncionarios('');
  });

  funcSearchBtn?.addEventListener('click', () => renderFuncionarios(funcSearch?.value || ''));

  funcSearchGestao?.addEventListener('input', (e) => {
    syncSearchInputs(e.target.value);
    renderFuncionarios(e.target.value);
  });

  funcClearGestao?.addEventListener('click', () => {
    syncSearchInputs('');
    renderFuncionarios('');
  });

  funcSearchGestaoBtn?.addEventListener('click', () => renderFuncionarios(funcSearchGestao?.value || ''));


  
  /* ===================== [10] FOTO DO FUNCIONÁRIO ===================== */

  let hiddenPhotoInput = null;

  /**
   * Cria/garante um input file invisível para trocar foto sem alterar layout.
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
   * Fluxo de trocar foto: seleciona imagem, converte/valida e envia para API, atualizando a UI.
   */
  async function changePhotoForEmp(empId) {
    if (getEmpContext() === 'seguranca') {
      notify('Alterar foto só é permitido na Gestão de Funcionários.', 'warn');
      return;
    }

    if (!isNumericId(empId)) {
      notify('Este funcionário ainda é do “seed/local”. Cadastre no servidor para enviar foto.', 'warn');
      return;
    }

    const input = ensureHiddenPhotoInput();
    input.value = '';

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        let fotoUrl = null;
        try {
          const resp = await apiUploadFoto(empId, file);
          fotoUrl = resp?.fotoUrl || null;
        } catch (err) {
          console.warn('Falhou upload no back; usando fallback base64.', err);
        }

        const arr = getFuncionariosLS();
        const idx = arr.findIndex((x) => String(x.id) === String(empId));
        if (idx < 0) return notify('Funcionário não encontrado.', 'warn');

        if (fotoUrl) {
          arr[idx].fotoUrl = fotoUrl;
          arr[idx].foto = '';
        } else {
          const dataURL = await imageFileToDataURL(file);
          arr[idx].foto = dataURL;
        }

        setFuncionariosLS(arr);

        renderFuncionarios(funcSearch?.value || '');
        if (currentEmpId && String(currentEmpId) === String(empId) && funcModalAvatar) {
          const f = arr[idx];
          funcModalAvatar.src = resolveFotoSrc(f) || defaultAvatarDataURL();
        }

        notify('Foto atualizada.', 'success');
      } catch (err) {
        console.error(err);
        notify('Não foi possível atualizar a foto.', 'error');
      }
    };

    input.click();
  }

  funcModalAvatar?.addEventListener('click', () => {
    if (!currentEmpId) return;
    if (currentEmpContext === 'seguranca') {
      notify('Alterar foto só é permitido na Gestão de Funcionários.', 'warn');
      return;
    }
    changePhotoForEmp(currentEmpId);
  });

  /* ===================== [11] MENU DE AÇÕES ===================== */

  /**
   * Fecha dropdowns de menu de todos os cards de funcionários.
   */
  function closeAllEmpMenus() {
    document.querySelectorAll('.emp-menu-dropdown.open').forEach((el) => el.classList.remove('open'));
    document.querySelectorAll('.emp-menu[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
  }

  /**
   * Abre/fecha dropdown de um card específico e atualiza aria-expanded.
   */
  function toggleEmpMenu(id) {
    const dd = document.querySelector(`.emp-menu-dropdown[data-menu="${cssEsc(String(id))}"]`);
    const btn = document.querySelector(`.emp-menu[data-id="${cssEsc(String(id))}"]`);
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

  /**
   * Ativa/desativa funcionário e reflete a alteração na UI/LocalStorage.
   */
  function setFuncionarioAtivo(id, ativo) {
    if (getEmpContext() === 'seguranca') {
      notify('Alterar status só é permitido na Gestão de Funcionários.', 'warn');
      return;
    }
    const arr = getFuncionariosLS();
    const idx = arr.findIndex((f) => String(f.id) === String(id));
    if (idx < 0) return;

    arr[idx].ativo = !!ativo;
    setFuncionariosLS(arr);

    notify(ativo ? 'Funcionário ativado.' : 'Funcionário desativado.', 'success');
    renderFuncionarios(funcSearch?.value || '');

    try { window.renderVT?.(); } catch {}
    try { window.renderVR?.(); } catch {}
  }

  /**
   * Exclui um funcionário (API + atualização de UI/LocalStorage).
   */
  function excluirFuncionario(id) {
    if (getEmpContext() === 'seguranca') {
      notify('Excluir funcionário só é permitido na Gestão de Funcionários.', 'warn');
      return;
    }

    const arr = getFuncionariosLS();
    const f = arr.find((x) => String(x.id) === String(id));
    if (!f) return;
    if (!confirm(`Excluir definitivamente “${f.nome}”?`)) return;

    const novo = arr.filter((x) => String(x.id) !== String(id));
    setFuncionariosLS(novo);

    try {
      const vrMap = window.getVRMap?.();
      if (vrMap) { delete vrMap[id]; window.setVRMap?.(vrMap); }
      const vtMap = window.getVTMap?.();
      if (vtMap) { delete vtMap[id]; window.setVTMap?.(vtMap); }
      const alerts = (window.getAlerts?.() || []).filter((a) => String(a.empId) !== String(id));
      window.setAlerts?.(alerts);
      updateNotifDot();
    } catch {}

    if (currentEmpId && String(currentEmpId) === String(id)) {
      currentEmpId = null;
      if (modalFuncionario) modalFuncionario.style.display = 'none';
    }

    notify('Funcionário excluído.', 'success');
    renderFuncionarios(funcSearch?.value || '');

    try { window.renderVT?.(); } catch {}
    try { window.renderVR?.(); } catch {}
  }

  empGrid?.addEventListener('click', (e) => {
    const ctx = getEmpContext();

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

    if (onMenuDD && !onAction) {
      e.stopPropagation();
      return;
    }

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

      if (act === 'cracha') {
        const arr = getFuncionariosLS();
        const f = arr.find((x) => String(x.id) === String(id));
        if (!f) notify('Funcionário não encontrado para o crachá.', 'warn');
        else if (typeof window.openCrachaFuncionario === 'function') window.openCrachaFuncionario(f);
      }

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

  /* ===================== [12] DOCUMENTOS IMPORTANTES (BANCO) ===================== */
/**
 * Como funciona:
 * - A pane #paneDocsImportantes existe dentro do modal do funcionário (aba).
 * - Ao clicar na aba "Documentos importantes", abrimos um MINI-MODAL (backdrop).
 * - Para reaproveitar a UI que você já tem, a gente MOVE os filhos do pane para dentro
 *   do #impDocsMiniBody. Ao fechar, MOVE de volta.
 * - A lista (GET) e ações (POST/DELETE) são no backend, com importante=true.
 */

let impDocsCache = [];
let impDocsMiniModal = null;

// helper: id numérico (pra diferenciar seed/local do DB int)
function isNumericId(v) {
  return /^\d+$/.test(String(v ?? ''));
}

// pega refs SEM cache (porque o conteúdo pode ser movido pro mini-modal)
function getImpEls() {
  // pane original (fica dentro do modal funcionário)
  const pane = document.getElementById('paneDocsImportantes');

  // body do mini-modal (existe só depois que o modal é criado)
  const miniBody = impDocsMiniModal
    ? impDocsMiniModal.querySelector('#impDocsMiniBody')
    : document.getElementById('impDocsMiniBody');

  // sua tabela pode ser <tbody id="impDocsTable"> (seu HTML é assim ✅)
  const t = document.getElementById('impDocsTable');
  const tableBody = t
    ? (t.tagName === 'TBODY' ? t : (t.querySelector('tbody') || t))
    : null;

  return {
    pane,
    miniBody,
    tableBody,
    btnAdd: document.getElementById('btnAddImpDoc'),
    file: document.getElementById('impDocFile'),
    name: document.getElementById('impDocName'),
    type: document.getElementById('impDocType'),
    issue: document.getElementById('impDocIssue'),
    due: document.getElementById('impDocDue')
  };
}

/**
 * ✅ Modal robusto:
 * - NÃO usa class "modal" (muito comum ter `.modal{display:none!important}`)
 * - Força display via style.setProperty(..., 'important')
 */
/**
 * Cria (se não existir) um mini-modal robusto para mostrar 'Documentos importantes' sobreposto ao modal principal.
 */
function ensureImpDocsMiniModal() {
  if (impDocsMiniModal) return impDocsMiniModal;

  const wrap = document.createElement('div');
  wrap.id = 'modalImpDocs';
  wrap.className = 'imp-mini-modal'; // ⚠️ não use 'modal'

  wrap.style.setProperty('display', 'none', 'important');
  wrap.style.position = 'fixed';
  wrap.style.inset = '0';
  wrap.style.zIndex = '99999';
  wrap.style.background = 'rgba(0,0,0,.65)';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';

  wrap.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="impDocsTitle"
         style="max-width:980px;width:min(980px,96vw);max-height:90vh;overflow:auto;">
      <div class="modal-header" id="impDocsTitle">Documentos importantes</div>
      <div class="modal-body" id="impDocsMiniBody"></div>
      <div class="modal-footer">
        <button class="btn btn-light" id="btnCloseImpDocs" type="button">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  // fechar clicando no backdrop
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) closeImpDocsMini();
  });

  // fechar no ESC (registra UMA vez)
  document.addEventListener('keydown', (e) => {
    if (wrap.style.display === 'flex' && e.key === 'Escape') closeImpDocsMini();
  });

  wrap.querySelector('#btnCloseImpDocs')?.addEventListener('click', () => closeImpDocsMini());

  impDocsMiniModal = wrap;
  return impDocsMiniModal;
}

/**
 * Monta URL absoluta de download quando o backend retorna caminhos relativos.
 */
function resolveDownloadLink(downloadUrl) {
  if (!downloadUrl) return null;
  const u = String(downloadUrl);
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (typeof API_BASE !== 'string' || !API_BASE) return u;
  return `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
}

/**
 * Carrega documentos importantes do backend para cache (impDocsCache) do funcionário atual.
 */
async function loadImpDocsFromApi(empId) {
  if (!empId) return;

  // se seu backend usa int e o seed é tipo "f1", avisa e não tenta
  if (!isNumericId(empId)) {
    impDocsCache = [];
    renderImpDocsTableFromApi();
    (typeof notify === 'function' ? notify : alert)(
      'Este funcionário ainda é do “seed/local”. Cadastre no servidor para ver documentos importantes.',
      'warn'
    );
    return;
  }

  if (typeof apiListDocumentosFuncionario !== 'function') {
    console.warn('apiListDocumentosFuncionario não existe.');
    impDocsCache = [];
    renderImpDocsTableFromApi();
    return;
  }

  try {
    const list = await apiListDocumentosFuncionario(empId, true);
    impDocsCache = Array.isArray(list) ? list : [];
    renderImpDocsTableFromApi();

    // alertas por vencimento (se existir no core)
    if (typeof checkImportantDocExpirationsFor === 'function') {
      checkImportantDocExpirationsFor(empId, (funcModalNome?.textContent || ''), impDocsCache);
    }
  } catch (err) {
    console.error(err);
    impDocsCache = [];
    renderImpDocsTableFromApi();
    (typeof notify === 'function' ? notify : alert)(err?.message || 'Falha ao carregar documentos importantes.', 'error');
  }
}

/**
 * Renderiza a tabela de documentos importantes com base no cache carregado da API.
 */
function renderImpDocsTableFromApi() {
  const { tableBody } = getImpEls();
  if (!tableBody) {
    console.warn('impDocsTable (tbody) não encontrado no DOM.');
    return;
  }

  if (!currentEmpId) {
    tableBody.innerHTML = `<tr><td colspan="5" style="color:#9fb1c3">Abra um funcionário.</td></tr>`;
    return;
  }

  if (!impDocsCache.length) {
    tableBody.innerHTML = `<tr><td colspan="5" style="color:#9fb1c3">Nenhum documento importante.</td></tr>`;
    return;
  }

  tableBody.innerHTML = impDocsCache
    .map((d) => {
      const docId = d.id ?? d.Id ?? d.docId ?? '';
      const nome = d.nomeDocumento ?? d.nome ?? d.name ?? '(sem nome)';
      const tipo = d.tipoDocumento ?? d.tipo ?? d.type ?? '—';
      const issue = d.dataEmissao ?? d.emissao ?? d.issue ?? '';
      const due = d.dataValidade ?? d.validade ?? d.due ?? '';

      const issueLabel = issue ? String(issue).split('-').reverse().join('/') : '—';
      const dueLabel = due ? String(due).split('-').reverse().join('/') : '—';

      const link = resolveDownloadLink(d.downloadUrl || d.downloadURL || d.url);

      return `
        <tr data-imp-docid="${escapeHTML(docId)}">
          <td style="text-align:left">${escapeHTML(nome)}</td>
          <td>${escapeHTML(tipo)}</td>
          <td>${escapeHTML(issueLabel)}</td>
          <td>${escapeHTML(dueLabel)}</td>
          <td style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
            ${
              link
                ? `<a class="btn btn-light" href="${escapeHTML(link)}" target="_blank" rel="noreferrer">
                     <i class="fa-solid fa-download"></i> Baixar
                   </a>`
                : ''
            }
            <button class="btn btn-ghost" data-imp-del="1" type="button">
              <i class="fa-solid fa-trash"></i> Excluir
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Abre o mini-modal e move o conteúdo da pane de docs importantes para dentro dele.
 */
function openImpDocsMini() {
  const modal = ensureImpDocsMiniModal();
  const { pane, miniBody } = getImpEls();

  if (!currentEmpId) {
    (typeof notify === 'function' ? notify : alert)('Abra um funcionário primeiro.', 'warn');
    return;
  }

  if (!pane) {
    console.error('❌ paneDocsImportantes não existe no HTML');
    (typeof notify === 'function' ? notify : alert)('paneDocsImportantes não encontrado no HTML.', 'error');
    return;
  }

  if (!miniBody) {
    console.error('❌ impDocsMiniBody não existe');
    (typeof notify === 'function' ? notify : alert)('impDocsMiniBody não foi criado.', 'error');
    return;
  }

  // move a UI da aba para dentro do mini-modal
  if (miniBody.children.length === 0) {
    while (pane.firstChild) miniBody.appendChild(pane.firstChild);
  }

  modal.style.setProperty('display', 'flex', 'important');

  // carrega do banco
  loadImpDocsFromApi(currentEmpId);
}

/**
 * Fecha o mini-modal e devolve o conteúdo para a pane original.
 */
function closeImpDocsMini(silent = false) {
  if (!impDocsMiniModal) return;

  const { pane, miniBody } = getImpEls();

  // devolve conteúdo pra pane original
  if (pane && miniBody && miniBody.children.length > 0) {
    while (miniBody.firstChild) pane.appendChild(miniBody.firstChild);
  }

  impDocsMiniModal.style.setProperty('display', 'none', 'important');

  // opcional: voltar pra aba docs simples
  if (!silent) {
    document.querySelectorAll('#modalFuncionario .emp-tab-btn')?.forEach((b) => b.classList.remove('active'));
    document.getElementById('btnTabDocsSimples')?.classList.add('active');

    document.querySelectorAll('#modalFuncionario .emp-pane')?.forEach((p) => p.classList.remove('active'));
    document.getElementById('paneDocsSimples')?.classList.add('active');
  }
}

/**
 * ✅ ABERTURA SUPER CONFIÁVEL:
 * - capture=true passa na frente de qualquer stopPropagation em bubble
 * - e também bind direto no botão quando existir
 */
document.addEventListener(
  'click',
  (e) => {
    const btn = e.target.closest('#btnTabDocsImportantes');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openImpDocsMini();
  },
  true
);

// bind direto (se já existir no DOM)
document.getElementById('btnTabDocsImportantes')?.addEventListener('click', (e) => {
  e.preventDefault();
  openImpDocsMini();
});

/**
 * ✅ ADICIONAR DOC IMPORTANTE (capture=true pra não “morrer”)
 */
document.addEventListener(
  'click',
  async (e) => {
    const btn = e.target.closest('#btnAddImpDoc');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    if (!currentEmpId) return (typeof notify === 'function' ? notify : alert)('Abra um funcionário primeiro.', 'warn');
    if (!isNumericId(currentEmpId))
      return (typeof notify === 'function' ? notify : alert)('Cadastre o funcionário no servidor para salvar docs importantes.', 'warn');

    if (typeof apiUploadDocumentoFuncionario !== 'function') {
      console.warn('apiUploadDocumentoFuncionario não existe.');
      return (typeof notify === 'function' ? notify : alert)('API de upload de documentos não está disponível.', 'error');
    }

    const { file, name, type, issue, due } = getImpEls();
    const f = file?.files?.[0];
    if (!f) return (typeof notify === 'function' ? notify : alert)('Selecione um arquivo.', 'warn');

    try {
      await apiUploadDocumentoFuncionario(currentEmpId, {
        file: f,
        importante: true,
        nomeDocumento: (name?.value || f.name).trim(),
        tipoDocumento: (type?.value || '').trim(),
        dataEmissao: (issue?.value || '').trim(),
        dataValidade: (due?.value || '').trim()
      });

      if (file) file.value = '';
      if (name) name.value = '';
      if (type) type.value = '';
      if (issue) issue.value = '';
      if (due) due.value = '';

      (typeof notify === 'function' ? notify : alert)('Documento importante salvo.', 'success');
      loadImpDocsFromApi(currentEmpId);
    } catch (err) {
      console.error(err);
      (typeof notify === 'function' ? notify : alert)(err?.message || 'Falha ao salvar documento importante.', 'error');
    }
  },
  true
);

/**
 * ✅ EXCLUIR DOC IMPORTANTE (capture=true)
 */
document.addEventListener(
  'click',
  async (e) => {
    const btn = e.target.closest('[data-imp-del="1"]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const tr = btn.closest('tr[data-imp-docid]');
    const docId = tr?.getAttribute('data-imp-docid');

    if (!currentEmpId || !docId) return;
    if (!isNumericId(currentEmpId))
      return (typeof notify === 'function' ? notify : alert)('Cadastre o funcionário no servidor para excluir docs.', 'warn');

    if (!confirm('Excluir este documento?')) return;

    if (typeof apiDeleteDocumentoFuncionario !== 'function') {
      console.warn('apiDeleteDocumentoFuncionario não existe.');
      return (typeof notify === 'function' ? notify : alert)('API de exclusão não está disponível.', 'error');
    }

    try {
      await apiDeleteDocumentoFuncionario(currentEmpId, docId);
      (typeof notify === 'function' ? notify : alert)('Documento excluído.', 'success');
      loadImpDocsFromApi(currentEmpId);
    } catch (err) {
      console.error(err);
      (typeof notify === 'function' ? notify : alert)(err?.message || 'Falha ao excluir documento.', 'error');
    }
  },
  true
);

/**
 * ✅ Alternância das abas no modal do funcionário:
 * - Se clicar na aba de docs importantes, abre o mini-modal e NÃO troca pane normal
 */
modalFuncionario?.addEventListener('click', (e) => {
  const btn = e.target.closest('.emp-tab-btn');
  if (!btn) return;

  const targetSel = btn.getAttribute('data-target');

  if (targetSel === '#paneDocsImportantes') {
    e.preventDefault();
    openImpDocsMini();
    return;
  }

  // abas normais
  document.querySelectorAll('#modalFuncionario .emp-tab-btn')?.forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('#modalFuncionario .emp-pane')?.forEach((p) => p.classList.remove('active'));
  const pane = document.querySelector(targetSel);
  if (pane) pane.classList.add('active');
});
/* ===================== [/12] DOCUMENTOS IMPORTANTES ===================== */

  
  /* ===================== [13] ALERTAS (vencimento) ===================== */

  /**
   * Atualiza o indicador (bolinha) de notificação de docs/alertas pendentes no UI.
   */
  function updateNotifDot() {
    if (!notifDot) return;
    const list = typeof window.getAlerts === 'function' ? window.getAlerts() : [];
    const anyUnread = list.some((a) => a.unread);
    if (anyUnread) notifDot.removeAttribute('hidden');
    else notifDot.setAttribute('hidden', '');
  }

  // (seu core pode ter checkImportantDocExpirationsFor; se não tiver, ok)

  function renderAlertsTable() {
    if (!alertsTable) return;
    const list = (typeof window.getAlerts === 'function' ? window.getAlerts() : []).sort((a, b) =>
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
                <td>${al.due ? String(al.due).split('-').reverse().join('/') : '—'}</td>
                <td><span class="status-dot ${cls}"></span> ${escapeHTML(status)}</td>
                <td>
                  <button class="btn btn-light" data-alert-read="${escapeHTML(al.id)}">
                    ${al.unread ? 'Marcar como lido' : 'Lido'}
                  </button>
                </td>
              </tr>`;
            })
            .join('');
  }

  btnAlerts?.addEventListener('click', () => {
    renderAlertsTable();
    if (modalAlerts) modalAlerts.style.display = 'flex';
  });

  btnCloseAlerts?.addEventListener('click', () => {
    if (modalAlerts) modalAlerts.style.display = 'none';
  });

  alertsTable?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-alert-read]');
    if (!b) return;

    const id = b.getAttribute('data-alert-read');
    const getAlerts = window.getAlerts;
    const setAlerts = window.setAlerts;
    if (typeof getAlerts !== 'function' || typeof setAlerts !== 'function') return;

    const list = getAlerts() || [];
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      list[idx].unread = false;
      setAlerts(list);
      renderAlertsTable();
      updateNotifDot();
    }
  });

  /* ===================== [14] CADASTRO (MODAL) ===================== */

  (function mountCadastroModal() {
    const cadWrap = document.querySelector('.gestao-cadastro-wrap');
    const cadBox = cadWrap ? cadWrap.querySelector('.gestao-cadastro') : null;

    /**
     * Abre um modal genérico (overlay).
     */
    function openModal() {
      if (cadBox && modalCadastroBody && cadBox.parentElement !== modalCadastroBody) {
        modalCadastroBody.appendChild(cadBox);
      }
      if (modalCadastroUsuario) modalCadastroUsuario.style.display = 'flex';
    }

    /**
     * Fecha um modal genérico (overlay).
     */
    function closeModal() {
      if (cadWrap && cadBox && cadBox.parentElement !== cadWrap) cadWrap.appendChild(cadBox);
      if (modalCadastroUsuario) modalCadastroUsuario.style.display = 'none';
    }

    btnAbrirCadastro?.addEventListener('click', openModal);
    btnFecharCadastro?.addEventListener('click', closeModal);

    modalCadastroUsuario?.addEventListener('click', (e) => {
      if (e.target === modalCadastroUsuario) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  })();

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
    try {
      const nome = (cadNome?.value || '').trim();
      const funcao = (cadFuncao?.value || '').trim();
      if (!nome || !funcao) return notify('Nome e Função são obrigatórios.', 'warn');

      const rg = (cadRG?.value || '').trim();
      const cpf = (cadCPF?.value || '').trim();

      const email = (cadEmail?.value || '').trim() || null;
      const celular = (cadCell?.value || '').trim() || null;

      const idade = parseInt((cadIdade?.value || '0').trim(), 10) || 0;
      const cargo = cadCargo ? (cadCargo.value || '').trim() : funcao;

      const salario = parseFloat(String(cadSalario?.value || '0').replace(',', '.')) || 0;
      const optVR = !!cadOptVR?.checked;
      const optVT = !!cadOptVT?.checked;

      const vtUnitV = parseFloat(String(cadVtUnit?.value || '').replace(',', '.'));
      const vrDailyV = parseFloat(String(cadVrDaily?.value || '').replace(',', '.'));

      const tipoContrato =
        cadTipoContratoCLT?.checked ? 1 :
        cadTipoContratoPJ?.checked ? 2 : 0;

      const dataAdmissao = cadAdmissao?.value ? `${cadAdmissao.value}T00:00:00` : null;

      const cpfDigits = onlyDigits(cpf);
      const cellDigits = celular ? onlyDigits(celular) : null;

      const payload = {
        nome,
        funcao,
        rg,
        email,
        celular: cellDigits,
        cpf: cpfDigits,
        idade,
        cargo, // extra
        salario,
        recebeVr: optVR,
        recebeVt: optVT,
        tarifaVt: Number.isFinite(vtUnitV) ? vtUnitV : null,
        valorDiarioVr: Number.isFinite(vrDailyV) ? vrDailyV : null,
        tipoContrato,
        fotoUrl: null,
        dataAdmissao
      };

      const created = await apiCreateFuncionario(payload);
      const id = created.id;

      let fotoUrl = null;
      if (cadFoto?.files?.[0]) {
        try {
          const resp = await apiUploadFoto(id, cadFoto.files[0]);
          fotoUrl = resp?.fotoUrl || null;
        } catch (err) {
          console.error(err);
          notify('Funcionário salvo, mas falhou ao enviar foto.', 'warn');
        }
      }

      const arr = getFuncionariosLS();
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
        fotoUrl: fotoUrl || '',
        foto: '',
        celular: formatBRPhone(cellDigits) || '',
        email: email || '',
        ativo: true
      });
      setFuncionariosLS(arr);

      if (cadDocumento?.files?.[0]) {
        try {
          const file = cadDocumento.files[0];
          await apiUploadDocumentoFuncionario(id, {
            file,
            importante: false,
            nomeDocumento: file.name,
            tipoDocumento: '',
            dataEmissao: '',
            dataValidade: ''
          });
        } catch (err) {
          console.error(err);
          notify('Funcionário salvo, mas falhou ao enviar documento inicial.', 'warn');
        }
      }

      notify('Funcionário cadastrado!', 'success');

      [cadNome, cadFuncao, cadRG, cadCPF, cadEmail, cadCell, cadIdade, cadCargo, cadSalario, cadAdmissao, cadVtUnit, cadVrDaily].forEach((el) => el && (el.value = ''));
      if (cadDocumento) cadDocumento.value = '';
      if (cadFoto) cadFoto.value = '';
      if (cadFotoPreview) cadFotoPreview.src = '';
      if (cadOptVR) cadOptVR.checked = false;
      if (cadOptVT) cadOptVT.checked = false;
      if (cadTipoContratoCLT) cadTipoContratoCLT.checked = false;
      if (cadTipoContratoPJ) cadTipoContratoPJ.checked = false;

      renderFuncionarios(funcSearchGestao ? funcSearchGestao.value : '');
      try { window.renderVT?.(); } catch {}
      try { window.renderVR?.(); } catch {}
    } catch (err) {
      console.error(err);
      notify(err.message || 'Falha ao cadastrar funcionário no servidor.', 'error');
    }
  });

  btnLimparCadastro?.addEventListener('click', () => {
    [cadNome, cadFuncao, cadRG, cadCPF, cadEmail, cadCell, cadIdade, cadCargo, cadSalario, cadAdmissao, cadVtUnit, cadVrDaily].forEach((el) => el && (el.value = ''));
    if (cadDocumento) cadDocumento.value = '';
    if (cadFoto) cadFoto.value = '';
    if (cadFotoPreview) cadFotoPreview.src = '';
    if (cadOptVR) cadOptVR.checked = false;
    if (cadOptVT) cadOptVT.checked = false;
    if (cadTipoContratoCLT) cadTipoContratoCLT.checked = false;
    if (cadTipoContratoPJ) cadTipoContratoPJ.checked = false;
  });

  /* ===================== [15] EXPLORER (DOCS SIMPLES) ===================== */

  const getGenDocsMap = window.getGenDocsMap;
  const setGenDocsMap = window.setGenDocsMap;

  let feCurrentEmpId = null;
  let feCurrentFolderId = null;
  let feSelection = null;
  let feCopyBuffer = null;

  /**
   * Lê a lista 'flat' de documentos do funcionário a partir do mapa no LocalStorage.
   */
  function getEmpDocsFlat(empId) {
    if (typeof getGenDocsMap !== 'function') return [];
    const map = getGenDocsMap();
    let list = map?.[empId];
    if (!Array.isArray(list)) list = [];
    return list;
  }

  /**
   * Salva a lista 'flat' de documentos do funcionário no mapa do LocalStorage.
   */
  function setEmpDocsFlat(empId, list) {
    if (typeof getGenDocsMap !== 'function' || typeof setGenDocsMap !== 'function') return;
    const map = getGenDocsMap() || {};
    map[empId] = list;
    setGenDocsMap(map);
  }

  /**
   * Renderiza breadcrumb (caminho) do Explorer.
   */
  function feRenderPath(list) {
    if (!fePath) return;
    const crumbs = [];
    let folderId = feCurrentFolderId;

    while (folderId) {
      const f = list.find((it) => it.type === 'folder' && it.id === folderId);
      if (!f) break;
      crumbs.unshift({ id: f.id, name: f.name || 'Pasta' });
      folderId = f.parentId ?? null;
    }

    let html = `<span class="fe-bc${feCurrentFolderId ? '' : ' current'}" data-id="">Documentos</span>`;
    if (crumbs.length) {
      html =
        `<span class="fe-bc" data-id="">Documentos</span> / ` +
        crumbs
          .map((c, idx) => {
            const last = idx === crumbs.length - 1;
            return `<span class="fe-bc${last ? ' current' : ''}" data-id="${escapeHTML(c.id)}">${escapeHTML(c.name)}</span>`;
          })
          .join(' / ');
    }
    fePath.innerHTML = html;
  }

  /**
   * Renderiza a árvore de pastas (sidebar) do Explorer.
   */
  function feRenderTree(list) {
    if (!feTree) return;

    /**
     * Helper recursivo para montar HTML da árvore de pastas.
     */
    function renderFolder(parentId) {
      const ctx = getEmpContext();
      const children = list
        .filter((it) => {
          if (it.type !== 'folder' || (it.parentId ?? null) !== parentId) return false;
          if (ctx === 'gestao') return true;
          return !it.context || it.context === 'seguranca';
        })
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

      if (!children.length) return '';
      return `<ul class="fe-tree-list">
        ${children.map((f) => `
          <li>
            <div class="fe-tree-folder ${feCurrentFolderId === f.id ? 'active' : ''}" data-id="${escapeHTML(f.id)}">
              <span class="fe-icon"><i class="fa-regular fa-folder"></i></span>
              <span class="fe-label">${escapeHTML(f.name || 'Pasta')}</span>
            </div>
            ${renderFolder(f.id)}
          </li>`).join('')}
      </ul>`;
    }

    const rootActive = feCurrentFolderId == null;
    feTree.innerHTML = `
      <div class="fe-tree-root">
        <div class="fe-tree-folder ${rootActive ? 'active' : ''}" data-id="">
          <span class="fe-icon"><i class="fa-regular fa-folder-open"></i></span>
          <span class="fe-label">Documentos</span>
        </div>
        ${renderFolder(null)}
      </div>`;
  }

  /**
   * Renderiza a lista/tabela de itens (pastas/arquivos) no Explorer.
   */
  function feRenderList(list) {
    if (!feList) return;
    const tbody = feList.querySelector('tbody');
    if (!tbody) return;

    const parentId = feCurrentFolderId ?? null;
    const ctx = getEmpContext();

    const folders = list
      .filter((it) => it.type === 'folder' && (it.parentId ?? null) === parentId)
      .filter((it) => (ctx === 'gestao' ? true : !it.context || it.context === 'seguranca'))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

    const files = list
      .filter((it) => it.type !== 'folder' && (it.parentId ?? null) === parentId)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

    if (!folders.length && !files.length) {
      tbody.innerHTML = `<tr class="fe-empty"><td colspan="4">Pasta vazia</td></tr>`;
      return;
    }

    const rows = [];

    for (const f of folders) {
      rows.push(`
        <tr data-type="folder" data-id="${escapeHTML(f.id)}">
          <td><span class="fe-icon"><i class="fa-regular fa-folder"></i></span>${escapeHTML(f.name || 'Pasta')}</td>
          <td>Pasta</td><td>—</td><td>—</td>
        </tr>`);
    }

    for (const file of files) {
      const when = file.uploadedAt ? new Date(file.uploadedAt) : null;
      const whenLabel = when
        ? `${two(when.getDate())}/${two(when.getMonth() + 1)}/${when.getFullYear()} ${two(when.getHours())}:${two(when.getMinutes())}`
        : '—';

      rows.push(`
        <tr data-type="file" data-id="${escapeHTML(file.id)}">
          <td><span class="fe-icon"><i class="fa-regular fa-file-lines"></i></span>${escapeHTML(file.name || '(sem nome)')}</td>
          <td>Arquivo</td>
          <td>${bytesHuman(file.size || 0)}</td>
          <td>${escapeHTML(whenLabel)}</td>
        </tr>`);
    }

    tbody.innerHTML = rows.join('');

    if (feSelection) {
      const row = tbody.querySelector(`tr[data-type="${cssEsc(String(feSelection.type))}"][data-id="${cssEsc(String(feSelection.id))}"]`);
      if (row) row.classList.add('selected');
      else feSelection = null;
    }
  }

  /**
   * Atualiza todo o Explorer (tree/path/list) com base na seleção atual.
   */
  function feRefresh() {
    if (!feTree || !feList || !fePath || !feCurrentEmpId) return;
    const list = getEmpDocsFlat(feCurrentEmpId);

    if (feCurrentFolderId) {
      const stillExists = list.some((it) => it.type === 'folder' && it.id === feCurrentFolderId);
      if (!stillExists) feCurrentFolderId = null;
    }

    feRenderPath(list);
    feRenderTree(list);
    feRenderList(list);
  }

  /**
   * Inicializa o Explorer para o funcionário selecionado (carrega itens, seta handlers, etc.).
   */
  function initFileExplorerForEmp(empId) {
    feCurrentEmpId = empId;
    feCurrentFolderId = null;
    feSelection = null;
    if (feTree || feList || fePath) feRefresh();
  }

  fePath?.addEventListener('click', (e) => {
    const el = e.target.closest('.fe-bc');
    if (!el) return;
    const id = el.dataset.id || '';
    feCurrentFolderId = id || null;
    feSelection = null;
    feRefresh();
  });

  feTree?.addEventListener('click', (e) => {
    const node = e.target.closest('.fe-tree-folder');
    if (!node) return;
    const id = node.dataset.id || '';
    feCurrentFolderId = id || null;
    feSelection = null;
    feRefresh();
  });

  feList?.addEventListener('click', (e) => {
    const row = e.target.closest('tbody tr[data-id]');
    if (!row) return;
    const tbody = feList.querySelector('tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr.selected').forEach((tr) => tr.classList.remove('selected'));
    row.classList.add('selected');
    feSelection = { type: row.dataset.type, id: row.dataset.id };
  });

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
      const file = list.find((it) => it.id === id && it.type !== 'folder');
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

  if (feUpload) {
    feUpload.setAttribute('multiple', '');
    feUpload.removeAttribute('accept');
  }

  feUpload?.addEventListener('change', async (e) => {
    if (!feCurrentEmpId) return notify('Abra um funcionário primeiro.', 'warn');

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
        notify(`Não foi possível importar "${file.name}".`, 'error');
      }
    }

    setEmpDocsFlat(feCurrentEmpId, list);
    feUpload.value = '';
    feRefresh();
  });

  feBtnNewFolder?.addEventListener('click', () => {
    if (!feCurrentEmpId) return notify('Abra um funcionário primeiro.', 'warn');
    let name = prompt('Nome da nova pasta:', 'Nova pasta');
    if (!name) return;
    name = name.trim();
    if (!name) return;

    const parentId = feCurrentFolderId ?? null;
    const list = getEmpDocsFlat(feCurrentEmpId);
    const ctx = getEmpContext();

    list.push({ id: uid('fd'), type: 'folder', parentId, name, context: ctx });
    setEmpDocsFlat(feCurrentEmpId, list);
    feRefresh();
  });

  feBtnRename?.addEventListener('click', () => {
    if (!feCurrentEmpId) return;
    if (!feSelection) return notify('Selecione uma pasta ou arquivo para renomear.', 'warn');
    const list = getEmpDocsFlat(feCurrentEmpId);
    const item = list.find((it) => it.id === feSelection.id);
    if (!item) return;
    const newName = prompt('Novo nome:', item.name || '');
    if (!newName) return;
    item.name = newName.trim() || item.name;
    setEmpDocsFlat(feCurrentEmpId, list);
    feRefresh();
  });

  /**
   * Remove uma pasta e todos os seus descendentes (arquivos/pastas) do Explorer.
   */
  function feDeleteFolderRecursive(list, folderId) {
    const idsToRemove = new Set([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const it of list) {
        if (it.parentId && idsToRemove.has(it.parentId) && !idsToRemove.has(it.id)) {
          idsToRemove.add(it.id);
          changed = true;
        }
      }
    }
    return list.filter((it) => !idsToRemove.has(it.id));
  }

  feBtnDelete?.addEventListener('click', () => {
    if (!feCurrentEmpId) return;
    if (!feSelection) return notify('Selecione uma pasta ou arquivo para excluir.', 'warn');

    let list = getEmpDocsFlat(feCurrentEmpId);
    const { type, id } = feSelection;

    const item = list.find((it) => it.id === id);
    if (!item) return;

    const isFolder = type === 'folder';
    if (!confirm(isFolder ? 'Excluir esta pasta e todo o conteúdo?' : `Excluir o arquivo "${item.name}"?`)) return;

    if (isFolder) {
      list = feDeleteFolderRecursive(list, id);
      if (feCurrentFolderId === id) feCurrentFolderId = item.parentId ?? null;
    } else {
      list = list.filter((it) => it.id !== id);
    }

    feSelection = null;
    setEmpDocsFlat(feCurrentEmpId, list);
    feRefresh();
  });

  feBtnCopy?.addEventListener('click', () => {
    if (!feCurrentEmpId) return;
    if (!feSelection) return notify('Selecione uma pasta ou arquivo para copiar.', 'warn');
    feCopyBuffer = { empId: feCurrentEmpId, type: feSelection.type, id: feSelection.id };
    notify('Copiado. Vá até a pasta de destino e clique em "Colar".', 'info');
  });

  /**
   * Duplica uma subárvore de pasta (pasta + filhos) para operações de copiar/colar.
   */
  function feDuplicateFolderSubtree(list, srcFolderId, targetParentId) {
    const newList = [...list];

    /**
     * Helper de busca em profundidade (depth-first search) usado para percorrer/duplicar estruturas de pastas.
     */
    function dfs(oldId, newParentId) {
      const srcFolder = list.find((it) => it.id === oldId && it.type === 'folder');
      if (!srcFolder) return;

      const newId = uid('fd');
      newList.push({ id: newId, type: 'folder', parentId: newParentId, name: (srcFolder.name || 'Pasta') + ' - cópia' });

      list.filter((it) => it.type !== 'folder' && it.parentId === oldId).forEach((file) => {
        newList.push({ ...file, id: uid('gdoc'), parentId: newId, uploadedAt: new Date().toISOString() });
      });

      list.filter((it) => it.type === 'folder' && it.parentId === oldId).forEach((child) => dfs(child.id, newId));
    }

    dfs(srcFolderId, targetParentId);
    return newList;
  }

  feBtnPaste?.addEventListener('click', () => {
    if (!feCurrentEmpId) return;
    if (!feCopyBuffer) return notify('Nada para colar. Use o botão Copiar primeiro.', 'warn');
    if (String(feCopyBuffer.empId) !== String(feCurrentEmpId)) return notify('Por enquanto só é possível colar dentro do mesmo funcionário.', 'warn');

    const list = getEmpDocsFlat(feCurrentEmpId);
    const parentId = feCurrentFolderId ?? null;

    if (feCopyBuffer.type === 'file') {
      const src = list.find((it) => it.id === feCopyBuffer.id && it.type !== 'folder');
      if (!src) return notify('O arquivo copiado não existe mais.', 'error');
      const copy = { ...src, id: uid('gdoc'), parentId, uploadedAt: new Date().toISOString() };
      setEmpDocsFlat(feCurrentEmpId, [...list, copy]);
      feRefresh();
      return;
    }

    if (feCopyBuffer.type === 'folder') {
      const src = list.find((it) => it.id === feCopyBuffer.id && it.type === 'folder');
      if (!src) return notify('A pasta copiada não existe mais.', 'error');
      const newList = feDuplicateFolderSubtree(list, src.id, parentId);
      setEmpDocsFlat(feCurrentEmpId, newList);
      feRefresh();
    }
  });

  /**
   * Gera e baixa um .zip com o item selecionado (arquivo ou pasta inteira) no Explorer.
   */
  async function feDownloadSelected() {
    if (!feSelection || !feCurrentEmpId) return notify('Selecione um arquivo ou pasta para baixar.', 'warn');

    const list = getEmpDocsFlat(feCurrentEmpId);
    const item = list.find((it) => it.id === feSelection.id);
    if (!item) return notify('Item não encontrado.', 'error');

    if (item.type !== 'folder') {
      if (!item.dataURL) return notify('Arquivo sem dados armazenados.', 'warn');
      const a = document.createElement('a');
      a.href = item.dataURL;
      a.download = item.name || 'arquivo';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    // pasta -> zip (JSZip)
    let JSZipCtor = window.JSZip;
    if (typeof JSZipCtor === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      JSZipCtor = window.JSZip;
    }

    if (typeof JSZipCtor !== 'function') return notify('JSZip não está disponível para compactar a pasta.', 'error');

    const zip = new JSZipCtor();

    /**
     * Helper que adiciona recursivamente uma pasta e seus arquivos ao zip durante a exportação.
     */
    function addFolderToZip(folderId, basePath) {
      const folderItems = list.filter((it) => it.parentId === folderId);
      for (const it of folderItems) {
        if (it.type === 'folder') addFolderToZip(it.id, `${basePath}${it.name || 'pasta'}/`);
        else if (it.dataURL) {
          const data = it.dataURL.split(',')[1] || '';
          zip.file(`${basePath}${it.name || 'arquivo'}`, data, { base64: true });
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

  // Inicializa notif dot
  updateNotifDot();
})();
