// ===================== Gerenciamento de Usuários (Admin) =====================
(() => {
  'use strict';

  // ======================================================
  // 0) CONSTANTES / CONFIG
  // ======================================================
  const ADMIN_ROLE  = 1;
  const VALID_ROLES = [1, 2, 3, 4];

  // Base da API: usa window.API_BASE se existir; senão tenta mesma origem; se file:// cai pro localhost
  const API_BASE = String(
    window.API_BASE ||
    (location.origin.startsWith('http') ? location.origin : '')
  ).replace(/\/+$/, '');

  const $ = (id) => document.getElementById(id);

  // Endpoints (backend)
  const API_ME_PATH         = '/api/Usuarios/me';
  const API_USERS_LIST_PATH = '/api/Usuarios';         // GET ?search=&take=
  const API_USERS_ID_PATH   = (id) => `/api/Usuarios/${encodeURIComponent(id)}`; // GET/PUT

  // ======================================================
  // 1) ROLE VISIBILITY (data-roles) — HARD HIDE
  // ======================================================
  function ensureRoleHiddenCss() {
    if (document.getElementById('role-hidden-style')) return;
    const style = document.createElement('style');
    style.id = 'role-hidden-style';
    style.textContent = `.role-hidden{ display:none !important; }`;
    document.head.appendChild(style);
  }

  function parseRolesAttr(el) {
    const raw = (el.getAttribute('data-roles') || '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  function applyRoleVisibility(userRole) {
    ensureRoleHiddenCss();
    const role = Number(userRole || 0);

    document.querySelectorAll('.only-admin').forEach((el) => {
      if (!el.hasAttribute('data-roles')) el.setAttribute('data-roles', String(ADMIN_ROLE));
    });

    document.querySelectorAll('[data-roles]').forEach((el) => {
      const roles = parseRolesAttr(el);
      if (!roles.length) return;

      const allowed = roles.includes(role);
      el.classList.toggle('role-hidden', !allowed);
      el.hidden = !allowed;

      if (!allowed) el.setAttribute('aria-hidden', 'true');
      else el.removeAttribute('aria-hidden');
    });
  }

  // ======================================================
  // 2) ROLE RESOLVER — pega o typeUser real (API primeiro)
  // ======================================================
  async function tryGetRoleFromApi() {
    const candidates = [
      API_ME_PATH,
      '/api/usuarios/me',
      '/api/auth/me',
      '/api/conta/me',
    ];

    for (const p of candidates) {
      try {
        const resp = await fetch(`${API_BASE}${p}`, {
          method: 'GET',
          headers: { accept: 'application/json' },
          credentials: 'include',
          cache: 'no-store',
        });

        if (!resp.ok) continue;

        const data = await resp.json().catch(() => null);
        const role = Number(
          data?.typeUser ??
          data?.tipoUsuario ??
          data?.TipoUsuario ??
          data?.role ??
          data?.Role ??
          0
        );

        if (VALID_ROLES.includes(role)) return role;
      } catch {
        // tenta próximo
      }
    }

    return null;
  }

  async function getViewerRole() {
    const apiRole = await tryGetRoleFromApi();
    if (VALID_ROLES.includes(Number(apiRole))) {
      try { window.USER_ROLE = Number(apiRole); } catch {}
      return Number(apiRole);
    }

    const w = Number(window.USER_ROLE || 0);
    if (VALID_ROLES.includes(w)) return w;

    return null;
  }

  // ======================================================
  // 3) UTILS
  // ======================================================
  function toast(msg, type = 'info') {
    if (typeof window.showToast === 'function') return window.showToast(msg, type);
    if (typeof window.notify === 'function') return window.notify(msg, type);
    console.log(`[${type}] ${msg}`);
  }

  async function safeJson(resp) {
    try {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await resp.json();
      const txt = await resp.text();
      return txt || null;
    } catch {
      return null;
    }
  }

  function buildErrorMessage(resp, data) {
    return (
      data?.message ||
      data?.error ||
      (typeof data === 'string' ? data : null) ||
      `Falha (HTTP ${resp.status}).`
    );
  }

  function debounce(fn, ms = 350) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // normaliza textos (evita mismatch: "-" vs "—", espaços, maiúsculas)
  function normText(s) {
    return String(s || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[–—]/g, '-') // padroniza travessões
      .toLowerCase();
  }

  function asArray(listResp) {
    if (Array.isArray(listResp)) return listResp;
    if (Array.isArray(listResp?.items)) return listResp.items;
    if (Array.isArray(listResp?.data)) return listResp.data;
    if (Array.isArray(listResp?.usuarios)) return listResp.usuarios;
    return [];
  }

  // ======================================================
  // 4) BOOT — roda após DOM
  // ======================================================
  async function boot() {
    ensureRoleHiddenCss();

    const section  = $('tabCadastroUsuario');
    if (!section) return;

    const menuItem = document.querySelector('li[data-tab="tabCadastroUsuario"]');

    // anti-flash
    section.hidden = true;
    section.classList.add('role-hidden');
    section.style.removeProperty('display');

    if (menuItem) {
      menuItem.hidden = true;
      menuItem.classList.add('role-hidden');
      menuItem.style.removeProperty('display');
      if (!menuItem.getAttribute('data-roles')) menuItem.setAttribute('data-roles', String(ADMIN_ROLE));
    }

    // ======================================================
    // 4.1) ELEMENTOS (CADASTRO)
    // ======================================================
    const el = {
      login: $('usrLogin'),
      email: $('usrEmail'),
      cpf: $('usrCPF'),
      tel: $('usrTelefone'),
      senha: $('usrSenha'),
      senha2: $('usrSenha2'),
      perfil: $('usrPerfil'),

      statusAtivo: $('usrStatusAtivo'),
      lblStatusFlag: $('lblStatusFlag'),

      btnSalvar: $('btnCadSalvar'),
      btnLimpar: $('btnCadLimpar'),
      statusMsg: $('cadStatusMsg'),

      tabBtns: Array.from(section.querySelectorAll('.card-tabs .tab-btn')),
      areas: Array.from(section.querySelectorAll('.tab-content-area')),
    };

    if (!el.btnSalvar || !el.btnLimpar || !el.statusMsg) {
      console.warn('[GerenciamentoUsuarios] IDs do HTML não batem: btnCadSalvar, btnCadLimpar, cadStatusMsg.');
      return;
    }

    function setStatus(msg, tipo = 'info') {
      el.statusMsg.textContent = msg;
      el.statusMsg.classList.remove('success', 'error', 'info');
      el.statusMsg.classList.add(tipo);
    }

    function setBusy(b) {
      const disabled = !!b;
      [
        el.btnSalvar, el.btnLimpar,
        el.login, el.email, el.cpf, el.tel, el.senha, el.senha2, el.perfil,
        el.statusAtivo
      ].forEach((x) => x && (x.disabled = disabled));
    }

    function showAdminUI(isAdmin) {
      section.style.removeProperty('display');
      if (menuItem) menuItem.style.removeProperty('display');

      if (isAdmin) {
        section.classList.remove('only-admin');
        section.hidden = false;
        section.classList.remove('role-hidden');

        if (menuItem) {
          menuItem.hidden = false;
          menuItem.classList.remove('role-hidden');
        }
      } else {
        section.hidden = true;
        section.classList.add('role-hidden');
        section.classList.add('only-admin');

        if (menuItem) {
          menuItem.hidden = true;
          menuItem.classList.add('role-hidden');
        }
      }
    }

    // tabs internas
    function activateInternalTab(targetId) {
      el.tabBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.target === targetId));
      el.areas.forEach((area) => area.classList.toggle('active', area.id === targetId));
    }

    function bindInternalTabs() {
      el.tabBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = btn.dataset.target;
          if (target) {
            activateInternalTab(target);
            if (target === 'areaAlteracao') {
              const inp = $('altBuscaUsuario');
              if (inp) setTimeout(() => inp.focus(), 0);
            }
          }
        });
      });
    }

    // status label (cadastro)
    function syncStatusLabel() {
      if (!el.statusAtivo || !el.lblStatusFlag) return;
      const on = !!el.statusAtivo.checked;
      el.lblStatusFlag.textContent = on ? 'Ativo' : 'Inativo';
      el.lblStatusFlag.classList.toggle('active', on);
      el.lblStatusFlag.classList.toggle('inactive', !on);
    }

    // máscaras
    function maskCPF(v) {
      const d = String(v || '').replace(/\D/g, '').slice(0, 11);
      const p1 = d.slice(0, 3);
      const p2 = d.slice(3, 6);
      const p3 = d.slice(6, 9);
      const p4 = d.slice(9, 11);
      let out = p1;
      if (p2) out += '.' + p2;
      if (p3) out += '.' + p3;
      if (p4) out += '-' + p4;
      return out;
    }

    function maskPhone(v) {
      const d = String(v || '').replace(/\D/g, '').slice(0, 11);
      if (!d) return '';
      if (d.length <= 2) return `(${d}`;
      if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }

    function applyMaskKeepingEnd(inputEl, masker) {
      const before = inputEl.value || '';
      const rawBefore = before.replace(/\D/g, '');
      const masked = masker(before);
      inputEl.value = masked;

      const rawAfter = masked.replace(/\D/g, '');
      const delta = rawAfter.length - rawBefore.length;

      let pos = inputEl.selectionStart ?? masked.length;
      pos = Math.max(0, Math.min(masked.length, pos + (delta > 0 ? 1 : 0)));
      inputEl.selectionStart = inputEl.selectionEnd = pos;
    }

    // CPF válido
    function isValidCPF(cpfDigits) {
      const cpf = String(cpfDigits || '').replace(/\D/g, '');
      if (cpf.length !== 11) return false;
      if (/^(\d)\1{10}$/.test(cpf)) return false;

      const calc = (base, factor) => {
        let sum = 0;
        for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
        const mod = (sum * 10) % 11;
        return mod === 10 ? 0 : mod;
      };

      const d1 = calc(cpf.slice(0, 9), 10);
      const d2 = calc(cpf.slice(0, 10), 11);
      return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
    }

    function getPayload() {
      const login = (el.login.value || '').trim();
      const email = (el.email.value || '').trim();
      const cpf = (el.cpf.value || '').replace(/\D/g, '');
      const telefone = (el.tel.value || '').replace(/\D/g, '');
      const senha = el.senha.value || '';
      const senha2 = el.senha2.value || '';
      const typeUser = Number(el.perfil.value || 0);
      const ativo = el.statusAtivo ? !!el.statusAtivo.checked : true;
      return { login, email, cpf, telefone, senha, senha2, typeUser, ativo };
    }

    function validate(p) {
      if (!p.login) return 'Informe o Nome Login.';
      if (!p.email) return 'Informe o Email.';
      if (!p.cpf) return 'Informe o CPF.';
      if (!isValidCPF(p.cpf)) return 'CPF inválido.';
      if (!p.telefone) return 'Informe o Telefone.';
      if (!p.senha) return 'Informe a Senha.';
      if (p.senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
      if (p.senha !== p.senha2) return 'As senhas não conferem.';
      if (!VALID_ROLES.includes(p.typeUser)) return 'Selecione um perfil válido.';
      return null;
    }

    function limpar() {
      el.login.value = '';
      el.email.value = '';
      el.cpf.value = '';
      el.tel.value = '';
      el.senha.value = '';
      el.senha2.value = '';
      el.perfil.value = '';
      if (el.statusAtivo) el.statusAtivo.checked = true;
      syncStatusLabel();
      setStatus('Preencha os dados e clique em “Cadastrar Usuário”.', 'info');
    }

    let currentIsAdmin = false;

    async function salvarUsuario() {
      if (!currentIsAdmin) {
        const msg = 'Você não tem permissão para Gerenciamento de Usuários (somente Admin).';
        setStatus(msg, 'error');
        toast(msg, 'warn');
        return;
      }

      const payload = getPayload();
      const err = validate(payload);
      if (err) {
        setStatus(err, 'error');
        toast(err, 'error');
        return;
      }

      try {
        setBusy(true);
        setStatus('Cadastrando usuário…', 'info');

        const resp = await fetch(`${API_BASE}/api/usuarios`, {
          method: 'POST',
          headers: { accept: '*/*', 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            login: payload.login,
            email: payload.email,
            cpf: payload.cpf,
            telefone: payload.telefone,
            senha: payload.senha,
            confirmarSenha: payload.senha2,
            typeUser: payload.typeUser,
            ativo: payload.ativo,
          }),
        });

        const data = await safeJson(resp);

        if (!resp.ok) {
          const msg = buildErrorMessage(resp, data);
          setStatus(msg, 'error');
          toast(msg, 'error');
          return;
        }

        setStatus('Usuário cadastrado com sucesso.', 'success');
        toast('Usuário cadastrado!', 'success');
        limpar();
      } catch (e) {
        console.error(e);
        setStatus('Erro ao cadastrar. Verifique console / CORS / Network.', 'error');
        toast('Erro ao cadastrar (CORS/Network).', 'error');
      } finally {
        setBusy(false);
      }
    }

    // ======================================================
    // 4.11) ALTERAÇÃO (input + datalist + hidden id) + API
    // ======================================================
    const alt = {
      busca: $('altBuscaUsuario'),
      list: $('altBuscaUsuarioList'),
      id: $('altBuscaUsuarioId'),

      fieldsWrap: $('altFormFields'),
      btnSalvar: $('btnAltSalvar'),
      statusMsg: $('altStatusMsg'),

      login: $('altLogin'),
      email: $('altEmail'),
      cpf: $('altCPF'),
      tel: $('altTelefone'),
      senha: $('altSenha'),
      senha2: $('altSenha2'),
      perfil: $('altPerfil'),
      ativo: $('altStatusAtivo'),
      lblAtivo: $('lblAltStatusFlag'),
    };

    const mapValueToId = new Map();     // key normalizada -> id
    const mapRawToId = new Map();       // key crua -> id
    const altState = {
      lastQuery: '',
      selectedDisplay: '',
      selectedId: '',
      lastList: [],
      inFlight: 0,
    };

    function setAltStatus(msg, tipo = 'info') {
      if (!alt.statusMsg) return;
      alt.statusMsg.textContent = msg;
      alt.statusMsg.classList.remove('success', 'error', 'info');
      alt.statusMsg.classList.add(tipo);
    }

    function setAltEnabled(enabled) {
      if (!alt.fieldsWrap) return;

      alt.fieldsWrap.style.opacity = enabled ? '1' : '0.5';
      alt.fieldsWrap.style.pointerEvents = enabled ? 'auto' : 'none';

      [
        alt.login, alt.email, alt.cpf, alt.tel, alt.senha, alt.senha2,
        alt.perfil, alt.ativo
      ].forEach((x) => x && (x.disabled = !enabled));

      if (alt.btnSalvar) alt.btnSalvar.disabled = !enabled;
    }

    function syncAltStatusLabel() {
      if (!alt.ativo || !alt.lblAtivo) return;
      const on = !!alt.ativo.checked;
      alt.lblAtivo.textContent = on ? 'Ativo' : 'Inativo';
      alt.lblAtivo.classList.toggle('active', on);
      alt.lblAtivo.classList.toggle('inactive', !on);
    }

    function getUserProp(u, ...keys) {
      for (const k of keys) {
        if (u && u[k] != null) return u[k];
      }
      return null;
    }

    function formatUserOption(u) {
      const nome  = String(getUserProp(u, 'nome', 'Nome', 'name', 'Name', 'nomeCompleto') || 'Sem nome').trim();
      const login = String(getUserProp(u, 'login', 'Login', 'userName', 'username') || '').trim();

      // padrão: Nome — login
      if (login) return `${login}`;
      return nome;
    }

    function renderDatalist(list) {
      if (!alt.list) return;

      alt.list.innerHTML = '';
      mapValueToId.clear();
      mapRawToId.clear();

      (list || []).forEach((u) => {
        const id = getUserProp(u, 'id', 'Id');
        const value = formatUserOption(u);
        if (!id || !value) return;

        const rawKey = String(value).trim();
        const normKey = normText(rawKey);

        mapRawToId.set(rawKey, String(id));
        mapValueToId.set(normKey, String(id));

        const opt = document.createElement('option');
        opt.value = rawKey;
        alt.list.appendChild(opt);
      });
    }

    async function fetchUsersList(searchText) {
      const q = encodeURIComponent((searchText || '').trim());
      const url = `${API_BASE}${API_USERS_LIST_PATH}?search=${q}&take=20`;

      const resp = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
      });

      if (!resp.ok) return { ok: false, status: resp.status, data: await safeJson(resp) };
      return { ok: true, status: resp.status, data: await resp.json().catch(() => null) };
    }

    async function fetchUserById(id) {
      const url = `${API_BASE}${API_USERS_ID_PATH(id)}`;

      const resp = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
      });

      if (!resp.ok) return null;
      return await resp.json().catch(() => null);
    }

    async function updateUserById(id, payload) {
      const url = `${API_BASE}${API_USERS_ID_PATH(id)}`;

      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      return resp;
    }

    function fillAltForm(u) {
      if (!u) return;

      alt.login.value = String(getUserProp(u, 'login', 'Login') || '');
      alt.email.value = String(getUserProp(u, 'email', 'Email') || '');
      alt.cpf.value   = String(getUserProp(u, 'cpf', 'Cpf') || '');
      alt.tel.value   = String(getUserProp(u, 'telefone', 'Telefone') || '');

      alt.senha.value = '';
      alt.senha2.value = '';

      alt.perfil.value = String(getUserProp(u, 'typeUser', 'TypeUser') || '');
      alt.ativo.checked = !!getUserProp(u, 'ativo', 'Ativo');

      syncAltStatusLabel();
    }

    function getAltPayload() {
      return {
        login: (alt.login.value || '').trim(),
        email: (alt.email.value || '').trim(),
        cpf: (alt.cpf.value || '').replace(/\D/g, ''),
        telefone: (alt.tel.value || '').replace(/\D/g, ''),
        typeUser: Number(alt.perfil.value || 0),
        ativo: !!alt.ativo.checked,
        senha: alt.senha.value || '',
        confirmarSenha: alt.senha2.value || '',
      };
    }

    function validateAlt(p) {
      if (!p.login) return 'Informe o Nome Login.';
      if (!p.email) return 'Informe o Email.';
      if (!p.cpf) return 'Informe o CPF.';
      if (!isValidCPF(p.cpf)) return 'CPF inválido.';
      if (!p.telefone) return 'Informe o Telefone.';
      if (!VALID_ROLES.includes(p.typeUser)) return 'Selecione um perfil válido.';

      if (p.senha || p.confirmarSenha) {
        if (p.senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
        if (p.senha !== p.confirmarSenha) return 'As senhas não conferem.';
      }
      return null;
    }

    function clearAltSelection() {
      if (alt.id) alt.id.value = '';
      altState.selectedDisplay = '';
      altState.selectedId = '';
      setAltEnabled(false);
      setAltStatus('Digite para buscar e selecione um usuário na lista.', 'info');
    }

    async function loadSelectedUserById(id) {
      setAltEnabled(false);
      setAltStatus('Carregando usuário...', 'info');

      const u = await fetchUserById(id);
      if (!u) {
        setAltStatus('Falha ao carregar usuário selecionado.', 'error');
        return;
      }

      fillAltForm(u);
      setAltEnabled(true);
      setAltStatus('Edite os campos e clique em “Salvar Alterações”.', 'info');
    }

    async function resolveTypedToId(typedRaw) {
      const typed = String(typedRaw || '').trim();
      if (!typed) return '';

      // se digitou número puro, assume que é id
      if (/^\d+$/.test(typed)) return typed;

      // tenta match exato
      const exact = mapRawToId.get(typed);
      if (exact) return exact;

      // tenta normalizado
      const idNorm = mapValueToId.get(normText(typed));
      if (idNorm) return idNorm;

      // fallback: se tiver lastList e só 1 item, auto-seleciona
      if (altState.lastList && altState.lastList.length === 1) {
        const only = altState.lastList[0];
        const id = getUserProp(only, 'id', 'Id');
        return id ? String(id) : '';
      }

      return '';
    }

    // ======================================================
    // 5) INIT — binds
    // ======================================================

    // máscaras (Cadastro)
    el.cpf && el.cpf.addEventListener('input', () => applyMaskKeepingEnd(el.cpf, maskCPF));
    el.tel && el.tel.addEventListener('input', () => applyMaskKeepingEnd(el.tel, maskPhone));

    // tabs internas
    bindInternalTabs();

    // status label (Cadastro)
    if (el.statusAtivo) el.statusAtivo.addEventListener('change', syncStatusLabel);
    syncStatusLabel();

    // botões (Cadastro)
    el.btnLimpar.addEventListener('click', (e) => { e.preventDefault(); limpar(); });
    el.btnSalvar.addEventListener('click', async (e) => { e.preventDefault(); await salvarUsuario(); });

    // ---- ALTERAÇÃO binds (só se HTML estiver no formato datalist) ----
    const hasAlt =
      alt.busca && alt.list && alt.id && alt.fieldsWrap &&
      alt.btnSalvar && alt.statusMsg &&
      alt.login && alt.email && alt.cpf && alt.tel && alt.perfil && alt.ativo;

    if (hasAlt) {
      setAltEnabled(false);
      clearAltSelection();

      // máscaras (Alteração)
      alt.cpf.addEventListener('input', () => applyMaskKeepingEnd(alt.cpf, maskCPF));
      alt.tel.addEventListener('input', () => applyMaskKeepingEnd(alt.tel, maskPhone));

      // status label (Alteração)
      alt.ativo.addEventListener('change', syncAltStatusLabel);
      syncAltStatusLabel();

      // busca incremental (robusta)
      alt.busca.addEventListener('input', debounce(async () => {
        if (!currentIsAdmin) return;

        const q = String(alt.busca.value || '').trim();

        // se o usuário já selecionou e não mudou o texto, não refaz busca (evita limpar map)
        if (q && q === altState.selectedDisplay && altState.selectedId) return;

        // ao digitar, invalida seleção anterior
        alt.id.value = '';
        altState.selectedDisplay = '';
        altState.selectedId = '';
        setAltEnabled(false);

        if (!q) {
          renderDatalist([]);
          setAltStatus('Digite para buscar e selecione um usuário na lista.', 'info');
          return;
        }

        setAltStatus('Buscando usuários...', 'info');

        const token = ++altState.inFlight;
        altState.lastQuery = q;

        const res = await fetchUsersList(q);

        // se chegou resposta antiga, ignora
        if (token !== altState.inFlight) return;

        if (!res.ok) {
          // 405 aqui = backend não tem GET /api/Usuarios ainda
          const hint = res.status === 405
            ? 'Sua API ainda não tem GET /api/Usuarios (crie o endpoint).'
            : 'Não foi possível buscar usuários (permissão/API).';

          setAltStatus(hint, 'error');
          renderDatalist([]);
          altState.lastList = [];
          return;
        }

        const list = asArray(res.data);
        altState.lastList = list;

        renderDatalist(list);
        setAltStatus(list.length ? 'Selecione um usuário na lista.' : 'Nenhum usuário encontrado.', 'info');
      }, 280));

      // seleção: change é o melhor evento aqui
      alt.busca.addEventListener('change', async () => {
        if (!currentIsAdmin) return;

        const typed = String(alt.busca.value || '').trim();
        if (!typed) {
          clearAltSelection();
          return;
        }

        const id = await resolveTypedToId(typed);

        if (!id) {
          alt.id.value = '';
          setAltEnabled(false);
          setAltStatus('Selecione um usuário válido na lista.', 'error');
          return;
        }

        alt.id.value = id;
        altState.selectedDisplay = typed;
        altState.selectedId = id;

        await loadSelectedUserById(id);
      });

      // salvar alterações
      alt.btnSalvar.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!currentIsAdmin) {
          const msg = 'Você não tem permissão para Gerenciamento de Usuários (somente Admin).';
          setAltStatus(msg, 'error');
          toast(msg, 'warn');
          return;
        }

        const id = String(alt.id.value || '').trim();
        if (!id) {
          setAltStatus('Selecione um usuário primeiro.', 'error');
          return;
        }

        const payload = getAltPayload();
        const err = validateAlt(payload);
        if (err) {
          setAltStatus(err, 'error');
          toast(err, 'error');
          return;
        }

        try {
          setAltStatus('Salvando alterações...', 'info');

          const resp = await updateUserById(id, payload);
          const data = await safeJson(resp);

          if (!resp.ok) {
            const msg = buildErrorMessage(resp, data);
            setAltStatus(msg, 'error');
            toast(msg, 'error');
            return;
          }

          setAltStatus('Alterações salvas com sucesso.', 'success');
          toast('Alterações salvas!', 'success');

          // opcional: re-carrega o usuário (confirma persistência)
          await loadSelectedUserById(id);
        } catch (err2) {
          console.error(err2);
          setAltStatus('Erro ao salvar alterações (Network/CORS).', 'error');
          toast('Erro ao salvar (CORS/Network).', 'error');
        }
      });

    } else {
      console.warn('[GerenciamentoUsuarios] Área de alteração não está no formato datalist (altBuscaUsuario + altBuscaUsuarioList + altBuscaUsuarioId).');
    }

    // ======================================================
    // 6) ROLE GATING
    // ======================================================
    const role = await getViewerRole();
    if (VALID_ROLES.includes(Number(role))) applyRoleVisibility(Number(role));

    currentIsAdmin = (Number(role) === ADMIN_ROLE);
    showAdminUI(currentIsAdmin);

    if (!currentIsAdmin) {
      toast('Você não tem permissão para Gerenciamento de Usuários (somente Admin).', 'warn');
      return;
    }

    setStatus('Preencha os dados e clique em “Cadastrar Usuário”.', 'info');
    if (hasAlt) setAltStatus('Digite para buscar e selecione um usuário na lista.', 'info');
  }

  // START
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();