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

    const AVATAR_LS_KEY = 'USER_AVATAR_DATAURL';

    /* -------- Helpers -------- */

    function getCurrentUser() {
    try {
        if (typeof window.getMe === 'function') {
        const me = window.getMe();
        if (me) return me;
        }
    } catch {}

    try {
        const raw = localStorage.getItem('usuario');
        if (raw) return JSON.parse(raw);
    } catch {}

    return { nome: 'Colaborador(a)', email: '', funcao: 'Usuário' };
    }

    function getInitials(nome) {
    if (!nome) return 'US';
    const parts = String(nome).trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last || first).toUpperCase();
    }

    function applyAvatarFromStorage(me) {
    const saved = localStorage.getItem(AVATAR_LS_KEY) || '';
    const fotoDoUsuario = (me && (me.foto || me.avatar)) || '';
    const dataUrl = saved || fotoDoUsuario || '';

    // avatar do card (anel em degradê com foto dentro via CSS var)
    if (avatarCircle) {
        if (dataUrl) {
        avatarCircle.style.setProperty('--avatar-url', `url("${dataUrl}")`);
        avatarCircle.classList.add('has-photo');
        } else {
        avatarCircle.style.setProperty('--avatar-url', 'none');
        avatarCircle.classList.remove('has-photo');
        }
    }

    // bolinha do topo (span com fundo = foto)
    if (spanInitialsTop) {
        if (dataUrl) {
        spanInitialsTop.style.backgroundImage = `url("${dataUrl}")`;
        spanInitialsTop.style.backgroundSize = 'cover';
        spanInitialsTop.style.backgroundPosition = 'center';
        spanInitialsTop.textContent = '';
        } else {
        spanInitialsTop.style.backgroundImage = 'none';
        // o texto (iniciais) é setado em fillUserInfo()
        }
    }
    }

    function fillUserInfo() {
    const me = getCurrentUser();
    const nome   = me.nome   || me.nomeCompleto || 'Colaborador(a)';
    const funcao = me.funcao || 'Usuário'; // aqui vem o tipo de usuário (Admin, Gestão, etc.)

    const initials = getInitials(nome);

    if (spanInitialsTop) {
        spanInitialsTop.textContent = initials;
        spanInitialsTop.style.backgroundImage = 'none';
    }

    if (nameEl)  nameEl.textContent  = nome;
    if (emailEl) emailEl.textContent = funcao;

    applyAvatarFromStorage(me);
    }


  function openMenu() {
    fillUserInfo();
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

  /* -------- Upload da foto -------- */

function handleAvatarUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (!dataUrl) return;

    try {
      localStorage.setItem(AVATAR_LS_KEY, dataUrl);
    } catch (err) {
      console.warn('Não foi possível salvar avatar no localStorage:', err);
    }

    // aplica usando a mesma função (mantém bordas em degradê)
    const me = getCurrentUser();
    applyAvatarFromStorage(me);
  };
  reader.readAsDataURL(file);
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

    // fallback simples
    localStorage.clear();
    window.location.href = 'Index.html';
  });

  // inicializa com dados atuais (ícone + nome + tipo usuário)
  fillUserInfo();
})();
