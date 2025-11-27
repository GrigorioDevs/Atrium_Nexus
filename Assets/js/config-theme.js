// config-theme.js
(() => {
  'use strict';

  const KEY_THEME = 'rh_theme_v2';
  const KEY_AUTH = 'rh_auth_v1';

  const THEMES = {
    aurora: {
      name: 'Cosmic (neon)',
      vars: {
      // Fundo geral (parecido com o neon, um pouco mais “profundo”)
      bg: '#020617',

      // Cartões / superfícies principais
      surface: '#060b1b',

      // Texto principal
      text: '#e5f0ff',

      // Texto secundário
      muted: '#9ca3af',

      // Cores base do gradiente do botão "Gerar documento"
      // (essas normalmente viram --accent1 e --accent2)
      primary: '#00e0ff',   // ciano neon
      accent:  '#ff2fb9',   // magenta neon

      // Borda de cartões, inputs etc.
      border: 'rgba(148, 163, 184, 0.35)',

      // Estados (mantive na vibe neon mas bem legíveis)
      ok:   '#22c55e',
      warn: '#eab308',
      err:  '#f97373'
      }
    },
    midnight: {
      name: 'Midnight (escuro)',
      vars: {
        bg: '#0b1220',
        surface: '#121a2b',
        text: '#e6edf3',
        muted: '#9fb1c3',
        primary: '#7aa2ff',
        accent: '#4ade80',
        border: '#24324a',
        ok: '#22c55e',
        warn: '#eab308',
        err: '#f87171'
      }
    },
    neon: {
      name: 'Neon (alto contraste)',
      vars: {
        bg: '#000000',
        surface: '#0d0d10',
        text: '#ffffff',
        muted: '#bdbdbd',
        primary: '#ff2fb9',
        accent: '#00e0ff',
        border: '#222222',
        ok: '#22d3ee',
        warn: '#fbbf24',
        err: '#fb7185'
      }
    }
  };

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) =>
    Array.from(root.querySelectorAll(sel));

  const safeNotify = (msg, type = 'info') => {
    try {
      if (typeof notify === 'function') return notify(msg, type);
    } catch {}
    window.alert(String(msg));
  };

  /* ===================== TEMA (CSS VARS) ===================== */

  function ensureThemeStyle() {
    let s = qs('#themeVars');
    if (!s) {
      s = document.createElement('style');
      s.id = 'themeVars';
      document.head.appendChild(s);
    }
    return s;
  }

  function setThemeVars(vars) {
    const s = ensureThemeStyle();
    const rootVars = Object.entries(vars)
      .map(([k, v]) => `--${k}:${v}`)
      .join(';');
    s.textContent = `
      :root{${rootVars}}
      body{background:var(--bg);color:var(--text)}
      .card{background:var(--surface);border:1px solid var(--border)}
      .card-header{border-bottom:1px solid var(--border);color:var(--text)}
      .btn{background:var(--primary);border:1px solid var(--primary);color:#fff}
      .btn:hover{filter:brightness(.95)}
      .btn-light,.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text)}
      input,select,textarea{background:var(--surface);color:var(--text);border:1px solid var(--border)}
      a{color:var(--primary)}
      .sidebar{background:var(--surface);border-right:1px solid var(--border)}
      .table-wrap table{background:var(--surface);color:var(--text)}
      .status-dot.ok{background:var(--ok)} .status-dot.warn{background:var(--warn)} .status-dot.err{background:var(--err)}
      .toast{background:var(--surface);border:1px solid var(--border);color:var(--text)}
      .toast.info{border-left:4px solid var(--primary)}
      .toast.success{border-left:4px solid var(--ok)}
      .toast.warn{border-left:4px solid var(--warn)}
      .toast.error{border-left:4px solid var(--err)}
    `;
  }

  function applyTheme(key) {
    const t = THEMES[key] || THEMES.aurora;
    document.documentElement.setAttribute('data-theme', key);
    setThemeVars(t.vars);
    localStorage.setItem(KEY_THEME, key);
    qsa('.theme-option').forEach((el) =>
      el.classList.toggle('active', el.dataset.theme === key)
    );
  }

  function initThemeAtStartup() {
    const saved = localStorage.getItem(KEY_THEME) || 'aurora';
    applyTheme(saved);
  }

  /* ===================== SENHA LOCAL ===================== */

  const enc = new TextEncoder();
  const subtle = crypto && crypto.subtle ? crypto.subtle : null;

  const hex = (buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  const randHex = (n = 16) => {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a)
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
  };

  async function sha256Hex(str) {
    if (!subtle)
      return btoa(unescape(encodeURIComponent(str))); // fallback simples
    const buf = await subtle.digest('SHA-256', enc.encode(str));
    return hex(buf);
  }

  async function hashPassword(pass, salt) {
    return sha256Hex(`${salt}|${pass}`);
  }

  function getAuth() {
    try {
      return JSON.parse(localStorage.getItem(KEY_AUTH) || 'null');
    } catch {
      return null;
    }
  }

  function setAuth(o) {
    localStorage.setItem(KEY_AUTH, JSON.stringify(o || {}));
  }

  async function verifyPassword(plain) {
    const a = getAuth();
    if (!a || !a.hash) return (plain || '') === ''; // se nunca definiu senha
    const h = await hashPassword(plain || '', a.salt || '');
    return h === a.hash;
  }

  async function saveNewPassword(newPass) {
    const salt = randHex(16);
    const hash = await hashPassword(newPass, salt);
    setAuth({
      alg: 'SHA-256',
      salt,
      hash,
      updatedAt: new Date().toISOString()
    });
  }

  /* ===================== ESTILOS BASE (FAB + MODAL) ===================== */

  function ensureBaseStyles() {
    if (qs('#cfgBaseStyles')) return;
    const s = document.createElement('style');
    s.id = 'cfgBaseStyles';
    s.textContent = `
      #cfgFab{
        position:fixed;right:24px;bottom:24px;width:56px;height:56px;border-radius:9999px;
        border:none;cursor:pointer;z-index:9999;display:grid;place-items:center;
        background:var(--primary);color:#fff;font-size:22px;
        box-shadow:0 10px 25px rgba(0,0,0,.25)
      }
      #cfgFab:active{transform:scale(.98)}
      #cfgOverlay{
        position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;z-index:9998
      }
      #cfgModal{
        position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(820px,96vw);max-height:86vh;overflow:auto;
        background:var(--surface);border:1px solid var(--border);
        border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);
        display:none;z-index:9999
      }
      #cfgModal .modal-header{
        display:flex;align-items:center;justify-content:space-between;
        padding:14px 16px;border-bottom:1px solid var(--border)
      }
      #cfgModal .modal-body{padding:16px}
      #cfgClose{
        background:transparent;border:1px solid var(--border);
        border-radius:8px;padding:6px 10px;color:var(--text);cursor:pointer
      }
      .theme-grid{
        display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
        gap:14px;margin-top:10px
      }
      .theme-option{
        border:1px solid var(--border);border-radius:14px;padding:12px;
        cursor:pointer;background:var(--surface);transition:transform .12s ease
      }
      .theme-option:hover{transform:translateY(-2px)}
      .theme-option.active{outline:2px solid var(--primary)}
      .theme-name{font-weight:600;margin-bottom:8px}
      .swatches{display:flex;gap:6px}
      .sw{width:26px;height:26px;border-radius:7px;border:1px solid var(--border)}
      .grid2{display:grid;gap:18px;grid-template-columns:1fr}
      @media(min-width:992px){.grid2{grid-template-columns:1fr 1fr}}
      .cfg-row{display:flex;flex-direction:column;margin:8px 0}
      .cfg-row label{font-size:.9rem;color:var(--muted);margin-bottom:6px}
      .cfg-row input{height:40px;border-radius:8px;padding:8px 10px}
      #toastContainer{
        position:fixed;right:20px;bottom:92px;
        display:flex;flex-direction:column;gap:10px;z-index:10000
      }
      .toast{
        opacity:0;transform:translateY(8px);transition:all .18s ease;
        border-radius:10px;padding:10px 12px
      }
      .toast.show{opacity:1;transform:translateY(0)}
      .toast .close{margin-left:10px;cursor:pointer}
    `;
    document.head.appendChild(s);
  }

  function themeOptionHTML(key, t) {
    const v = t.vars;
    const sw = (c) => `<span class="sw" style="background:${c}"></span>`;
    return `
      <div class="theme-option" data-theme="${key}" role="button"
           tabindex="0" aria-label="Trocar para ${t.name}">
        <div class="theme-name">${t.name}</div>
        <div class="swatches">
          ${sw(v.primary)} ${sw(v.accent)} ${sw(v.surface)} ${sw(v.text)} ${sw(
            v.border
          )}
        </div>
      </div>
    `;
  }

  /* ===================== MODAL DE CONFIGURAÇÕES ===================== */

  function ensureConfigModal() {
    if (qs('#cfgModal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'cfgOverlay';

    const modal = document.createElement('div');
    modal.id = 'cfgModal';
    modal.innerHTML = `
      <div class="modal-header">
        <h3 style="margin:0">Configurações</h3>
        <button id="cfgClose">Fechar</button>
      </div>
      <div class="modal-body">
        <div class="grid2">
          <section>
            <h4 style="margin:.2rem 0 .3rem">Aparência</h4>
            <p>Escolha uma das <strong>3 paletas</strong>. Aplica na hora e salva no dispositivo.</p>
            <div class="theme-grid">
              ${Object.entries(THEMES)
                .map(([k, t]) => themeOptionHTML(k, t))
                .join('')}
            </div>
          </section>
          <section>
            <h4 style="margin:.2rem 0 .3rem">Segurança</h4>
            <div class="cfg-row">
              <label for="cfgPassCurrent">Senha atual (vazio se nunca definiu)</label>
              <input type="password" id="cfgPassCurrent" autocomplete="current-password" placeholder="••••••••">
            </div>
            <div class="cfg-row">
              <label for="cfgPassNew">Nova senha</label>
              <input type="password" id="cfgPassNew" autocomplete="new-password" placeholder="mínimo 6 caracteres">
            </div>
            <div class="cfg-row">
              <label for="cfgPassNew2">Confirmar nova senha</label>
              <input type="password" id="cfgPassNew2" autocomplete="new-password" placeholder="repita a nova senha">
            </div>
            <button class="btn" id="btnSavePassword">Salvar nova senha</button>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // FAB
    const fab = document.createElement('button');
    fab.id = 'cfgFab';
    fab.title = 'Configurações (Ctrl+,)';
    fab.setAttribute('aria-label', 'Abrir Configurações');
    fab.innerHTML = '⚙️';
    document.body.appendChild(fab);

    // Garante container de toasts (caso core.js ainda não tenha criado)
    if (!qs('#toastContainer')) {
      const tc = document.createElement('div');
      tc.id = 'toastContainer';
      document.body.appendChild(tc);
    }

    const open = () => {
      overlay.style.display = 'block';
      modal.style.display = 'block';
      fab.style.display = 'none';
    };
    const close = () => {
      overlay.style.display = 'none';
      modal.style.display = 'none';
      fab.style.display = 'grid';
    };

    overlay.addEventListener('click', close);
    qs('#cfgClose', modal)?.addEventListener('click', close);
    fab.addEventListener('click', open);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        open();
      }
      if (e.key === 'Escape') close();
    });

    // eventos de tema
    qsa('.theme-option', modal).forEach((el) => {
      el.addEventListener('click', () => applyTheme(el.dataset.theme));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          applyTheme(el.dataset.theme);
        }
      });
    });

    // marca tema atual
    const current = localStorage.getItem(KEY_THEME) || 'aurora';
    qsa('.theme-option').forEach((el) =>
      el.classList.toggle('active', el.dataset.theme === current)
    );

    // eventos de senha
    qs('#btnSavePassword', modal)?.addEventListener('click', async () => {
      const cur = qs('#cfgPassCurrent')?.value || '';
      const n1 = qs('#cfgPassNew')?.value || '';
      const n2 = qs('#cfgPassNew2')?.value || '';

      if (!n1 || n1.length < 6)
        return safeNotify(
          'A nova senha deve ter ao menos 6 caracteres.',
          'warn'
        );
      if (n1 !== n2)
        return safeNotify('A confirmação não confere.', 'warn');

      const ok = await verifyPassword(cur);
      if (!ok) return safeNotify('Senha atual incorreta.', 'error');

      await saveNewPassword(n1);
      if (qs('#cfgPassCurrent')) qs('#cfgPassCurrent').value = '';
      if (qs('#cfgPassNew')) qs('#cfgPassNew').value = '';
      if (qs('#cfgPassNew2')) qs('#cfgPassNew2').value = '';
      safeNotify('Senha alterada com sucesso.', 'success');
    });

    // Integração opcional com menu existente
    const menu = qs('#menu');
    if (menu && !menu.querySelector('[data-open-config]')) {
      const li = document.createElement('li');
      li.setAttribute('data-open-config', 'true');
      li.style.cursor = 'pointer';
      li.innerHTML = '⚙️ Configurações';
      li.addEventListener('click', open);
      menu.appendChild(li);
    }
  }

  /* ===================== BOOT ===================== */

  function boot() {
    ensureThemeStyle();
    initThemeAtStartup();
    ensureBaseStyles();
    ensureConfigModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
