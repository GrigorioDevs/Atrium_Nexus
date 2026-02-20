// Assets/JS/user-menu.js
(() => {
  'use strict';

  const btn   = document.getElementById('btnUserMenu');
  const menu  = document.getElementById('userMenu');

  const spanInitialsTop = document.getElementById('topUserInitials');

  const avatarCircle = document.getElementById('userMenuAvatar');
  const avatarInput  = document.getElementById('userMenuAvatarInput');

  const nameEl    = document.getElementById('userMenuName');
  const emailEl   = document.getElementById('userMenuEmail'); // aqui será o TIPO de usuário
  const btnLogout = document.getElementById('btnUserLogout');

  if (!btn || !menu) return;

  // Fallback antigo (base64 no localStorage) - mantido, mas removemos quando existe URL do banco
  const AVATAR_LS_KEY = 'USER_AVATAR_DATAURL';

  // ✅ Base da API
  const API_BASE_LS_KEY = 'ATRIUM_API_BASE';

  // Endpoints
  const API_ME_PATH = '/api/Usuarios/me';          // seu swagger mostra com U maiúsculo
  const API_AVATAR_PATH = '/api/Usuarios/me/avatar';

  // Evita corrida de GET /me
  let meAbort = null;

  // Cache da base
  let _apiBaseCache = null;

  /* -------------------------------
     Resolver base da API (evita chamar localhost:5500)
     ------------------------------- */

  function getMetaApiBase() {
    try {
      return document.querySelector('meta[name="atrium-api-base"]')?.content?.trim() || '';
    } catch {
      return '';
    }
  }

  function normalizeBase(base) {
    if (!base) return '';
    return String(base).trim().replace(/\/+$/, ''); // remove / no final
  }

  function joinUrl(base, path) {
    const b = normalizeBase(base);
    if (!b) return path; // same-origin
    return b + path;
  }

  async function probeApiBase(base, timeoutMs = 1200) {
    const url = joinUrl(base, API_ME_PATH);

    const ctrl = new AbortController();
    const t = setTimeout(() => {
      try { ctrl.abort(); } catch {}
    }, timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        mode: 'cors',
        cache: 'no-store',
        headers: { 'accept': 'application/json' },
        signal: ctrl.signal
      });

      // ✅ 200/401/403 = existe endpoint real (API)
      if ([200, 401, 403].includes(res.status)) return true;

      // ❌ 404/405 = normalmente é o server do front (Live Server)
      if ([404, 405].includes(res.status)) return false;

      // Qualquer outro ainda indica "tem um server lá"
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  }

  async function resolveApiBase() {
    if (_apiBaseCache !== null) return _apiBaseCache;

    // 1) window.ATRIUM_API_BASE
    const fromWindow = normalizeBase(window.ATRIUM_API_BASE || '');
    if (fromWindow) {
      _apiBaseCache = fromWindow;
      try { localStorage.setItem(API_BASE_LS_KEY, fromWindow); } catch {}
      return _apiBaseCache;
    }

    // 2) meta tag
    const fromMeta = normalizeBase(getMetaApiBase());
    if (fromMeta) {
      _apiBaseCache = fromMeta;
      try { localStorage.setItem(API_BASE_LS_KEY, fromMeta); } catch {}
      return _apiBaseCache;
    }

    // 3) localStorage
    let fromLs = '';
    try { fromLs = normalizeBase(localStorage.getItem(API_BASE_LS_KEY) || ''); } catch {}
    if (fromLs) {
      const ok = await probeApiBase(fromLs);
      if (ok) {
        _apiBaseCache = fromLs;
        return _apiBaseCache;
      }
    }

    // 4) same-origin (se API e front estiverem na mesma origem)
    {
      const ok = await probeApiBase('');
      if (ok) {
        _apiBaseCache = '';
        try { localStorage.setItem(API_BASE_LS_KEY, ''); } catch {}
        return _apiBaseCache;
      }
    }

    // 5) auto-discovery (localhost)
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';

    if (isLocal) {
      const ports = [5253, 5252, 5001, 5000, 7001, 7000, 7071, 5200, 5100, 5050];
      for (const p of ports) {
        const base = `http://${host}:${p}`;
        const ok = await probeApiBase(base);
        if (ok) {
          _apiBaseCache = normalizeBase(base);
          try { localStorage.setItem(API_BASE_LS_KEY, _apiBaseCache); } catch {}
          console.warn('[user-menu] API base resolvida:', _apiBaseCache);
          return _apiBaseCache;
        }
      }
    }

    _apiBaseCache = '';
    console.warn('[user-menu] Não consegui descobrir a base da API. Defina window.ATRIUM_API_BASE="http://localhost:5253".');
    return _apiBaseCache;
  }

  async function apiUrl(path) {
    const base = await resolveApiBase();
    return joinUrl(base, path);
  }

  /* -------- Helpers -------- */

  function mapTypeUserToLabel(typeUser) {
    switch (Number(typeUser)) {
      case 1: return 'Admin';
      case 2: return 'Gestão';
      case 3: return 'RH';
      case 4: return 'Funcionário';
      default: return 'Usuário';
    }
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('usuario');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { nome: 'Colaborador(a)', email: '', funcao: 'Usuário' };
  }

  function setCurrentUser(me) {
    try {
      localStorage.setItem('usuario', JSON.stringify(me));
    } catch {}
  }

  function getInitials(nome) {
    if (!nome) return 'US';
    const parts = String(nome).trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last || first).toUpperCase();
  }

  function getUserImgFromMe(me) {
    return (
      (me && (me.userImg || me.user_img || me.foto || me.avatar || me.avatarUrl)) ||
      ''
    );
  }

  // ✅ aplica avatar tanto via CSS var quanto via innerHTML (img)
  function applyAvatarUrl(url) {
    const finalUrl = String(url || '').trim();

    // 1) CSS var (mantém seu estilo atual de anel/degradê)
    if (avatarCircle) {
      if (finalUrl) {
        avatarCircle.style.setProperty('--avatar-url', `url("${finalUrl}")`);
        avatarCircle.classList.add('has-photo');
      } else {
        avatarCircle.style.setProperty('--avatar-url', 'none');
        avatarCircle.classList.remove('has-photo');
      }

      // 2) innerHTML (garante render mesmo se CSS do var não estiver perfeito)
      if (finalUrl) {
        avatarCircle.innerHTML = `
          <img
            src="${finalUrl}"
            alt="Foto do usuário"
            style="width:100%;height:100%;display:block;object-fit:cover;border-radius:999px;"
            loading="lazy"
          />
        `;
      } else {
        avatarCircle.innerHTML = `<i class="fa-regular fa-user" aria-hidden="true"></i>`;
      }
    }

    // Topbar
    if (spanInitialsTop) {
      if (finalUrl) {
        spanInitialsTop.style.backgroundImage = `url("${finalUrl}")`;
        spanInitialsTop.style.backgroundSize = 'cover';
        spanInitialsTop.style.backgroundPosition = 'center';
        spanInitialsTop.textContent = '';
      } else {
        spanInitialsTop.style.backgroundImage = 'none';
        // texto (iniciais) é setado em fillUserInfo()
      }
    }
  }

  function applyAvatarFromStorage(me) {
    const userImg = getUserImgFromMe(me);
    const saved = localStorage.getItem(AVATAR_LS_KEY) || '';

    // prioridade: URL do banco
    const finalUrl = userImg || saved || '';

    if (userImg) {
      // se tem no banco, não precisa base64 local
      try { localStorage.removeItem(AVATAR_LS_KEY); } catch {}
    }

    applyAvatarUrl(finalUrl);
  }

  function fillUserInfo() {
    const me = getCurrentUser();

    const nome =
      me.nome ||
      me.nomeCompleto ||
      me.name ||
      'Colaborador(a)';

    const funcao =
      me.funcao ||
      me.role ||
      mapTypeUserToLabel(me.typeUser);

    const initials = getInitials(nome);

    if (spanInitialsTop) {
      // se não tiver foto, mostra iniciais
      if (!getUserImgFromMe(me)) {
        spanInitialsTop.textContent = initials;
        spanInitialsTop.style.backgroundImage = 'none';
      }
    }

    if (nameEl)  nameEl.textContent  = nome;
    if (emailEl) emailEl.textContent = funcao;

    applyAvatarFromStorage(me);
  }

  async function refreshMeFromApi() {
    try { meAbort?.abort?.(); } catch {}
    meAbort = new AbortController();

    try {
      const url = await apiUrl(API_ME_PATH);

      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        mode: 'cors',
        headers: { 'accept': 'application/json' },
        signal: meAbort.signal
      });

      if (res.status === 401 || res.status === 403) {
        return null; // não logado
      }

      if (!res.ok) {
        console.warn('GET /me falhou:', res.status, url);
        return null;
      }

      const apiMe = await res.json().catch(() => null);
      if (!apiMe) return null;

      // seu endpoint retorna: { id, nome, email, typeUser, userImg }
      const old = getCurrentUser();

      const merged = {
        ...old,
        ...apiMe,
        funcao: old.funcao || mapTypeUserToLabel(apiMe.typeUser),
        nome: apiMe.nome ?? old.nome,
        userImg: apiMe.userImg ?? old.userImg ?? old.user_img ?? old.avatar ?? old.foto
      };

      // compatibilidade snake_case
      if (merged.userImg) merged.user_img = merged.userImg;

      setCurrentUser(merged);
      return merged;
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.warn('refreshMeFromApi erro:', err);
      }
      return null;
    }
  }

  /* -------- Menu -------- */

  function openMenu() {
    // atualiza do banco e reflete
    refreshMeFromApi().finally(() => fillUserInfo());

    menu.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
  }

  function closeMenu() {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  }

  function toggleMenu() {
    if (menu.classList.contains('open')) closeMenu();
    else openMenu();
  }

  /* -------- Upload da foto (POST no backend) -------- */

  async function handleAvatarUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Preview imediato
    const previewUrl = URL.createObjectURL(file);
    applyAvatarUrl(previewUrl);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const url = await apiUrl(API_AVATAR_PATH);

      const res = await fetch(url, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        mode: 'cors'
      });

      if (res.status === 401 || res.status === 403) {
        throw new Error('Não autenticado. Faça login novamente.');
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha no upload (${res.status}). ${txt}`.trim());
      }

      const data = await res.json().catch(() => ({}));
      // esperado: { url: "http://localhost:5253/storage/..." }
      const avatarUrl = (data?.url || data?.Url || '').trim();

      if (!avatarUrl) {
        throw new Error('Upload ok, mas a API não retornou a URL.');
      }

      // Atualiza usuário no localStorage
      const old = getCurrentUser();
      const updated = {
        ...old,
        userImg: avatarUrl,
        user_img: avatarUrl
      };
      setCurrentUser(updated);

      // remove fallback antigo base64
      try { localStorage.removeItem(AVATAR_LS_KEY); } catch {}

      // aplica a URL final
      applyAvatarUrl(avatarUrl);

      // opcional: atualizar textos também
      fillUserInfo();

    } catch (err) {
      console.error(err);

      // volta pro que estava salvo
      const me = getCurrentUser();
      applyAvatarFromStorage(me);

      alert('Não foi possível atualizar a foto. Veja o console.');
    } finally {
      try { URL.revokeObjectURL(previewUrl); } catch {}
      try { e.target.value = ''; } catch {}
    }
  }

  avatarCircle?.addEventListener('click', () => {
    avatarInput?.click();
  });

  avatarInput?.addEventListener('change', handleAvatarUpload);

  /* -------- Eventos gerais -------- */

  // clique no avatar da topbar abre/fecha o menu
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    toggleMenu();
  });

  // clique fora fecha
  document.addEventListener('click', (ev) => {
    if (!menu.classList.contains('open')) return;
    if (menu.contains(ev.target) || ev.target === btn) return;
    closeMenu();
  });

  // ESC fecha
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && menu.classList.contains('open')) {
      closeMenu();
    }
  });

  // ação de sair
  btnLogout?.addEventListener('click', () => {
    try {
      if (typeof window.handleLogout === 'function') {
        window.handleLogout();
        return;
      }
    } catch {}

    localStorage.clear();
    window.location.href = 'Index.html';
  });

  // Inicializa: tenta API e depois renderiza
  refreshMeFromApi().finally(() => fillUserInfo());
})();