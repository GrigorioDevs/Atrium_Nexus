// assets/js/beneficios-vr.js
(() => {
  'use strict';

  /* ===================== ELEMENTOS VR ===================== */

  const vrDaily = $('vrDaily');
  const vrDays = $('vrDays');
  const vrPct = $('vrPct');
  const vrCreditDay = $('vrCreditDay');
  const vrCapDiscount = $('vrCapDiscount');
  const vrBody = $('vrBody');
  const vrKAdesoes = $('vrKAdesoes');
  const vrKBeneficio = $('vrKBeneficio');
  const vrKDesconto = $('vrKDesconto');
  const vrKLiquido = $('vrKLiquido');
  const vrSumBeneficio = $('vrSumBeneficio');
  const vrSumDesconto = $('vrSumDesconto');
  const vrSumLiquido = $('vrSumLiquido');
  const btnExportVRCSV = $('btnExportVRCSV');
  const btnExportVRPDF = $('btnExportVRPDF');

  // se a aba de VR nem existir na página, não faz nada
  if (!vrBody) return;

  /* ===================== HELPERS LOCAIS ===================== */

  const brl = (n) =>
    (isFinite(n) ? n : 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  function clampDay(y, m, day) {
    const last = new Date(y, m + 1, 0).getDate();
    return Math.min(Math.max(1, day), last);
  }

  function nextDateForDay(day, ref = new Date()) {
    const d = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      clampDay(ref.getFullYear(), ref.getMonth(), day)
    );
    if (d <= ref) {
      const y = ref.getFullYear();
      const m = ref.getMonth() + 1;
      return new Date(y, m, clampDay(y, m, day));
    }
    return d;
  }

  /* ===================== CONFIG VR (LOCALSTORAGE) ===================== */

  function getVRSettings() {
    const def = { daily: 25.0, days: 22, pct: 6.0, creditDay: 5, cap: true };
    try {
      const s = JSON.parse(localStorage.getItem(KEY_VR_SETTINGS) || 'null');
      return Object.assign({}, def, s || {});
    } catch {
      return def;
    }
  }

  function setVRSettings(o) {
    localStorage.setItem(KEY_VR_SETTINGS, JSON.stringify(o || {}));
  }

  function getVRMap() {
    try {
      return JSON.parse(localStorage.getItem(KEY_VR_MAP) || '{}');
    } catch {
      return {};
    }
  }

  function setVRMap(map) {
    localStorage.setItem(KEY_VR_MAP, JSON.stringify(map || {}));
  }

  /* ===================== RENDER VR NA TABELA ===================== */

  function renderVR() {
    if (!vrBody) return;

    const s = getVRSettings();

    if (vrDaily) vrDaily.value = Number(s.daily || 0).toFixed(2);
    if (vrDays) vrDays.value = Number(s.days || 0);
    if (vrPct) vrPct.value = Number(s.pct || 0).toFixed(2);
    if (vrCreditDay) vrCreditDay.value = Number(s.creditDay || 1);
    if (vrCapDiscount) vrCapDiscount.checked = !!s.cap;

    const emps = getFuncionariosLS()
      .filter((f) => f.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const conf = getVRMap();

    let adesoes = 0;
    let totBenef = 0;
    let totDesc = 0;
    let totLiq = 0;

    if (emps.length === 0) {
      vrBody.innerHTML =
        '<tr><td colspan="10" style="color:#9fb1c3">Não há funcionários ativos.</td></tr>';
    } else {
      vrBody.innerHTML = emps
        .map((f) => {
          const c = conf[f.id] || {};
          const enabled = 'enabled' in c ? !!c.enabled : !!f.optVR;
          const salario = isFinite(c.sal)
            ? Number(c.sal)
            : Number(f.salario || 0);
          const daily = isFinite(c.daily) ? Number(c.daily) : s.daily;
          const days = Number.isFinite(c.days) ? Number(c.days) : s.days;
          const pct = Number.isFinite(c.pct) ? Number(c.pct) : s.pct;
          const creditD = Number.isFinite(c.day)
            ? Number(c.day)
            : s.creditDay;
          const next = nextDateForDay(creditD, new Date());

          const beneficio = enabled ? daily * days : 0;
          let desconto = enabled ? salario * (pct / 100) : 0;
          if (s.cap) desconto = Math.min(desconto, beneficio);
          const liquido = enabled ? beneficio - desconto : 0;

          if (enabled) {
            adesoes++;
            totBenef += beneficio;
            totDesc += desconto;
            totLiq += liquido;
          }

          const rowClass = enabled ? 'vr-on' : 'vr-off';
          return `<tr class="${rowClass}">
            <td><input type="checkbox" data-emp="${f.id}" data-field="enabled" ${enabled ? 'checked' : ''}></td>
            <td class="vr-cell-left">${f.nome}</td>
            <td><input type="number" min="0" step="0.01" data-emp="${f.id}" data-field="sal" value="${salario || 0}"></td>
            <td><input type="number" min="0" step="0.01" data-emp="${f.id}" data-field="daily" value="${Number(daily || 0).toFixed(2)}"></td>
            <td><input type="number" min="0" max="31" step="1" data-emp="${f.id}" data-field="days" value="${days}"></td>
            <td><input type="number" min="1" max="31" step="1" data-emp="${f.id}" data-field="day" value="${creditD}"></td>
            <td>${two(next.getDate())}/${two(
            next.getMonth() + 1
          )}/${next.getFullYear()}</td>
            <td class="vr-money">${brl(beneficio)}</td>
            <td class="vr-money">${brl(desconto)}</td>
            <td class="vr-money">${brl(liquido)}</td>
          </tr>`;
        })
        .join('');
    }

    if (vrKAdesoes) vrKAdesoes.textContent = String(adesoes);
    if (vrKBeneficio) vrKBeneficio.textContent = brl(totBenef);
    if (vrKDesconto) vrKDesconto.textContent = brl(totDesc);
    if (vrKLiquido) vrKLiquido.textContent = brl(totLiq);
    if (vrSumBeneficio) vrSumBeneficio.textContent = brl(totBenef);
    if (vrSumDesconto) vrSumDesconto.textContent = brl(totDesc);
    if (vrSumLiquido) vrSumLiquido.textContent = brl(totLiq);
  }

  // deixa global se você quiser chamar de outro lugar
  window.renderVR = renderVR;

  /* ===================== LISTENERS DE CONFIG ===================== */

  vrDaily?.addEventListener('input', (e) => {
    let v = parseFloat(String(e.target.value).replace(',', '.'));
    if (!isFinite(v) || v < 0) v = 0;
    const s = getVRSettings();
    s.daily = v;
    setVRSettings(s);
    renderVR();
  });

  vrDays?.addEventListener('input', (e) => {
    let d = parseInt(e.target.value, 10);
    if (!isFinite(d) || d < 0) d = 0;
    if (d > 31) d = 31;
    const s = getVRSettings();
    s.days = d;
    setVRSettings(s);
    renderVR();
  });

  vrPct?.addEventListener('input', (e) => {
    let p = parseFloat(String(e.target.value).replace(',', '.'));
    if (!isFinite(p) || p < 0) p = 0;
    if (p > 100) p = 100;
    const s = getVRSettings();
    s.pct = p;
    setVRSettings(s);
    renderVR();
  });

  vrCreditDay?.addEventListener('input', (e) => {
    let d = parseInt(e.target.value, 10);
    if (!isFinite(d) || d < 1) d = 1;
    if (d > 31) d = 31;
    const s = getVRSettings();
    s.creditDay = d;
    setVRSettings(s);
    renderVR();
  });

  vrCapDiscount?.addEventListener('change', (e) => {
    const s = getVRSettings();
    s.cap = !!e.target.checked;
    setVRSettings(s);
    renderVR();
  });

  vrBody?.addEventListener('input', (e) => {
    const el = e.target;
    const id = el.getAttribute('data-emp');
    const field = el.getAttribute('data-field');
    if (!id || !field) return;

    const map = getVRMap();
    map[id] = map[id] || {
      enabled: false,
      sal: 0,
      daily: null,
      days: null,
      pct: null,
      day: null
    };

    if (field === 'enabled') {
      map[id].enabled = !!el.checked;
    } else if (field === 'sal') {
      let v = parseFloat(String(el.value).replace(',', '.'));
      if (!isFinite(v) || v < 0) v = 0;
      map[id].sal = v;
    } else if (field === 'daily') {
      let v = parseFloat(String(el.value).replace(',', '.'));
      if (!isFinite(v) || v < 0) v = 0;
      map[id].daily = v;
    } else if (field === 'days') {
      let v = parseInt(el.value, 10);
      if (!isFinite(v) || v < 0) v = 0;
      if (v > 31) v = 31;
      map[id].days = v;
    } else if (field === 'pct') {
      let v = parseFloat(String(el.value).replace(',', '.'));
      if (!isFinite(v) || v < 0) v = 0;
      if (v > 100) v = 100;
      map[id].pct = v;
    } else if (field === 'day') {
      let v = parseInt(el.value, 10);
      if (!isFinite(v) || v < 1) v = 1;
      if (v > 31) v = 31;
      map[id].day = v;
    }

    setVRMap(map);
    renderVR();
  });

  /* ===================== SEED VR INICIAL ===================== */

  (function seedVR() {
    const map = getVRMap();
    if (Object.keys(map).length > 0) return;

    const emps = getFuncionariosLS().filter((f) => f.ativo);
    const s = getVRSettings();
    const m = {};

    emps.forEach((f) => {
      m[f.id] = {
        enabled: !!f.optVR,
        sal: Number(f.salario || 0),
        daily: s.daily,
        days: s.days,
        pct: s.pct,
        day: s.creditDay
      };
    });

    setVRMap(m);
  })();

  /* ===================== EXPORTAÇÕES ===================== */

  function collectVRRows() {
    const emps = getFuncionariosLS()
      .filter((f) => f.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const conf = getVRMap();
    const s = getVRSettings();

    const rows = [];
    let adesoes = 0;
    let totBenef = 0;
    let totDesc = 0;
    let totLiq = 0;

    for (const f of emps) {
      const c = conf[f.id] || {};
      const enabled = 'enabled' in c ? !!c.enabled : !!f.optVR;
      const salario = isFinite(c.sal)
        ? Number(c.sal)
        : Number(f.salario || 0);
      const daily = isFinite(c.daily) ? Number(c.daily) : s.daily;
      const days = Number.isFinite(c.days) ? Number(c.days) : s.days;
      const pct = Number.isFinite(c.pct) ? Number(c.pct) : s.pct;
      const creditD = Number.isFinite(c.day) ? Number(c.day) : s.creditDay;
      const next = nextDateForDay(creditD, new Date());

      const beneficio = enabled ? daily * days : 0;
      let desconto = enabled ? salario * (pct / 100) : 0;
      if (s.cap) desconto = Math.min(desconto, beneficio);
      const liquido = enabled ? beneficio - desconto : 0;

      if (enabled) {
        adesoes++;
        totBenef += beneficio;
        totDesc += desconto;
        totLiq += liquido;
      }

      rows.push({
        enabled,
        nome: f.nome,
        salario,
        daily,
        days,
        creditD,
        nextFmt: `${two(next.getDate())}/${two(
          next.getMonth() + 1
        )}/${next.getFullYear()}`,
        beneficio,
        desconto,
        liquido
      });
    }

    return { rows, adesoes, totBenef, totDesc, totLiq };
  }

  btnExportVRCSV?.addEventListener('click', () => {
    const { rows } = collectVRRows();

    const header = [
      'Optou',
      'Funcionário',
      'Salário (R$)',
      'Valor diário (R$)',
      'Dias úteis',
      'Dia crédito',
      'Próximo crédito',
      'Benefício',
      'Desconto',
      'Líquido'
    ];

    const out = [header.join(';')];

    rows.forEach((r) => {
      out.push(
        [
          r.enabled ? 'SIM' : 'NÃO',
          `"${r.nome.replace(/"/g, '""')}"`,
          r.salario.toFixed(2).replace('.', ','),
          r.daily.toFixed(2).replace('.', ','),
          r.days,
          r.creditD,
          r.nextFmt,
          r.beneficio.toFixed(2).replace('.', ','),
          r.desconto.toFixed(2).replace('.', ','),
          r.liquido.toFixed(2).replace('.', ',')
        ].join(';')
      );
    });

    const csv = out.join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'vale_refeicao.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();

    notify('CSV do VR exportado.', 'success');
  });

  btnExportVRPDF?.addEventListener('click', () => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return notify('jsPDF não carregado.', 'error');

    const { rows, totBenef, totDesc, totLiq } = collectVRRows();
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const mx = 28;
    let y = 36;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório — Vale Refeição', mx, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(new Date().toLocaleString('pt-BR'), mx, y);
    y += 10;

    const headers = [
      'Optou',
      'Funcionário',
      'Salário',
      'V.Diário',
      'Dias',
      'Dia',
      'Próx. Crédito',
      'Benefício',
      'Desconto',
      'Líquido'
    ];
    const widths = [44, 170, 64, 64, 36, 32, 110, 72, 72, 72];

    function drawHeader() {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      let x = mx;
      headers.forEach((h, i) => {
        doc.text(h, x + 4, y + 12);
        x += widths[i];
      });
      doc.setDrawColor(180);
      doc.rect(mx, y, widths.reduce((a, b) => a + b, 0), 18, 'S');
      y += 18;
      doc.setFont('helvetica', 'normal');
    }

    drawHeader();

    rows.forEach((r) => {
      if (y > 770) {
        doc.addPage();
        y = 36;
        drawHeader();
      }

      let x = mx;
      const cells = [
        r.enabled ? 'SIM' : 'NÃO',
        r.nome,
        'R$ ' + r.salario.toFixed(2).replace('.', ','),
        'R$ ' + r.daily.toFixed(2).replace('.', ','),
        String(r.days),
        String(r.creditD),
        r.nextFmt,
        'R$ ' + r.beneficio.toFixed(2).replace('.', ','),
        'R$ ' + r.desconto.toFixed(2).replace('.', ','),
        'R$ ' + r.liquido.toFixed(2).replace('.', ',')
      ];

      widths.forEach((w, i) => {
        doc.text(String(cells[i]), x + 4, y + 12);
        x += w;
      });

      doc.setDrawColor(230);
      doc.rect(mx, y, widths.reduce((a, b) => a + b, 0), 18, 'S');
      y += 18;
    });

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Totais:', mx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Benefício: R$ ${totBenef
        .toFixed(2)
        .replace('.', ',')}   •   Desconto: R$ ${totDesc
        .toFixed(2)
        .replace('.', ',')}   •   Líquido: R$ ${totLiq
        .toFixed(2)
        .replace('.', ',')}`,
      mx + 60,
      y
    );

    doc.save('vale_refeicao.pdf');
    notify('PDF do VR exportado.', 'success');
  });

  // render inicial
  renderVR();
})();
