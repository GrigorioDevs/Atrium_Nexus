/* RCR Engenharia — RH — home.js (corrigido / robusto)
   Depende (quando existir): core.js, ponto.js, funcionarios.js, beneficios-vt.js,
   beneficios-vr.js, docs-assinatura.js etc.
*/
(() => {
  'use strict';

  // Fallback do helper $ (caso core.js não tenha carregado ainda)
  const $ = (window.$ && typeof window.$ === 'function')
    ? window.$
    : (id) => document.getElementById(id);

  const q = (sel, root = document) => root.querySelector(sel);

  /* ===================== SIDEBAR (robusto) ===================== */

  function getSidebarEl() {
    return $('sidebar');
  }

const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar(){
  if (!sidebar) return;
  sidebar.classList.add('active');
  document.body.classList.add('sidebar-open');
  if (sidebarOverlay){ sidebarOverlay.hidden = false; }
}

function closeSidebar(){
  if (!sidebar) return;
  sidebar.classList.remove('active');
  document.body.classList.remove('sidebar-open');
  if (sidebarOverlay){ sidebarOverlay.hidden = true; }
}

sidebarOverlay?.addEventListener('click', closeSidebar);

  function toggleSidebar() {
    const sb = getSidebarEl();
    if (!sb) return;
    const willOpen = !sb.classList.contains('active');
    if (willOpen) openSidebar();
    else closeSidebar();
  }

  // Delegação: funciona mesmo se o botão existir depois / e evita problemas no mobile
  document.addEventListener('click', (e) => {
    // Botão hambúrguer
    if (e.target.closest('#btnHamb')) {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
      return;
    }

    // Botão "Voltar" no mobile
    if (e.target.closest('#btnCloseSidebar')) {
      e.preventDefault();
      e.stopPropagation();
      closeSidebar();
      return;
    }
  }, true);

  // Se clicar fora da sidebar em mobile e ela estiver aberta, fecha (opcional e útil)
  document.addEventListener('click', (e) => {
    const sb = getSidebarEl();
    if (!sb) return;

    const isMobile = window.innerWidth <= 960;
    const isOpen = sb.classList.contains('active');
    if (!isMobile || !isOpen) return;

    // se clicou dentro da sidebar, não fecha
    if (e.target.closest('#sidebar')) return;
    // se clicou no hambúrguer não fecha aqui (já tratamos acima)
    if (e.target.closest('#btnHamb')) return;

    closeSidebar();
  });

  // Em resize: limpando estado mobile quando virar desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 960) closeSidebar();
  });

  /* ===================== DOCUMENTOS (mount simples) ===================== */

  let __docsAppMounted = false;
  function mountDocsApp() {
    if (__docsAppMounted) return;

    const root = document.getElementById('docs-sign-root');
    if (!root) {
      __docsAppMounted = true;
      return;
    }

    root.classList.add('docs-shell');
    root.style.display = 'block';
    root.style.height = '100%';

    __docsAppMounted = true;
  }

  /* ===================== MENU / TABS ===================== */

  function activateTab(tabId) {
    if (!tabId) return;

    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');

    // Fecha sidebar em telas pequenas ao escolher aba
    if (window.innerWidth <= 960) closeSidebar();

    // Ações ao trocar de aba (guardadas)
    if (tabId === 'tabIncluir' && typeof initMap === 'function') {
      try { initMap(); } catch {}
    }

    if (tabId === 'tabDocs') mountDocsApp();

    if (tabId === 'tabVT' && typeof window.renderVT === 'function') {
      try { window.renderVT(); } catch {}
    }
    if (tabId === 'tabVR' && typeof window.renderVR === 'function') {
      try { window.renderVR(); } catch {}
    }

    if (tabId === 'tabPonto') {
      setTimeout(() => {
        try { fitPontoTableToViewport(); } catch {}
      }, 60);
    }

    // Move a grade de funcionários entre "Funcionários" e "Gestão de Funcionários"
    try {
      const empGrid = $('empGrid');
      const empGridHostGestao = $('empGridHostGestao');

      if (tabId === 'tabFuncGestao') {
        if (empGridHostGestao && empGrid && empGridHostGestao !== empGrid.parentElement) {
          empGridHostGestao.appendChild(empGrid);
        }
      } else if (tabId === 'tabFuncionarios') {
        const body = q('#tabFuncionarios .card-body');
        if (body && empGrid && !body.contains(empGrid)) body.appendChild(empGrid);
      }
    } catch {}
  }

  // Clique no menu lateral
  q('#menu')?.addEventListener('click', (e) => {
    const clickedRowHead = e.target.closest('.row-head');
    const rootItem = e.target.closest('li.has-submenu');
    const clickedSubItem = e.target.closest('ul.submenu > li[data-tab]');
    const li = e.target.closest('li[data-tab]');

    // Abre/fecha cabeçalho de grupo (Funcionários / Benefícios)
    if (clickedRowHead && rootItem) {
      rootItem.classList.toggle('open');
      rootItem.classList.add('active');
      return;
    }

    if (!li) return;

    // Item com submenu: primeiro clique só abre submenu
    if (li.classList.contains('has-submenu') && !clickedSubItem) {
      li.classList.toggle('open');
      li.classList.add('active');
      return;
    }

    // Limpa seleção anterior
    document
      .querySelectorAll('.menu li, .menu li .submenu li')
      .forEach((x) => x.classList.remove('active'));
    li.classList.add('active');

    // Marca o pai como ativo/aberto se for submenu
    const parentRoot = li.closest('li.has-submenu');
    if (parentRoot) parentRoot.classList.add('active', 'open');

    const tab = li.getAttribute('data-tab');
    activateTab(tab);
  });

  /* ===================== RELÓGIO / AGORA ===================== */

  function safeNowTime() {
    try {
      return (typeof window.nowTime === 'function')
        ? window.nowTime()
        : new Date().toLocaleTimeString('pt-BR');
    } catch {
      return new Date().toLocaleTimeString('pt-BR');
    }
  }

  function tick() {
    const clk = $('nowClock');
    const lblAgora = $('lblAgora');
    if (clk) clk.textContent = safeNowTime();
    if (lblAgora) lblAgora.textContent = new Date().toLocaleString('pt-BR');
  }
  setInterval(tick, 1000);
  tick();

  /* ===================== PERFIL (usuário logado) ===================== */

  (function initMe() {
    if (typeof window.getMe !== 'function') return;

    try {
      const me = window.getMe() || {};
      $('uNome') && ($('uNome').textContent = me.nome || 'Colaborador(a)');
      $('uFuncao') && ($('uFuncao').textContent = me.funcao || 'Função');
      $('helloNome') && ($('helloNome').textContent = me.nome || 'Colaborador(a)');
    } catch {}
  })();

  /* ===================== SEED DE BATIMENTOS (demo) ===================== */

  (function seedPunchesIfNeeded() {
    if (
      typeof window.getAllPunches !== 'function' ||
      typeof window.setAllPunches !== 'function' ||
      typeof window.toYMD !== 'function'
    ) return;

    try {
      if (window.getAllPunches().length > 0) return;

      const seed = [];
      const base = new Date();
      base.setDate(base.getDate() - 7);

      for (let i = 0; i < 10; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const ymd = window.toYMD(d);
        if (d.getDay() !== 0) {
          seed.push({ date: ymd, time: '09:00', type: 'Entrada', origin: 'Web', note: '' });
          seed.push({ date: ymd, time: '12:00', type: 'Saída', origin: 'Web', note: 'Almoço' });
          seed.push({ date: ymd, time: '13:00', type: 'Entrada', origin: 'Web', note: '' });
          seed.push({ date: ymd, time: '18:00', type: 'Saída', origin: 'Web', note: '' });
        }
      }
      window.setAllPunches(seed);
    } catch {}
  })();

  /* ===================== MAPA & GEO (para bater ponto) ===================== */

  let mapInited = false;
  let map;
  let marker;

  function initMap() {
    // expõe para activateTab
    if (mapInited) return;
    if (typeof window.L === 'undefined') return; // Leaflet não carregado

    mapInited = true;

    const skel = q('#map .map-skeleton');
    const last = JSON.parse(localStorage.getItem('lastLatLng') || 'null');

    map = window.L.map('map', { zoomControl: true, preferCanvas: true });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
      .addTo(map)
      .on('load', () => skel?.remove());

    const fallback = last || [-23.5619, -46.6564];
    map.setView(fallback, last ? 16 : 13);
    if (last) marker = window.L.marker(last).addTo(map);

    const GEO_OPTS = { enableHighAccuracy: false, maximumAge: 180000, timeout: 7000 };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latlng = [pos.coords.latitude, pos.coords.longitude];
          if (!marker) marker = window.L.marker(latlng).addTo(map);
          else marker.setLatLng(latlng);

          map.setView(latlng, 17);
          localStorage.setItem('lastLatLng', JSON.stringify(latlng));

          const lblCoord = $('lblCoord');
          if (lblCoord) lblCoord.textContent = latlng[0].toFixed(5) + ', ' + latlng[1].toFixed(5);

          skel?.remove();
        },
        () => {},
        GEO_OPTS
      );
    }
  }

  // deixa disponível para quem chama
  window.initMap = initMap;

  function nextTypeFor(dateYMD) {
    if (typeof window.punchesByDate !== 'function') return 'Entrada';
    const list = window.punchesByDate(dateYMD) || [];
    if (list.length === 0) return 'Entrada';
    return list[list.length - 1].type === 'Entrada' ? 'Saída' : 'Entrada';
  }

  // Clique no botão incluir ponto (se existir nessa aba)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btnBaterPonto');
    if (!btn) return;

    e.preventDefault();

    if (
      typeof window.todayYMD !== 'function' ||
      typeof window.getAllPunches !== 'function' ||
      typeof window.setAllPunches !== 'function' ||
      typeof window.notify !== 'function'
    ) {
      console.warn('Dependências do ponto não carregadas (ponto.js/core.js).');
      return;
    }

    const ymd = window.todayYMD();
    const next = nextTypeFor(ymd);

    let list = [];
    try {
      list = typeof window.punchesByDate === 'function' ? window.punchesByDate(ymd) : [];
    } catch {}

    const eCount = list.filter((b) => b.type === 'Entrada').length;
    const sCount = list.filter((b) => b.type === 'Saída').length;

    if (next === 'Entrada' && eCount >= 3) return window.notify('Limite atingido: 3 entradas.', 'error');
    if (next === 'Saída' && sCount >= 3) return window.notify('Limite atingido: 3 saídas.', 'error');

    let lat = '--', lon = '--';
    if (map && map.getCenter) {
      const c = map.getCenter();
      lat = c.lat.toFixed(5);
      lon = c.lng.toFixed(5);
    }

    const all = window.getAllPunches() || [];
    all.push({
      date: ymd,
      time: safeNowTime().slice(0, 5),
      type: next,
      origin: 'Web',
      note: `GPS ${lat},${lon}`
    });
    window.setAllPunches(all);

    if (typeof window.renderPonto === 'function') {
      try { window.renderPonto(); } catch {}
    }
    if (typeof window.openBatimentosDia === 'function') {
      try { window.openBatimentosDia(ymd); } catch {}
    }
  });

  /* ===================== AJUSTE DA TABELA DE PONTO (RESPONSIVA) ===================== */

  function fitPontoTableToViewport() {
    try {
      const table = document.getElementById('tPonto');
      const wrap = table?.closest('.table-wrap');
      if (!table || !wrap) return;

      table.classList.remove('fit-mobile');
      table.style.transform = '';

      if (window.innerWidth > 430) return;

      const fullWidth = table.offsetWidth;
      const avail = wrap.clientWidth - 6;
      if (fullWidth > 0 && avail > 0) {
        const scale = Math.min(1, avail / fullWidth);
        if (scale < 1) {
          table.classList.add('fit-mobile');
          table.style.transform = `scale(${scale})`;
        }
      }
    } catch {}
  }

  window.addEventListener('resize', fitPontoTableToViewport);

  /* ===================== DOMContentLoaded (boot geral) ===================== */

  document.addEventListener('DOMContentLoaded', () => {
    // Preenche nome padrão no módulo de documentos (se existir)
    try {
      const docNome = $('docNome');
      if (docNome && !docNome.value && typeof window.getMe === 'function') {
        const me = window.getMe() || {};
        docNome.value = me.nome || '';
      }
    } catch {}

    // Ajuste inicial da tabela de ponto
    fitPontoTableToViewport();

    // Splash fade
    const sp = $('splash');
    setTimeout(() => sp && sp.classList.add('hide'), 1200);
    setTimeout(() => sp && sp.remove(), 1800);

    // Ancorar grade de funcionários inicialmente em "Funcionários"
    try {
      const empGrid = $('empGrid');
      const body = q('#tabFuncionarios .card-body');
      if (body && empGrid && !body.contains(empGrid)) body.appendChild(empGrid);
    } catch {}

    // Alertas de documentos importantes (módulo de funcionários)
    try {
      if (typeof window.checkImportantDocExpirations === 'function') window.checkImportantDocExpirations();
      if (typeof window.updateNotifDot === 'function') window.updateNotifDot();
    } catch {}

    // Assinatura pública via hash, se o módulo de docs expuser isso
    try {
      if (typeof window.parseSignHash === 'function' && typeof window.showPublicSign === 'function') {
        const data = window.parseSignHash();
        if (data) window.showPublicSign(data);
      }
    } catch {}
  });
})();
