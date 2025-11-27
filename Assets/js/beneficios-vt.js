// assets/js/beneficios-vt.js
(() => {
  'use strict';

  /* ===================== ELEMENTOS VT ===================== */

  const vtUnit = $('vtUnit');
  const vtCreditDay = $('vtCreditDay');
  const vtBody = $('vtBody');
  const vtKColab = $('vtKColab');
  const vtKQtd = $('vtKQtd');
  const vtKValor = $('vtKValor');
  const vtSumQtd = $('vtSumQtd');
  const vtSumValor = $('vtSumValor');
  const btnExportVTCSV = $('btnExportVTCSV');
  const btnExportVTPDF = $('btnExportVTPDF');

  // Se essa página nem tiver seção de VT, não faz nada
  if (!vtBody) return;

  /* ===================== FUNÇÕES DE CONFIG VT ===================== */

  function getVTSettings() {
    const def = { unit: 5.0, creditDay: 5 };
    try {
      const s = JSON.parse(localStorage.getItem(KEY_VT_SETTINGS) || 'null');
      return Object.assign({}, def, s || {});
    } catch {
      return def;
    }
  }

  function setVTSettings(o) {
    localStorage.setItem(KEY_VT_SETTINGS, JSON.stringify(o || {}));
  }

  function getVTMap() {
    try {
      return JSON.parse(localStorage.getItem(KEY_VT_MAP) || '{}');
    } catch {
      return {};
    }
  }

  function setVTMap(map) {
    localStorage.setItem(KEY_VT_MAP, JSON.stringify(map || {}));
  }

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

  /* ===================== RENDER VT ===================== */

  function renderVT() {
    if (!vtBody) return;

    const s = getVTSettings();
    if (vtUnit) vtUnit.value = Number(s.unit || 0).toFixed(2);
    if (vtCreditDay) vtCreditDay.value = s.creditDay || 1;

    const emps = getFuncionariosLS()
      .filter((f) => f.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const conf = getVTMap();

    let totalEnabled = 0;
    let totalQtd = 0;
    let totalValor = 0;

    if (emps.length === 0) {
      vtBody.innerHTML =
        '<tr><td colspan="7" style="color:#9fb1c3">Não há funcionários ativos.</td></tr>';
    } else {
      vtBody.innerHTML = emps
        .map((f) => {
          const c = conf[f.id] || {};
          const enabled = typeof c.enabled === 'boolean' ? c.enabled : !!f.optVT;
          const qty = Number.isFinite(c.qty) ? c.qty : 44;
          const unit = Number.isFinite(c.unit) ? c.unit : s.unit;
          const day = Number.isFinite(c.day) ? c.day : s.creditDay;
          const next = nextDateForDay(day, new Date());
          const valor = enabled ? qty * unit : 0;

          if (enabled) {
            totalEnabled++;
            totalQtd += qty;
            totalValor += valor;
          }

          const rowClass = enabled ? 'vt-on' : 'vt-off';
          return `<tr class="${rowClass}">
            <td><input type="checkbox" disabled ${enabled ? 'checked' : ''}></td>
            <td class="vt-cell-left">${f.nome}</td>
            <td><input type="number" value="${qty}" disabled></td>
            <td><input type="number" value="${Number(unit || 0).toFixed(2)}" disabled></td>
            <td><input type="number" value="${day}" disabled></td>
            <td>${two(next.getDate())}/${two(
            next.getMonth() + 1
          )}/${next.getFullYear()}</td>
            <td><strong>${brl(valor)}</strong></td>
          </tr>`;
        })
        .join('');
    }

    if (vtKColab) vtKColab.textContent = String(totalEnabled);
    if (vtKQtd) vtKQtd.textContent = String(totalQtd);
    if (vtKValor) vtKValor.textContent = brl(totalValor);
    if (vtSumQtd) vtSumQtd.textContent = String(totalQtd);
    if (vtSumValor) vtSumValor.textContent = brl(totalValor);
  }

  // deixa global para outros módulos conseguirem chamar (home/funcionários)
  window.renderVT = renderVT;

  /* ===================== LISTENERS UI ===================== */

  vtUnit?.addEventListener('input', (e) => {
    let v = parseFloat(String(e.target.value).replace(',', '.'));
    if (!isFinite(v) || v < 0) v = 0;
    const s = getVTSettings();
    s.unit = v;
    setVTSettings(s);
    renderVT();
  });

  vtCreditDay?.addEventListener('input', (e) => {
    let d = parseInt(e.target.value, 10);
    if (!isFinite(d) || d < 1) d = 1;
    if (d > 31) d = 31;
    const s = getVTSettings();
    s.creditDay = d;
    setVTSettings(s);
    renderVT();
  });

  btnExportVTCSV?.addEventListener('click', () => {
    const emps = getFuncionariosLS()
      .filter((f) => f.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const conf = getVTMap();
    const s = getVTSettings();

    const rows = [
      [
        'Ativo',
        'Funcionário',
        'Qtd VT/mês',
        'Tarifa (R$)',
        'Dia crédito',
        'Próximo crédito',
        'Valor (R$)'
      ]
    ];

    emps.forEach((f) => {
      const c = conf[f.id] || {};
      const enabled = typeof c.enabled === 'boolean' ? c.enabled : !!f.optVT;
      const qty = Number.isFinite(c.qty) ? c.qty : 44;
      const unit = Number.isFinite(c.unit) ? c.unit : s.unit;
      const day = Number.isFinite(c.day) ? c.day : s.creditDay;
      const next = nextDateForDay(day, new Date());
      const valor = enabled ? qty * unit : 0;

      rows.push([
        enabled ? 'SIM' : 'NÃO',
        f.nome,
        qty,
        unit.toFixed(2).replace('.', ','),
        day,
        `${two(next.getDate())}/${two(
          next.getMonth() + 1
        )}/${next.getFullYear()}`,
        valor.toFixed(2).replace('.', ',')
      ]);
    });

    const csv = rows
      .map((r) =>
        r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')
      )
      .join('\n');

    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'vale_transporte.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();

    notify('CSV do VT exportado.', 'success');
  });

  btnExportVTPDF?.addEventListener('click', () => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return notify('jsPDF não carregado.', 'error');

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const mx = 28;
    let y = 36;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório — Vale Transporte', mx, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(new Date().toLocaleString('pt-BR'), mx, y);
    y += 10;

    const headers = [
      'Ativo',
      'Funcionário',
      'Qtd',
      'Tarifa',
      'Dia',
      'Próx. Crédito',
      'Valor'
    ];
    const widths = [46, 190, 40, 60, 36, 110, 60];

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

    const emps = getFuncionariosLS()
      .filter((f) => f.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const conf = getVTMap();
    const s = getVTSettings();

    let totQtd = 0;
    let totVal = 0;

    for (const f of emps) {
      const c = conf[f.id] || {};
      const enabled = typeof c.enabled === 'boolean' ? c.enabled : !!f.optVT;
      const qty = Number.isFinite(c.qty) ? c.qty : 44;
      const unit = Number.isFinite(c.unit) ? c.unit : s.unit;
      const day = Number.isFinite(c.day) ? c.day : s.creditDay;
      const next = nextDateForDay(day, new Date());
      const valor = enabled ? qty * unit : 0;

      if (y > 770) {
        doc.addPage();
        y = 36;
        drawHeader();
      }

      let x = mx;
      const cells = [
        enabled ? 'SIM' : 'NÃO',
        f.nome,
        String(qty),
        'R$ ' + unit.toFixed(2).replace('.', ','),
        String(day),
        `${two(next.getDate())}/${two(
          next.getMonth() + 1
        )}/${next.getFullYear()}`,
        'R$ ' + valor.toFixed(2).replace('.', ',')
      ];

      widths.forEach((w, i) => {
        doc.text(String(cells[i]), x + 4, y + 12);
        x += w;
      });

      doc.setDrawColor(230);
      doc.rect(mx, y, widths.reduce((a, b) => a + b, 0), 18, 'S');
      y += 18;

      if (enabled) {
        totQtd += qty;
        totVal += valor;
      }
    }

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Totais:', mx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Qtd VT/mês: ${totQtd}`, mx + 60, y);
    doc.text(
      `Valor total: R$ ${totVal.toFixed(2).replace('.', ',')}`,
      mx + 180,
      y
    );

    doc.save('vale_transporte.pdf');
    notify('PDF do VT exportado.', 'success');
  });

  /* ===================== SEED INICIAL DO MAPA ===================== */

  (function seedVT() {
    const map = getVTMap();
    if (Object.keys(map).length > 0) return;

    const emps = getFuncionariosLS().filter((f) => f.ativo);
    const s = getVTSettings();
    const m = {};

    emps.forEach((f) => {
      m[f.id] = {
        enabled: !!f.optVT,
        qty: 44,
        unit: s.unit,
        day: s.creditDay
      };
    });

    setVTMap(m);
  })();

  // render inicial
  renderVT();
})();
