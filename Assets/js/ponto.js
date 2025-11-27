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

  // Deve existir no core.js, mas garantimos fallback mínimo
  const getAllPunchesSafe = () => {
    try {
      if (typeof window.getAllPunches === 'function') return window.getAllPunches() || [];
    } catch {}
    try {
      const a = JSON.parse(localStorage.getItem('PUNCHES') || '[]');
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  };

  const setAllPunchesSafe = (arr) => {
    try {
      if (typeof window.setAllPunches === 'function') return window.setAllPunches(arr || []);
    } catch {}
    localStorage.setItem('PUNCHES', JSON.stringify(arr || []));
  };

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

  /* ===================== Campo de funcionário (front-only) ===================== */

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

  // Fonte de funcionários para o cartão de ponto (somente front)
  function getPontoEmployees() {
    // 1) Se houver uma função global específica, usa ela
    if (typeof window.getPontoEmployees === 'function') {
      try {
        const r = window.getPontoEmployees();
        if (Array.isArray(r)) return r;
      } catch (e) {
        console.error('Erro em getPontoEmployees():', e);
      }
    }

    // 2) Se existir lista no localStorage (módulo Funcionários)
    const fromLS = readEmployeesFromLS();
    if (fromLS && fromLS.length) return fromLS;

    // 3) Fallback: usa apenas o colaborador logado
    if (typeof window.getMe === 'function') {
      try {
        const me = window.getMe();
        if (me && me.nome) {
          return [
            {
              id: me.id || me.matricula || me.cpf || 'me',
              nome: me.nome,
              funcao: me.funcao || me.cargo || ''
            }
          ];
        }
      } catch (e) {
        console.error('Erro em getMe():', e);
      }
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
      renderPonto();
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
    renderPonto();
  });

  btnAplicarFiltro?.addEventListener('click', (e) => {
    e.preventDefault?.();
    renderPonto();
  });

  setDefaultPeriod();

  /* ===================== Punch source (por funcionário) ===================== */

  function getPunchesSource() {
    const empId = selectedEmployee?.id || 'me';

    // 1) Extensão futura: buscar por ID via função global
    if (selectedEmployee && typeof window.getPunchesByEmployeeId === 'function') {
      try {
        const r = window.getPunchesByEmployeeId(selectedEmployee.id);
        if (Array.isArray(r)) return r;
      } catch (e) {
        console.error('Erro em getPunchesByEmployeeId():', e);
      }
    }

    // 2) Fallback: filtra getAllPunches() pelo empId (se existir)
    const all = getAllPunchesSafe();

    // Se o batimento não tem empId, consideramos que é do "me"
    if (empId === 'me') {
      return all.filter((b) => !b.empId || b.empId === 'me');
    }

    return all.filter((b) => b.empId === empId);
  }

  function punchesByDate(ymd) {
    return getPunchesSource()
      .filter((b) => b.date === ymd)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
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
    const empId = selectedEmployee?.id || 'me';
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

  function renderPonto() {
    if (!tPontoBody) return;

    const ini = fromYMDSafe(pInicio?.value || todayYMDSafe());
    const fim = fromYMDSafe(pFim?.value || todayYMDSafe());

    if (fim < ini) {
      safeNotify('Período inválido.', 'warn');
      return;
    }

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

  renderPonto();

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

      const empId = selectedEmployee?.id || 'me';
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

  // ✅ CORRIGIDO: agora inclui batimento de verdade (manual), sem depender de navegar pra outra aba
  incluirPontoDia?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedEmployee?.id) {
      safeNotify('Selecione um funcionário primeiro.', 'warn');
      return;
    }

    const ymd = batimentosDatePicker?.value || todayYMDSafe();
    const empId = selectedEmployee.id;

    const list = punchesByDate(ymd);
    const lastType = list.length ? list[list.length - 1].type : null;
    const sugerido = lastType === 'Entrada' ? 'Saída' : 'Entrada';

    const time = prompt(`Hora (HH:MM) para ${ymd}:`, nowTimeSafe().slice(0, 5));
    if (!time) return;
    if (!isValidHHMM(time)) return safeNotify('Hora inválida. Use HH:MM.', 'warn');

    const keepSuggested = confirm(`Tipo sugerido: ${sugerido}\nOK = usar sugerido | Cancelar = trocar`);
    const type = keepSuggested ? sugerido : sugerido === 'Entrada' ? 'Saída' : 'Entrada';
    const note = prompt('Observação (opcional):', '') || '';

    const all = getAllPunchesSafe();
    all.push({ empId, date: ymd, time, type, origin: 'Manual', note });
    setAllPunchesSafe(all);

    // se havia justificativa, pode manter (ou remover se preferir)
    // removeJust(empId, ymd);

    renderPonto();
    openBatimentosDia(ymd);
    safeNotify('Batimento incluído.', 'success');
  });

  // ✅ CORRIGIDO: agora salva justificativa de verdade
  justificarAusenciaDia?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedEmployee?.id) {
      safeNotify('Selecione um funcionário primeiro.', 'warn');
      return;
    }

    const ymd = batimentosDatePicker?.value || todayYMDSafe();
    const empId = selectedEmployee.id;

    const current = getJustFor(empId, ymd)?.reason || '';
    const reason = prompt(`Justificativa para ${ymd}:`, current);
    if (reason === null) return; // cancelou

    const trimmed = reason.trim();
    if (!trimmed) {
      removeJust(empId, ymd);
      renderPonto();
      openBatimentosDia(ymd);
      return safeNotify('Justificativa removida.', 'info');
    }

    upsertJust(empId, ymd, trimmed);
    renderPonto();
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
    // abre o modal e deixa você clicar em "Incluir ponto" lá dentro (ou usa o botão do modal)
    // se quiser disparar direto, descomente:
    // setTimeout(() => incluirPontoDia?.click(), 50);
  });

  btnJustificarDia?.addEventListener('click', () => {
    const ymd = ajusteDiaPicker?.value || todayYMDSafe();
    openBatimentosDia(ymd);
    // dispara o fluxo do botão do modal
    setTimeout(() => justificarAusenciaDia?.click(), 50);
  });

  /* ===================== Exportar Cartão em PDF (mantido) ===================== */

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

    const me = selectedEmployee || (typeof window.getMe === 'function' ? window.getMe() : {}) || {};
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
    const empId = selectedEmployee?.id || 'me';

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

    const me2 = selectedEmployee || (typeof window.getMe === 'function' ? window.getMe() : {}) || {};
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(me2.nome || me2.nomeCompleto || 'Colaborador(a)', mx, pageH - 24);
    doc.text(empresaNome, pageW - mx, pageH - 24, { align: 'right' });

    doc.save('folha_de_ponto.pdf');
  });
})();
