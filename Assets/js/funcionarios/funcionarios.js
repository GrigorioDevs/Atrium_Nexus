/* ===================== FUNCIONÁRIOS (SEM LOCALSTORAGE / TUDO VIA API) ===================== */
(() => {
  'use strict';


  /* ===================== MAPA RÁPIDO =====================
   * Fluxo principal:
   * boot() -> syncFuncionariosFromAPI() -> renderFuncionarios()
   * clique no card -> openFuncionario() / closeFuncionario()
   *
   * Assinatura/GIF:
   * gerarAssinaturaFuncionario(id) abre popup e usa:
   * setAnimState() + captureFrame() + gif.js para renderizar frames
   * makeRoundedMatteCtx() recorta cantos arredondados no resultado
   *
   * ================================================ */

  /* ===================== CONFIG ===================== */
  const API_BASE = (window.API_BASE || 'http://localhost:5253').replace(/\/+$/, '');

  /* ===================== STATE (MEMÓRIA) ===================== */
  const STATE = {
    viewerRole: 2, // 1=Admin | 2=Gestão/RH | 3=Segurança do Trabalho,
    funcionarios: [],
    currentEmpId: null
  };

  // ======================================================
  // COMPATIBILIDADE (beneficios-vt.js / beneficios-vr.js)
  // Alguns módulos antigos ainda chamam getFuncionariosLS().
  // Como este arquivo foi migrado para "tudo via API", mantemos
  // uma função global de leitura para evitar ReferenceError.
  // ======================================================
  if (typeof window.getFuncionariosLS !== 'function') {
    window.getFuncionariosLS = () => (Array.isArray(STATE.funcionarios) ? STATE.funcionarios : []);
  }

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


  // =========================
  // INTEGRAÇÃO: Funcionario (card) -> Cursos (paneCursos / cursos.js)
  // =========================
  function syncFuncionarioIdToCursos(empId) {
    const id = (empId === undefined || empId === null || empId === "") ? "" : String(empId);

    // 1) Hidden input que o cursos.js lê no init (se existir)
    const hidden = document.getElementById("cursosEmpId");
    if (hidden) hidden.value = id;

    // 2) Guarda global (útil p/ debug e outros módulos)
    window.__ATRIUM_CURRENT_FUNCIONARIO_ID__ = id || null;

    // 3) Se o cursos.js já estiver carregado, sincroniza imediatamente
    try {
      if (window.CursosPane && typeof window.CursosPane.setEmployee === "function") {
        window.CursosPane.setEmployee(id || null);
      }
    } catch (e) {
      console.warn("CursosPane.setEmployee falhou:", e);
    }

    // 4) Evento (opcional) para outros módulos reagirem
    try {
      window.dispatchEvent(new CustomEvent("atrium:funcionario-selected", {
        detail: { funcionarioId: id || null }
      }));
    } catch {
      // ignore
    }
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

  return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/foto`, {
    method: 'POST',
    body: fd,
  });
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

    

    // =====================
    // CADASTRO (MODAL) — montar ANTES de qualquer await
    // =====================
/* ======================================================
       CORREÇÃO JS (IMPORTANTE):
       Movemos o formulário para o modal IMEDIATAMENTE (ao iniciar),
       sem esperar clique. Isso, somado ao CSS visibility:hidden,
       garante que o form esteja sempre pronto para uso.
    ====================================================== */
    (function mountCadastroModal() {
      const cadWrap = document.querySelector('.gestao-cadastro-wrap');
      const cadBox = cadWrap ? cadWrap.querySelector('.gestao-cadastro') : null;

      // ✅ Mover AGORA, não no click.
      if (cadBox && modalCadastroBody && cadBox.parentElement !== modalCadastroBody) {
        modalCadastroBody.appendChild(cadBox);
      }

      function openModal() {
        if (modalCadastroUsuario) {
          modalCadastroUsuario.style.display = 'flex';
          modalCadastroUsuario.classList.add('open');
        }
      }

      function closeModal() {
        if (modalCadastroUsuario) {
          modalCadastroUsuario.style.display = 'none';
          modalCadastroUsuario.classList.remove('open');
        }
      }

      btnAbrirCadastro?.addEventListener('click', openModal);
      btnFecharCadastro?.addEventListener('click', closeModal);
      modalCadastroUsuario?.addEventListener('click', (e) => {
        if (e.target === modalCadastroUsuario) closeModal();
      });
      document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
    })();
    
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
        // Atualiza módulos de benefícios, se existirem.
        safeCall('renderVT');
        safeCall('renderVR');
      } catch (err) {
        console.error(err);
        notify('Falha ao carregar funcionários do banco. Verifique API/CORS.', 'error');
        STATE.funcionarios = [];
        renderFuncionarios('');
        safeCall('renderVT');
        safeCall('renderVR');
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
                    )
                  +
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

      syncFuncionarioIdToCursos(STATE.currentEmpId);

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

      
      // Explorer foi movido para o arquivo: funcionariosExplorer.js
      // (Aqui só avisamos o módulo do Explorer que um funcionário foi aberto)
      try {
        if (window.FuncionariosExplorer && typeof window.FuncionariosExplorer.open === 'function') {
          await window.FuncionariosExplorer.open({
            funcionarioId: Number(STATE.currentEmpId),
            viewerRole: STATE.viewerRole,
          });
        }
      } catch (err) {
        console.warn('Falha ao inicializar o Explorer:', err);
      }
if (modalFuncionario) modalFuncionario.style.display = 'flex';
    }

    /**
     * Fecha o modal do funcionário e limpa estados/seleções relacionadas.
     */
    function closeFuncionario() {
      try { window.FuncionariosExplorer?.close?.(); } catch {}
      STATE.currentEmpId = null;
      syncFuncionarioIdToCursos(null);
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
          else notify('Crachá não carregou (verifique se cracha-acesso.js está incluído).', 'error');
        }
if (act === 'assinatura') window.gerarAssinaturaFuncionario?.(id);

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

    

  /* ===================== (Explorer movido para funcionariosExplorer.js) ===================== */

// ===== START =====
    await syncFuncionariosFromAPI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();