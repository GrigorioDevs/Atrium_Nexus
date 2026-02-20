/* ===================== CARTÃO DE PONTO (ponto.js) ===================== */
(() => {
  'use strict';

  /* ========= Helpers / fallbacks (não quebrar se core.js mudar) ========= */

  const $ = (id) => document.getElementById(id);

  const safeNotify = (msg, type) => {
    try {
      if (typeof window.notify === 'function') return window.notify(msg, type);
    } catch {}
    // fallback simples
    if (type === 'error') console.error(msg);
    else console.log(msg);
    alert(msg);
  };

  // Status leve (não quebra se você não tiver função/elemento de status no layout)
  // - Se existir window.setStatus(msg, type), usamos ela.
  // - Senão tentamos escrever em um elemento comum (#pontoStatus ou #status).
  // - Se não existir nada, só loga no console.
  const setStatusSafe = (msg, type = 'info') => {
    try {
      if (typeof window.setStatus === 'function') return window.setStatus(msg, type);
    } catch {}

    const el =
      document.getElementById('pontoStatus') ||
      document.getElementById('status') ||
      document.getElementById('usrStatus');

    if (el) {
      el.textContent = String(msg || '');
      el.classList.remove('success', 'error', 'warn', 'info');
      el.classList.add(type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'info');
      return;
    }

    if (type === 'error') console.error(msg);
    else console.log(msg);
  };

  const escapeHTML = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const nowTimeSafe = () => {
    try {
      if (typeof window.nowTime === 'function') return window.nowTime();
    } catch {}
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const todayYMDSafe = () => {
    try {
      if (typeof window.todayYMD === 'function') return window.todayYMD();
    } catch {}
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toYMDSafe = (d) => {
    try {
      if (typeof window.toYMD === 'function') return window.toYMD(d);
    } catch {}
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const fromYMDSafe = (ymd) => {
    try {
      if (typeof window.fromYMD === 'function') return window.fromYMD(ymd);
    } catch {}
    const [y, m, d] = String(ymd).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const diffHHMMSafe = (mins) => {
    try {
      if (typeof window.diffHHMM === 'function') return window.diffHHMM(mins);
    } catch {}
    const sign = mins < 0 ? '-' : '';
    const abs = Math.abs(mins);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const brDateSafe = (d) => {
    try {
      if (typeof window.brDate === 'function') return window.brDate(d);
    } catch {}
    return d.toLocaleDateString('pt-BR');
  };

  const isValidHHMM = (s) => {
    if (!/^\d{2}:\d{2}$/.test(s || '')) return false;
    const [h, m] = s.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  };

  /* ========= Configuração da API + usuário logado ========= */

  // Base da API (mesma que você usa no login)
  const API_BASE = window.API_BASE || "http://localhost:5253";

  // Usuário logado (vem do localStorage.usuario ou getMe())
  function getUsuarioLogado() {
    try {
      if (typeof window.getMe === "function") {
        const me = window.getMe();
        if (me && me.id) return me;
      }
    } catch {}

    try {
      const raw = localStorage.getItem("usuario");
      if (!raw) return null;
      const me = JSON.parse(raw);
      if (me && me.id) return me;
    } catch {}

    return null;
  }

  /* ===================== Refs principais ===================== */

  const tPontoBody = document.querySelector('#tPonto tbody');
  const pInicio = $('pInicio');
  const pFim = $('pFim');
  const btnPeriodoAtual = $('btnPeriodoAtual');
  const btnAplicarFiltro = $('btnAplicarFiltro');
  const kHoras = $('kHoras');
  const kSaldo = $('kSaldo');
  const kPend = $('kPend');

  // Campo de busca incremental de funcionário (será criado/injetado se não existir no HTML)
  let pontoFuncSearch = $('pontoFuncSearch');
  let pontoFuncList = $('pontoFuncList');

  // Funcionário atualmente selecionado para o cartão de ponto
  let selectedEmployee = null;
  let pontoEmployeesCache = [];

  // Modal do dia
  const modalBat = $('modalBatimentosDia');
  const batimentosDiaTitulo = $('batimentosDiaTitulo');
  const batimentosDiaBody = $('batimentosDiaBody');
  const batimentosDatePicker = $('batimentosDatePicker');
  const fecharBatimentosDia = $('fecharBatimentosDia');
  const btnPrevDia = $('btnPrevDia');
  const btnNextDia = $('btnNextDia');
  const incluirPontoDia = $('incluirPontoDia');
  const justificarAusenciaDia = $('justificarAusenciaDia');

  const btnExportPonto = $('btnExportPonto');

  // se a tabela do cartão de ponto não existir, nem roda
  if (!tPontoBody) return;

  /* ===================== Justificativas (LocalStorage) ===================== */

  const JUST_KEY =
    (window.LS_KEYS && (window.LS_KEYS.PONTO_JUST || window.LS_KEYS.JUSTS)) ||
    'PONTO_JUSTS';

  function getJusts() {
    try {
      const a = JSON.parse(localStorage.getItem(JUST_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }

  function setJusts(a) {
    localStorage.setItem(JUST_KEY, JSON.stringify(a || []));
  }

  function makeJustKey(empId, ymd) {
    return `${empId || 'me'}|${ymd}`;
  }

  function getJustFor(empId, ymd) {
    const key = makeJustKey(empId, ymd);
    return getJusts().find((j) => j && j.key === key) || null;
  }

  function upsertJust(empId, ymd, reason) {
    const list = getJusts();
    const key = makeJustKey(empId, ymd);
    const idx = list.findIndex((j) => j && j.key === key);

    const payload = {
      key,
      empId: empId || 'me',
      date: ymd,
      reason: String(reason || ''),
      updatedAt: new Date().toISOString()
    };

    if (idx >= 0) list[idx] = { ...list[idx], ...payload };
    else list.push(payload);

    setJusts(list);
  }

  function removeJust(empId, ymd) {
    const key = makeJustKey(empId, ymd);
    setJusts(getJusts().filter((j) => j && j.key !== key));
  }

  /* ===================== Campo de funcionário (front) ===================== */

  // Garante que o input + datalist existam, mesmo que não estejam no HTML
  (function ensureEmployeeSearchField() {
    if (!pontoFuncList) {
      pontoFuncList = document.createElement('datalist');
      pontoFuncList.id = 'pontoFuncList';
      document.body.appendChild(pontoFuncList);
    }

    if (!pontoFuncSearch) {
      pontoFuncSearch = document.createElement('input');
      pontoFuncSearch.type = 'text';
      pontoFuncSearch.id = 'pontoFuncSearch';
      pontoFuncSearch.setAttribute('list', 'pontoFuncList');
      pontoFuncSearch.placeholder = 'Buscar funcionário…';

      const chip = document.createElement('div');
      chip.className = 'chip';
      const label = document.createElement('label');
      label.textContent = 'Funcionário';
      chip.appendChild(label);
      chip.appendChild(pontoFuncSearch);

      const filters = document.querySelector('#tabPonto .filters');
      if (filters) {
        filters.insertBefore(chip, filters.firstChild || null);
      }
    }
  })();

  function readEmployeesFromLS() {
    try {
      const key = window.LS_KEYS?.FUNCS;
      if (!key) return null;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) return null;
      return arr
        .filter((f) => f && f.nome)
        .map((f) => ({
          id: f.id || f.cpf || f.matricula || f.nome,
          nome: f.nome,
          funcao: f.funcao || f.cargo || ''
        }));
    } catch {
      return null;
    }
  }

  // Fonte de funcionários para o cartão de ponto
  // → Agora prioriza o usuário logado (id que existe no banco)
  function getPontoEmployees() {
    const me = getUsuarioLogado();
    if (me && me.nome && me.id) {
      return [
        {
          id: me.id,
          nome: me.nome,
          funcao: me.funcao || me.cargo || ''
        }
      ];
    }

    // Fallback: se houver função global específica, usa ela
    if (typeof window.getPontoEmployees === 'function') {
      try {
        const r = window.getPontoEmployees();
        if (Array.isArray(r)) return r;
      } catch (e) {
        console.error('Erro em getPontoEmployees():', e);
      }
    }

    // Fallback: se existir lista no localStorage (módulo Funcionários)
    const fromLS = readEmployeesFromLS();
    if (fromLS && fromLS.length) return fromLS;

    // Fallback final: usa apenas o colaborador logado (se tiver dado parcial)
    try {
      if (typeof window.getMe === 'function') {
        const me2 = window.getMe();
        if (me2 && me2.nome) {
          return [
            {
              id: me2.id || me2.matricula || me2.cpf || 'me',
              nome: me2.nome,
              funcao: me2.funcao || me2.cargo || ''
            }
          ];
        }
      }
    } catch (e) {
      console.error('Erro em getMe():', e);
    }

    return [];
  }

  function refreshEmployeeDatalist(term = '') {
    if (!pontoFuncList) return;
    const all = getPontoEmployees();
    pontoEmployeesCache = all;

    const t = term.trim().toLowerCase();
    const filtered = t
      ? all.filter((emp) => (emp.nome || '').toLowerCase().includes(t))
      : all;

    pontoFuncList.innerHTML = filtered
      .map((emp) => `<option value="${escapeHTML(emp.nome || '')}"></option>`)
      .join('');
  }

  function syncSelectedEmployeeFromInputValue() {
    const nome = (pontoFuncSearch?.value || '').trim().toLowerCase();
    const list = getPontoEmployees();
    const found = list.find((emp) => (emp.nome || '').toLowerCase() === nome);

    if (!found) {
      selectedEmployee = null;
      safeNotify('Funcionário não encontrado para o cartão de ponto.', 'warn');
    } else {
      selectedEmployee = found;
    }
  }

  // Inicializa funcionário selecionado
  (function initSelectedEmployee() {
    const list = getPontoEmployees();
    if (list.length) {
      selectedEmployee = list[0];
      if (pontoFuncSearch && !pontoFuncSearch.value) {
        pontoFuncSearch.value = selectedEmployee.nome || '';
      }
    }
    refreshEmployeeDatalist(pontoFuncSearch?.value || '');
  })();

  if (pontoFuncSearch) {
    // Incremental: conforme digita, filtra opções
    pontoFuncSearch.addEventListener('input', (ev) => {
      refreshEmployeeDatalist(ev.target.value || '');
    });

    // Ao confirmar o texto, define o funcionário atual do cartão
    pontoFuncSearch.addEventListener('change', () => {
      syncSelectedEmployeeFromInputValue();
      renderPonto().catch(console.error);
    });
  }

  /* ===================== Período padrão e filtros ===================== */

  function setDefaultPeriod() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14);
    if (pInicio) pInicio.value = toYMDSafe(start);
    if (pFim) pFim.value = toYMDSafe(end);
  }

  btnPeriodoAtual?.addEventListener('click', (e) => {
    e.preventDefault?.();
    setDefaultPeriod();
    renderPonto().catch(console.error);
  });

  btnAplicarFiltro?.addEventListener('click', (e) => {
    e.preventDefault?.();
    renderPonto().catch(console.error);
  });

  setDefaultPeriod();

  /* ===================== Fonte de dados (BACK-END) ===================== */

  // Cache do cartão de ponto vindo da API
  let cartaoCache = [];
  let cartaoRange = { usuarioId: null, inicio: null, fim: null };

  // Busca no back-end a vw_cartao_ponto para o funcionário selecionado
  async function loadCartaoFromBackend(inicioYMD, fimYMD) {
    const empId = selectedEmployee?.id ?? getUsuarioLogado()?.id;
    if (!empId) {
      safeNotify('Usuário não logado/selecionado. Não foi possível carregar o cartão de ponto.', 'error');
      cartaoCache = [];
      return;
    }

    const sameRange =
      cartaoRange.usuarioId === empId &&
      cartaoRange.inicio === inicioYMD &&
      cartaoRange.fim === fimYMD;

    if (sameRange && cartaoCache.length) return;

    // garante API_BASE sem "/" no final
    const base = String(API_BASE || '').replace(/\/+$/, '');

    const qs =
      `?usuarioId=${encodeURIComponent(empId)}` +
      `&inicio=${encodeURIComponent(inicioYMD)}` +
      `&fim=${encodeURIComponent(fimYMD)}`;

    // ✅ tente aqui as rotas que podem existir no seu back-end
    const candidates = [
      `${base}/api/ponto/cartao${qs}`,
      `${base}/api/Ponto/cartao${qs}`,
      `${base}/api/ponto/Cartao${qs}`,
      `${base}/api/Ponto/Cartao${qs}`,

      // exemplos comuns (se você tiver usado outro nome)
      `${base}/api/cartao-ponto${qs}`,
      `${base}/api/CartaoPonto${qs}`,
      `${base}/api/ponto/cartao-ponto${qs}`,
    ];

    setStatusSafe('Carregando cartão de ponto…', 'info');

    let lastErrMsg = null;

    for (const url of candidates) {
      try {
      const resp = await fetch(url, {
        method: 'GET',
        credentials: 'include',   // <<<<<< ESSENCIAL pra cookie em cross-origin
        headers: { 'Accept': 'application/json' }
      });

        if (resp.status === 404) {
          // rota não existe — tenta a próxima
          continue;
        }

        if (!resp.ok) {
          const errJson = await resp.json().catch(() => null);
          lastErrMsg =
            errJson?.message ||
            errJson?.error ||
            `Erro HTTP ${resp.status} ao carregar cartão.`;
          break;
        }

        const data = await resp.json().catch(() => null);
        cartaoCache = Array.isArray(data) ? data : [];
        cartaoRange = { usuarioId: empId, inicio: inicioYMD, fim: fimYMD };

        console.log('[PONTO] rota OK:', url);
        setStatusSafe('Cartão carregado.', 'success');
        return;
      } catch (e) {
        console.error('[PONTO] erro fetch:', url, e);
        lastErrMsg = 'Falha de conexão ao buscar cartão de ponto.';
        // em erro de rede, não adianta testar várias rotas
        break;
      }
    }

    cartaoCache = [];

    if (lastErrMsg) {
      safeNotify(lastErrMsg, 'error');
      setStatusSafe(lastErrMsg, 'error');
    } else {
      const m =
        'Endpoint do cartão não encontrado (404). Verifique no Swagger qual é a rota correta e ajuste no ponto.js.';
      safeNotify(m, 'error');
      setStatusSafe(m, 'error');
    }
  }

  // Procura a linha da view correspondente a um dia (YYYY-MM-DD)
  function getCartaoRowByDate(ymd) {
    const row = cartaoCache.find((r) => {
      const raw = r.dataLocal || r.data_local;
      if (!raw) return false;
      const dia = String(raw).slice(0, 10); // "2025-12-04"
      return dia === ymd;
    });
    return row || null;
  }

  // Converte uma linha da view em uma lista de batidas no formato antigo
  function punchesFromCartaoRow(row) {
    if (!row) return [];

    const arr = [];

    const add = (prop, type) => {
      const camel = prop;
      const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
      const snake = prop.toLowerCase();

      const v = row[camel] ?? row[pascal] ?? row[snake];
      if (!v) return;

      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return;

      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      arr.push({
        type,
        time: `${hh}:${mm}`,
        origin: 'Servidor',
        note: ''
      });
    };

    add('entrada1', 'Entrada');
    add('saida1',   'Saída');
    add('entrada2', 'Entrada');
    add('saida2',   'Saída');
    add('entrada3', 'Entrada');
    add('saida3',   'Saída');

    // garante ordenado por horário
    arr.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return arr;
  }

  // Pega as batidas de um dia (agora 100% em cima da view do banco)
  function punchesByDate(ymd) {
    const row = getCartaoRowByDate(ymd);
    return punchesFromCartaoRow(row);
  }

  /* ===================== Helpers de cálculo ===================== */

  function calcSaldoMinsForDay(list) {
    let mins = 0;
    let lastIn = null;
    for (const b of list) {
      if (b.type === 'Entrada') lastIn = b.time;
      else if (b.type === 'Saída' && lastIn) {
        const [h1, m1] = String(lastIn).split(':').map(Number);
        const [h2, m2] = String(b.time).split(':').map(Number);
        mins += h2 * 60 + m2 - (h1 * 60 + m1);
        lastIn = null;
      }
    }
    return mins;
  }

  function statusForDay(list, ymd) {
    const empId = selectedEmployee?.id || getUsuarioLogado()?.id || 'me';
    const just = getJustFor(empId, ymd);

    if (list.length === 0 && just) return { cls: 'ok', tip: 'Justificado' };
    if (list.length === 0) return { cls: 'warn', tip: 'Sem marcações' };

    const first = list[0].type;
    const last = list[list.length - 1].type;
    if (first === 'Saída' || last === 'Entrada') return { cls: 'err', tip: 'Pendências' };
    return { cls: 'ok', tip: 'OK' };
  }

  function dayRow(list, ymd) {
    const entries = list.filter((b) => b.type === 'Entrada').map((b) => b.time);
    const exits = list.filter((b) => b.type === 'Saída').map((b) => b.time);
    const saldo = diffHHMMSafe(calcSaldoMinsForDay(list));
    const stat = statusForDay(list, ymd);

    const d = fromYMDSafe(ymd);
    const br = d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit'
    });

    return `<tr class="row-dia" data-date="${ymd}" title="Clique para detalhar">
      <td><span class="status-dot ${stat.cls}" title="${escapeHTML(stat.tip)}"></span></td>
      <td>${escapeHTML(br)}</td>
      <td>${escapeHTML(entries[0] || '')}</td><td>${escapeHTML(exits[0] || '')}</td>
      <td>${escapeHTML(entries[1] || '')}</td><td>${escapeHTML(exits[1] || '')}</td>
      <td>${escapeHTML(entries[2] || '')}</td><td>${escapeHTML(exits[2] || '')}</td>
      <td>${escapeHTML(saldo)}</td>
    </tr>`;
  }

  /* ===================== Renderização do cartão ===================== */

  async function renderPonto() {
    if (!tPontoBody) return;

    const ini = fromYMDSafe(pInicio?.value || todayYMDSafe());
    const fim = fromYMDSafe(pFim?.value || todayYMDSafe());

    if (fim < ini) {
      safeNotify('Período inválido.', 'warn');
      return;
    }

    const inicioYMD = toYMDSafe(ini);
    const fimYMD = toYMDSafe(fim);

    // 1) carrega do servidor
    await loadCartaoFromBackend(inicioYMD, fimYMD);

    // 2) usa o cache (cartaoCache) para montar a tabela
    let html = '';
    let totalMins = 0;
    let pend = 0;

    for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
      const ymd = toYMDSafe(d);
      const list = punchesByDate(ymd);

      html += dayRow(list, ymd);

      const st = statusForDay(list, ymd);
      if (st.cls !== 'ok') pend++;

      totalMins += calcSaldoMinsForDay(list);
    }

    tPontoBody.innerHTML =
      html ||
      `<tr><td colspan="9" style="color:#9fb1c3">Sem registros no período.</td></tr>`;

    if (kHoras) kHoras.textContent = diffHHMMSafe(totalMins);
    if (kSaldo) kSaldo.textContent = diffHHMMSafe(totalMins);
    if (kPend) kPend.textContent = String(pend);
  }

  // render inicial
  renderPonto().catch(console.error);

  /* ===================== Modal de batimentos do dia ===================== */

  document.addEventListener('click', (ev) => {
    const row = ev.target.closest('.row-dia[data-date]');
    if (!row) return;
    openBatimentosDia(row.getAttribute('data-date'));
  });

  function openBatimentosDia(ymd) {
    if (!modalBat) return;

    const d = fromYMDSafe(ymd);
    if (batimentosDiaTitulo) batimentosDiaTitulo.textContent = 'Batimentos de ' + brDateSafe(d);
    if (batimentosDatePicker) batimentosDatePicker.value = ymd;

    const rows = punchesByDate(ymd).map((b, i) => ({ idx: i + 1, ...b }));

    if (batimentosDiaBody) {
      batimentosDiaBody.innerHTML = rows.length
        ? rows
            .map(
              (r) =>
                `<tr>
                  <td>${r.idx}</td>
                  <td>${escapeHTML(r.type)}</td>
                  <td>${escapeHTML(r.time)}</td>
                  <td>${escapeHTML(r.origin || '-')}</td>
                  <td>${escapeHTML(r.note || '-')}</td>
                </tr>`
            )
            .join('')
        : `<tr><td colspan="5" style="color:#9fb1c3">Nenhum batimento para este dia.</td></tr>`;

      const empId = selectedEmployee?.id || getUsuarioLogado()?.id || 'me';
      const just = getJustFor(empId, ymd);
      if (just && (just.reason || '').trim()) {
        batimentosDiaBody.innerHTML += `
          <tr>
            <td colspan="5" style="text-align:left;color:#9fb1c3">
              <b>Justificativa:</b> ${escapeHTML(just.reason)}
            </td>
          </tr>`;
      }
    }

    modalBat.style.display = 'flex';
  }

  function closeBatimentosDia() {
    if (modalBat) modalBat.style.display = 'none';
  }

  fecharBatimentosDia?.addEventListener('click', (e) => {
    e.preventDefault?.();
    closeBatimentosDia();
  });

  btnPrevDia?.addEventListener('click', (e) => {
    e.preventDefault?.();
    const d = fromYMDSafe(batimentosDatePicker?.value || todayYMDSafe());
    d.setDate(d.getDate() - 1);
    openBatimentosDia(toYMDSafe(d));
  });

  btnNextDia?.addEventListener('click', (e) => {
    e.preventDefault?.();
    const d = fromYMDSafe(batimentosDatePicker?.value || todayYMDSafe());
    d.setDate(d.getDate() + 1);
    openBatimentosDia(toYMDSafe(d));
  });

  batimentosDatePicker?.addEventListener('change', (e) => {
    e.preventDefault?.();
    if (e.target.value) openBatimentosDia(e.target.value);
  });

  // Justificar ausência (continua localStorage, só pro visual/relatório)
  justificarAusenciaDia?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const me = getUsuarioLogado();
    const empId = selectedEmployee?.id ?? me?.id ?? 'me';

    const ymd = batimentosDatePicker?.value || todayYMDSafe();

    const current = getJustFor(empId, ymd)?.reason || '';
    const reason = prompt(`Justificativa para ${ymd}:`, current);
    if (reason === null) return; // cancelou

    const trimmed = reason.trim();
    if (!trimmed) {
      removeJust(empId, ymd);
      renderPonto().catch(console.error);
      openBatimentosDia(ymd);
      return safeNotify('Justificativa removida.', 'info');
    }

    upsertJust(empId, ymd, trimmed);
    renderPonto().catch(console.error);
    openBatimentosDia(ymd);
    safeNotify('Ausência justificada.', 'success');
  });

  // ===== Atalhos de AJUSTE no tabIncluir =====
  const ajusteDiaPicker = $('ajusteDiaPicker');
  const btnAbrirBatimentosDia = $('btnAbrirBatimentosDia');
  const btnAjusteManualDia = $('btnAjusteManualDia');
  const btnJustificarDia = $('btnJustificarDia');

  // pré-preenche com hoje
  if (ajusteDiaPicker && !ajusteDiaPicker.value) ajusteDiaPicker.value = todayYMDSafe();

  btnAbrirBatimentosDia?.addEventListener('click', () => {
    const ymd = ajusteDiaPicker?.value || todayYMDSafe();
    openBatimentosDia(ymd);
  });

  btnAjusteManualDia?.addEventListener('click', () => {
    const ymd = ajusteDiaPicker?.value || todayYMDSafe();
    openBatimentosDia(ymd);
  });

  btnJustificarDia?.addEventListener('click', () => {
    const ymd = ajusteDiaPicker?.value || todayYMDSafe();
    openBatimentosDia(ymd);
    setTimeout(() => justificarAusenciaDia?.click(), 50);
  });

  /* ===================== Exportar Cartão em PDF ===================== */

  async function imgElToDataURL_FIX(src) {
    return new Promise((resolve) => {
      const img = new Image();
      try {
        const u = new URL(src, location.href);
        if (u.origin !== location.origin) img.crossOrigin = 'anonymous';
      } catch {}
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function getCompanyLogoDataURL() {
    const el = document.querySelector('.brand-logo');
    if (el && el.complete && el.naturalWidth) {
      try {
        const c = document.createElement('canvas');
        c.width = el.naturalWidth;
        c.height = el.naturalHeight;
        c.getContext('2d').drawImage(el, 0, 0);
        return c.toDataURL('image/png');
      } catch {}
    }
    if (el && el.src) {
      const d = await imgElToDataURL_FIX(el.src);
      if (d) return d;
    }
    const splash = document.querySelector('.splash-logo');
    if (splash && splash.src) {
      const d = await imgElToDataURL_FIX(splash.src);
      if (d) return d;
    }
    return await imgElToDataURL_FIX('Assets/img/logo_new.png');
  }

  btnExportPonto?.addEventListener('click', async (e) => {
    e.preventDefault?.();

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return safeNotify('jsPDF não carregado.', 'error');

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mx = 28;
    let y = 22;

    doc.setFillColor(245, 246, 250);
    doc.rect(0, 0, pageW, 70, 'F');

    const logo = await getCompanyLogoDataURL();
    if (logo) {
      const fmtMatch = /^data:image\/(png|jpeg|jpg|webp)/i.exec(logo);
      doc.addImage(logo, (fmtMatch ? fmtMatch[1] : 'png').toUpperCase(), mx, 16, 120, 40);
    } else {
      doc.setDrawColor(160);
      doc.rect(mx, 16, 120, 40);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('CARTÃO PONTO', pageW - mx, 32, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Período: ${pInicio?.value} até ${pFim?.value}`, pageW - mx, 50, { align: 'right' });

    const me = selectedEmployee || getUsuarioLogado() || (typeof window.getMe === 'function' ? window.getMe() : {}) || {};
    const empresaNome =
      document.querySelector('.brand strong')?.textContent?.trim() || 'RCR ENGENHARIA';

    function kvRow(x, lab, val, x2, lab2, val2) {
      const lh = 14;
      doc.setFont('helvetica', 'bold');
      doc.text(lab, x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(val || ''), x + 82, y);
      if (lab2) {
        doc.setFont('helvetica', 'bold');
        doc.text(lab2, x2, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(val2 || ''), x2 + 82, y);
      }
      y += lh;
    }

    y = 88;
    kvRow(mx, 'EMPRESA:', empresaNome);
    kvRow(mx, 'NOME:', me.nome || me.nomeCompleto || 'Colaborador(a)');
    kvRow(mx, 'FUNÇÃO:', me.funcao || me.cargo || '—');
    kvRow(mx, 'OBSERVAÇÃO:', '');
    y += 6;

    const tableX = mx;
    const tableW = pageW - 2 * mx;
    const rowH = 18;
    const cols = [
      { w: 74, title: 'DATA' },
      { w: 52, title: 'E1' },
      { w: 52, title: 'S1' },
      { w: 52, title: 'E2' },
      { w: 52, title: 'S2' },
      { w: 52, title: 'E3' },
      { w: 52, title: 'S3' },
      { w: 51, title: 'SALDO' },
      { w: 51, title: 'FALTAS' },
      { w: 51, title: 'NOT.TOT.' }
    ];

    doc.setFillColor(230, 232, 236);
    doc.rect(tableX, y, tableW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    let cx = tableX + 6;
    cols.forEach((c) => {
      doc.text(c.title, cx, y + 12);
      cx += c.w;
    });
    doc.setDrawColor(180);
    doc.rect(tableX, y, tableW, rowH);
    y += rowH;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let totalMins = 0;
    const ini = fromYMDSafe(pInicio?.value || todayYMDSafe());
    const fim = fromYMDSafe(pFim?.value || todayYMDSafe());
    const empId = selectedEmployee?.id || getUsuarioLogado()?.id || 'me';

    for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
      const ymd = toYMDSafe(d);
      const list = punchesByDate(ymd);

      const entries = list.filter((b) => b.type === 'Entrada').map((b) => b.time);
      const exits = list.filter((b) => b.type === 'Saída').map((b) => b.time);

      const just = getJustFor(empId, ymd);
      const isJust = !list.length && !!just;

      const vals = {
        e1: entries[0] || '',
        s1: exits[0] || '',
        e2: entries[1] || '',
        s2: exits[1] || '',
        e3: entries[2] || '',
        s3: exits[2] || '',
        saldo: ''
      };

      if (list.length) {
        const mins = calcSaldoMinsForDay(list);
        totalMins += mins;
        vals.saldo = mins === 0 ? '00:00' : diffHHMMSafe(mins);
      } else if (isJust) {
        vals.e1 = vals.s1 = vals.e2 = vals.s2 = vals.e3 = vals.s3 = 'JUST';
        vals.saldo = '';
      } else {
        vals.e1 = vals.s1 = vals.e2 = vals.s2 = vals.e3 = vals.s3 = 'FOLGA';
        vals.saldo = '';
      }

      const dtLabel =
        d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
        ' - ' +
        d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

      if (y > pageH - 80) {
        doc.addPage();
        y = 40;

        doc.setFillColor(230, 232, 236);
        doc.rect(tableX, y, tableW, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);

        let cxh = tableX + 6;
        cols.forEach((c) => {
          doc.text(c.title, cxh, y + 12);
          cxh += c.w;
        });
        doc.setDrawColor(180);
        doc.rect(tableX, y, tableW, rowH);
        y += rowH;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }

      doc.setDrawColor(210);
      doc.rect(tableX, y, tableW, rowH);

      let tx = tableX + 6;
      doc.text(dtLabel, tx, y + 12);
      tx += cols[0].w;

      const values = [vals.e1, vals.s1, vals.e2, vals.s2, vals.e3, vals.s3, vals.saldo, '', ''];
      for (let i = 1; i < cols.length; i++) {
        const w = cols[i].w;
        doc.text(String(values[i - 1] || ''), tx + w / 2, y + 12, { align: 'center' });
        tx += w;
      }

      y += rowH;
    }

    if (y > pageH - 70) {
      doc.addPage();
      y = 40;
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.line(mx, y + 6, pageW - mx, y + 6);
    y += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TOTAIS', mx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Horas no período: ${diffHHMMSafe(totalMins)}`, mx + 70, y);

    const me2 = selectedEmployee || getUsuarioLogado() || (typeof window.getMe === 'function' ? window.getMe() : {}) || {};
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(me2.nome || me2.nomeCompleto || 'Colaborador(a)', mx, pageH - 24);
    doc.text(empresaNome, pageW - mx, pageH - 24, { align: 'right' });

    doc.save('folha_de_ponto.pdf');
  });
})();
