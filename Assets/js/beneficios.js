/* =========================================================
   BENEFÍCIOS PRO — Modal + Tabs + Cálculos VT/VR
   (sem Tailwind, pronto pro seu home.html)
   ========================================================= */
(() => {
  const modal = document.getElementById("modalBeneficios");
  if (!modal) return;

  const btnCloseX = document.getElementById("btnCloseBeneficios");
  const btnCloseFooter = document.getElementById("btnFecharBeneficios");

  const btnTabVT = document.getElementById("btnTabVT");
  const btnTabVR = document.getElementById("btnTabVR");
  const paneVT = document.getElementById("paneVT");
  const paneVR = document.getElementById("paneVR");

  const kpiContainer = document.getElementById("kpiContainer");

  const vtTableBody = document.getElementById("vtTableBody");
  const vrTableBody = document.getElementById("vrTableBody");

  const elVtTarifa = document.getElementById("globalVtTarifa");
  const elVtDias = document.getElementById("globalVtDias");
  const elVtCreditDay = document.getElementById("vtCreditDay");

  const elVrDiario = document.getElementById("globalVrDiario");
  const elVrDias = document.getElementById("globalVrDias");
  const elVrLimit = document.getElementById("limitVrDiscount");

  const btnExportVTCSV = document.getElementById("btnExportVTCSV");
  const btnExportVTPDF = document.getElementById("btnExportVTPDF");

  // -----------------------------
  // Helpers
  // -----------------------------
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  function toNumber(v) {
    if (v == null) return 0;
    const s = String(v).trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function money(v) {
    return brl.format(Number(v || 0));
  }

  function getColaboradores() {
    // 1) Se você já injeta algo global:
    const candidates = [
      window.__beneficiosColaboradores,
      window.colaboradores,
      window.funcionarios,
      window.FUNCIONARIOS,
    ];

    for (const c of candidates) {
      if (Array.isArray(c) && c.length) return normalizeColabs(c);
    }

    // 2) LocalStorage (tenta chaves comuns)
    const keys = ["funcionarios", "colaboradores", "atrium_funcionarios", "atrium.funcionarios"];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return normalizeColabs(parsed);
      } catch {}
    }

    // 3) Fallback demo (não quebra a tela)
    return [
      { id: 1, nome: "Gustavo Alcantara", cargo: "Desenvolvedor Sr", salario: 8500, optVT: true, optVR: true, tarifaVT: 5.50, creditoDia: 5 },
      { id: 2, nome: "Mariana Souza", cargo: "Designer UI", salario: 4200, optVT: true, optVR: true, tarifaVT: 4.40, creditoDia: 5 },
      { id: 3, nome: "Carlos Eduardo", cargo: "Analista RH", salario: 3500, optVT: false, optVR: true, tarifaVT: 0, creditoDia: 10 },
      { id: 4, nome: "Fernanda Lima", cargo: "Engenheira", salario: 12000, optVT: true, optVR: true, tarifaVT: 6.00, creditoDia: 1 },
    ];
  }

  function normalizeColabs(arr) {
    // tenta mapear seu objeto real pro formato do módulo
    return arr.map((x, i) => {
      const nome = x.nome ?? x.Nome ?? x.nomeCompleto ?? x.funcionarioNome ?? `Funcionário ${i + 1}`;
      const cargo = x.cargo ?? x.funcao ?? x.Funcao ?? x.role ?? "";
      const salario =
        x.salario ??
        x.salarioBase ??
        x.salario_base ??
        x.salarioBruto ??
        x.Salario ??
        0;

      // optantes (você pode adaptar depois)
      const optVT =
        x.optVT ??
        x.vt ??
        x.vtOptante ??
        x.benefVT ??
        x?.beneficios?.vt ??
        false;

      const optVR =
        x.optVR ??
        x.vr ??
        x.vrOptante ??
        x.benefVR ??
        x?.beneficios?.vr ??
        false;

      const tarifaVT = x.tarifaVT ?? x.vtTarifa ?? x?.beneficios?.vtTarifa ?? 0;
      const creditoDia = x.creditoDia ?? x.vtCreditoDia ?? x?.beneficios?.vtCreditoDia ?? 1;

      return {
        id: x.id ?? x.funcionarioId ?? i + 1,
        nome: String(nome),
        cargo: String(cargo),
        salario: toNumber(salario),
        optVT: !!optVT,
        optVR: !!optVR,
        tarifaVT: toNumber(tarifaVT),
        creditoDia: Number(creditoDia) || 1,
      };
    });
  }

  function isVTActive() {
    return !paneVT.classList.contains("hidden");
  }

  // -----------------------------
  // Modal open/close
  // -----------------------------
  function openModalBeneficios(tab = "VT") {
    modal.classList.add("show");
    modal.style.display = "flex";
    switchTab(tab);
    calculateAll();
  }

  function closeModalBeneficios() {
    modal.classList.remove("show");
    modal.style.display = "none";
  }

  // fecha ao clicar fora
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalBeneficios();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display !== "none") closeModalBeneficios();
  });

  btnCloseX?.addEventListener("click", closeModalBeneficios);
  btnCloseFooter?.addEventListener("click", closeModalBeneficios);

  // Menu (seu HTML tem <li data-benef-open="VT|VR">)
  document.querySelectorAll("[data-benef-open]").forEach((el) => {
    el.addEventListener("click", () => {
      const tab = (el.getAttribute("data-benef-open") || "VT").toUpperCase();
      openModalBeneficios(tab);
    });
  });

  // -----------------------------
  // Tabs
  // -----------------------------
  function switchTab(tab) {
    const t = String(tab || "VT").toUpperCase();

    if (t === "VR") {
      paneVT.classList.add("hidden");
      paneVR.classList.remove("hidden");
      btnTabVT?.classList.remove("active");
      btnTabVR?.classList.add("active");
    } else {
      paneVR.classList.add("hidden");
      paneVT.classList.remove("hidden");
      btnTabVR?.classList.remove("active");
      btnTabVT?.classList.add("active");
    }
  }

  // expõe porque seu HTML usa onclick="switchTab('VT')"
  window.switchTab = (tab) => {
    switchTab(tab);
    calculateAll();
  };

  // -----------------------------
  // Render KPI
  // -----------------------------
  function renderKPIs(cards) {
    if (!kpiContainer) return;

    kpiContainer.innerHTML = cards
      .map(
        (c) => `
        <div class="glass-card kpi-card ${c.variant || ""}">
          <div class="kpi-label">${c.label}</div>
          <div class="kpi-value">${c.value}</div>
        </div>
      `
      )
      .join("");
  }

  // -----------------------------
  // Render Tables
  // -----------------------------
  function renderVT(rows) {
    if (!vtTableBody) return;
    if (!rows.length) {
      vtTableBody.innerHTML = `<tr><td colspan="7" style="opacity:.7;">—</td></tr>`;
      return;
    }

    vtTableBody.innerHTML = rows
      .map((r) => {
        return `
          <tr>
            <td style="text-align:center;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:var(--c1,#00E0FF);box-shadow:0 0 10px rgba(0,224,255,.55);"></span>
            </td>
            <td>
              <div style="font-weight:800;">${escapeHTML(r.nome)}</div>
              <div style="font-size:10px;opacity:.65;letter-spacing:.08em;text-transform:uppercase;">
                Salário: ${money(r.salario)}
              </div>
            </td>
            <td style="text-align:center;font-variant-numeric: tabular-nums;">${money(r.tarifa)}</td>
            <td style="text-align:center;font-variant-numeric: tabular-nums;color: var(--c2,#FF2FB9);">
              - ${money(r.desconto)}
            </td>
            <td style="text-align:center;font-weight:900;color: var(--ok,#10b981);">${money(r.custoEmpresa)}</td>
            <td style="text-align:center;font-size:12px;opacity:.8;">Dia ${r.creditoDia}</td>
            <td style="text-align:center;font-weight:900;color: var(--c1,#00E0FF);">${money(r.bruto)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderVR(rows) {
    if (!vrTableBody) return;
    if (!rows.length) {
      vrTableBody.innerHTML = `<tr><td colspan="6" style="opacity:.7;">—</td></tr>`;
      return;
    }

    vrTableBody.innerHTML = rows
      .map((r) => {
        return `
          <tr>
            <td style="text-align:center;">
              <i class="fa-solid fa-check-circle" style="color: var(--c1,#00E0FF);"></i>
            </td>
            <td>
              <div style="font-weight:800;">${escapeHTML(r.nome)}</div>
              <div style="font-size:10px;opacity:.65;">${escapeHTML(r.cargo || "")}</div>
            </td>
            <td style="text-align:center;font-variant-numeric: tabular-nums;">${money(r.vrMensal)}</td>
            <td style="text-align:center;font-variant-numeric: tabular-nums;color: var(--c2,#FF2FB9);">${money(r.desconto)}</td>
            <td style="text-align:center;font-weight:900;color: var(--c1,#00E0FF);">${money(r.liquidoEmpresa)}</td>
            <td style="text-align:center;">
              <span style="font-size:10px;border:1px solid rgba(0,224,255,.30);background:rgba(0,224,255,.10);padding:4px 10px;border-radius:999px;color:var(--c1,#00E0FF);font-weight:900;text-transform:uppercase;">
                Processado
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // -----------------------------
  // Main calculation
  // -----------------------------
  function calculateAll() {
    const colaboradores = getColaboradores();

    const vtTarifaGlobal = toNumber(elVtTarifa?.value);
    const vtDias = Math.max(0, Math.trunc(toNumber(elVtDias?.value)));
    const vtCreditDay = Math.max(1, Math.min(31, Math.trunc(toNumber(elVtCreditDay?.value || 1))));

    const vrDiario = toNumber(elVrDiario?.value);
    const vrDias = Math.max(0, Math.trunc(toNumber(elVrDias?.value)));
    const limitVr = !!elVrLimit?.checked;

    // Totais
    let totalVT_Bruto = 0;
    let totalVT_Desc = 0;
    let totalVR_Bruto = 0;
    let totalVR_Desc = 0;

    let cVT = 0;
    let cVR = 0;

    // VT rows
    const vtRows = [];
    for (const func of colaboradores) {
      if (!func.optVT) continue;
      cVT++;

      const tarifa = func.tarifaVT > 0 ? func.tarifaVT : vtTarifaGlobal;
      const bruto = tarifa * 2 * vtDias;
      const descLegal = func.salario * 0.06;
      const desconto = Math.min(bruto, descLegal);
      const custoEmpresa = Math.max(0, bruto - desconto);

      totalVT_Bruto += bruto;
      totalVT_Desc += desconto;

      vtRows.push({
        nome: func.nome,
        salario: func.salario,
        tarifa,
        bruto,
        desconto,
        custoEmpresa,
        creditoDia: func.creditoDia || vtCreditDay,
      });
    }

    // VR rows
    const vrRows = [];
    for (const func of colaboradores) {
      if (!func.optVR) continue;
      cVR++;

      const vrMensal = vrDiario * vrDias;
      const descSugerido = func.salario * 0.05;
      const desconto = limitVr ? Math.min(vrMensal, descSugerido) : descSugerido;
      const liquidoEmpresa = Math.max(0, vrMensal - desconto);

      totalVR_Bruto += vrMensal;
      totalVR_Desc += desconto;

      vrRows.push({
        nome: func.nome,
        cargo: func.cargo,
        vrMensal,
        desconto,
        liquidoEmpresa,
      });
    }

    // Render
    if (isVTActive()) {
      renderKPIs([
        { variant: "kpi-cyan", label: "Colaboradores (VT)", value: String(cVT) },
        { variant: "kpi-magenta", label: "Total recuperado (6%)", value: money(totalVT_Desc) },
        { variant: "kpi-green", label: "Investimento real", value: money(totalVT_Bruto - totalVT_Desc) },
        { variant: "kpi-slate", label: "Custo bruto mensal", value: money(totalVT_Bruto) },
      ]);
      renderVT(vtRows);
    } else {
      renderKPIs([
        { variant: "kpi-cyan", label: "Adesões (VR)", value: String(cVR) },
        { variant: "kpi-magenta", label: "Desconto médio", value: money(cVR ? (totalVR_Desc / cVR) : 0) },
        { variant: "kpi-green", label: "Líquido empresa", value: money(totalVR_Bruto - totalVR_Desc) },
        { variant: "kpi-slate", label: "Total benefício", value: money(totalVR_Bruto) },
      ]);
      renderVR(vrRows);
    }
  }

  window.calculateAll = calculateAll;

  // botão do HTML: onclick="exportData('VT')"
  window.exportData = (type) => {
    alert(`Gerando relatório de ${String(type).toUpperCase()}...`);
  };

  // CSV export simples (VT)
  btnExportVTCSV?.addEventListener("click", () => {
    // exporta o que estiver na tabela (VT)
    const rows = Array.from(vtTableBody?.querySelectorAll("tr") || []);
    if (!rows.length) return;

    const header = ["Funcionario", "Tarifa", "Desconto", "CustoEmpresa", "CreditoDia", "TotalBruto"];
    const data = [header.join(";")];

    // tenta ler texto das células
    rows.forEach((tr) => {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 7) return;
      const funcionario = tds[1]?.innerText?.split("\n")[0]?.trim() || "";
      const tarifa = tds[2]?.innerText?.trim() || "";
      const desconto = tds[3]?.innerText?.trim() || "";
      const custoEmpresa = tds[4]?.innerText?.trim() || "";
      const creditoDia = tds[5]?.innerText?.trim() || "";
      const total = tds[6]?.innerText?.trim() || "";
      data.push([funcionario, tarifa, desconto, custoEmpresa, creditoDia, total].join(";"));
    });

    const blob = new Blob([data.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `beneficios_vt_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  btnExportVTPDF?.addEventListener("click", () => {
    alert("PDF: se você quiser, eu adapto pra imprimir o painel/tabela (window.print) ou chamar uma rota da API.");
  });

  // Recalcula ao digitar
  [elVtTarifa, elVtDias, elVtCreditDay, elVrDiario, elVrDias, elVrLimit].forEach((el) => {
    el?.addEventListener("input", calculateAll);
    el?.addEventListener("change", calculateAll);
  });

  // Primeira carga quando abrir (se abrir via JS)
  // (não abre sozinho)
})();
