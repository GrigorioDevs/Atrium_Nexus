// cursos.js — Catálogo + Vínculo ao Funcionário (Front puro JS)
// ✅ ROTA CERTA (SEU BACK):
//    GET  /api/funcionario-curso/funcionario/{funcId}
//    POST /api/funcionario-curso
//    PUT  /api/funcionario-curso/{vinculoId}
//    DELETE /api/funcionario-curso/{vinculoId}
// ✅ Categoria enviada como tinyint (1..4), não string ("TECNICO")

(() => {
  "use strict";

  // =========================
  // CONFIG
  // =========================
  const API_BASE = (window.API_BASE ??
    localStorage.getItem("API_BASE") ??
    "http://localhost:5253").replace(/\/$/, "");

  const API = {
    // cursos (catálogo)
    cursos: () => `${API_BASE}/api/cursos`,
    cursoById: (id) => `${API_BASE}/api/cursos/${encodeURIComponent(id)}`,

    // ✅ vínculos (SEU ENDPOINT REAL)
    funcionarioCursos: (funcId) =>
      `${API_BASE}/api/funcionario-curso/funcionario/${encodeURIComponent(funcId)}`, // GET list do funcionário
    funcionarioCursoCreate: () => `${API_BASE}/api/funcionario-curso`,               // POST create
    funcionarioCursoById: (vincId) =>
      `${API_BASE}/api/funcionario-curso/${encodeURIComponent(vincId)}`,             // PUT/DELETE
  };

  // =========================
  // HELPERS
  // =========================
  const qs = (sel, root = document) => root.querySelector(sel);

  function pick(obj, keys, fallback = null) {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return fallback;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function todayDateOnly() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function parseISODate(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtBR(v) {
    const d = parseISODate(v);
    if (!d) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  function diffDays(a, b) {
    const ms = 24 * 60 * 60 * 1000;
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((db - da) / ms);
  }

  function statusFromValidade(validadeISO) {
    if (!validadeISO) return { label: "PERMANENTE", cls: "chip-perm" };

    const t = todayDateOnly();
    const v = parseISODate(validadeISO);
    if (!v) return { label: "—", cls: "" };

    const days = diffDays(t, v);
    if (days < 0) return { label: "VENCIDO", cls: "chip-warn" };
    if (days <= 30) return { label: `EXPIRA (${days}d)`, cls: "chip-warn" };
    return { label: "VÁLIDO", cls: "chip-perm" };
  }

  async function apiFetch(url, opts = {}) {
    const isJsonBody = opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData);

    const headers = {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    };

    const res = await fetch(url, {
      credentials: "include",
      mode: "cors",
      ...opts,
      headers,
      body: isJsonBody ? JSON.stringify(opts.body) : opts.body,
    });

    const ct = res.headers.get("content-type") || "";
    const payload = ct.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);

    if (!res.ok) {
      const msg =
        (payload && payload.message) ||
        (typeof payload === "string" && payload) ||
        `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }

    return payload;
  }

  function openOverlay(el) {
    if (!el) return;
    el.style.display = "flex";
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
  }

  function closeOverlay(el) {
    if (!el) return;
    el.style.display = "none";
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
  }

  function bindOverlayCloseOnBackdrop(overlay, closeFn) {
    if (!overlay) return;
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeFn();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display !== "none") closeFn();
    });
  }

  // =========================
  // CATEGORIA (enum tinyint)
  // =========================
  const CategoriaMap = { TECNICO: 1, NR: 2, COMPORTAMENTAL: 3, OUTROS: 4 };
  const CategoriaLabelMap = { 1: "TECNICO", 2: "NR", 3: "COMPORTAMENTAL", 4: "OUTROS" };

  function normalizeKey(s) {
    return String(s ?? "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  function parseCategoriaToTinyInt(value) {
    const v = String(value ?? "").trim();
    if (!v) return null;

    if (/^\d+$/.test(v)) {
      const n = Number(v);
      return n >= 1 && n <= 4 ? n : null;
    }

    const key = normalizeKey(v);
    return CategoriaMap[key] ?? null;
  }

  function categoriaToLabel(value) {
    if (value == null) return "";
    const v = String(value).trim();
    if (/^\d+$/.test(v)) return CategoriaLabelMap[Number(v)] ?? v;
    return v;
  }

  // =========================
  // NORMALIZERS
  // =========================
  function normalizeCurso(raw) {
    const curso = raw?.curso || raw;

    const catRaw = pick(curso, ["categoria", "Categoria"], "");
    const catTiny = parseCategoriaToTinyInt(catRaw);
    const catLabel = catTiny ? CategoriaLabelMap[catTiny] : categoriaToLabel(catRaw);

    return {
      id: pick(curso, ["id", "Id", "cursoId", "CursoId"]),
      nome: pick(curso, ["nome", "Nome", "cursoNome", "CursoNome"], ""),
      cargaHoraria: pick(curso, ["cargaHoraria", "CargaHoraria", "carga_horaria", "Carga_Horaria"], 0),
      categoria: catTiny ?? catRaw,
      categoriaLabel: catLabel,
      observacao: pick(curso, ["observacao", "Observacao"], ""),
      descricao: pick(curso, ["descricao", "Descricao"], ""),
      ativo: pick(curso, ["ativo", "Ativo"], true),
    };
  }

  function normalizeVinculo(raw) {
    const curso = raw?.curso ? normalizeCurso(raw.curso) : normalizeCurso(raw);

    const validade =
      pick(raw, ["dataValidade", "DataValidade", "validade", "Validade", "data_validade", "dataValidadeISO"], null) ??
      null;

    const dataConclusao =
      pick(raw, ["dataConclusao", "DataConclusao", "data_conclusao", "conclusao", "Conclusao"], null) ??
      null;

    return {
      id: pick(raw, ["id", "Id", "vinculoId", "VinculoId", "funcionarioCursoId", "FuncionarioCursoId"]),
      funcionarioId: pick(raw, ["funcionarioId", "FuncionarioId", "funcionarioid", "funcionario_id"]),
      cursoId: pick(raw, ["cursoId", "CursoId", "cursoid", "curso_id"], curso.id),
      cursoNome: pick(raw, ["cursoNome", "CursoNome"], curso.nome),
      cursoCategoria: pick(raw, ["cursoCategoria", "CursoCategoria"], curso.categoriaLabel || curso.categoria),
      cursoCargaHoraria: pick(raw, ["cursoCargaHoraria", "CursoCargaHoraria"], curso.cargaHoraria),
      dataConclusao,
      validade,
    };
  }

  // =========================
  // STATE
  // =========================
  const state = {
    empId: null,
    empNome: "",
    cursos: [],
    vinculos: [],
    filtro: "",
    editingCursoId: null,
    editingVinculoId: null,
    bound: false,
  };

  // =========================
  // DOM REFS
  // =========================
  const dom = {};

  function cacheDom() {
    dom.pane = qs("#paneCursos");
    if (!dom.pane) return false;

    dom.empIdHidden = qs("#cursosEmpId", dom.pane);
    dom.empNomeLabel = qs("#cursosFuncionarioNome", dom.pane); // se existir

    dom.btnNovoCurso = qs("#btnNovoCurso", dom.pane);
    dom.btnRefreshCursos = qs("#btnRefreshCursos", dom.pane);
    dom.cursoSearch = qs("#cursoSearch", dom.pane);
    dom.tblCatalogo = qs("#tblCursosCatalogo", dom.pane);
    dom.catalogoBody = qs("#cursosCatalogoBody", dom.pane);
    dom.catalogoEmpty = qs("#cursosCatalogoEmpty", dom.pane);

    dom.btnReloadVinculos = qs("#btnReloadCursosFuncionario", dom.pane);
    dom.cursoSelect = qs("#cursoSelect", dom.pane);
    dom.cursoConclusao = qs("#cursoConclusao", dom.pane);
    dom.cursoValidade = qs("#cursoValidade", dom.pane);
    dom.btnVincular = qs("#btnVincularCurso", dom.pane);

    dom.tblFunc = qs("#tblCursosFuncionario", dom.pane);
    dom.funcBody = qs("#cursosFuncionarioBody", dom.pane);
    dom.funcEmpty = qs("#cursosFuncionarioEmpty", dom.pane);

    dom.modalCurso = qs("#modalCurso");
    dom.btnCloseModalCurso = qs("#btnCloseModalCurso");
    dom.btnCancelarCurso = qs("#btnCancelarCurso");
    dom.btnSalvarCurso = qs("#btnSalvarCurso");
    dom.cursoId = qs("#cursoId");
    dom.cursoNome = qs("#cursoNome");
    dom.cursoCarga = qs("#cursoCarga");
    dom.cursoCategoria = qs("#cursoCategoria");
    dom.cursoObs = qs("#cursoObs");
    dom.cursoDescricao = qs("#cursoDescricao");

    dom.modalEmpCurso = qs("#modalEmpCurso");
    dom.btnCloseModalEmpCurso = qs("#btnCloseModalEmpCurso");
    dom.btnCancelarEmpCurso = qs("#btnCancelarEmpCurso");
    dom.btnSalvarEmpCurso = qs("#btnSalvarEmpCurso");
    dom.empCursoId = qs("#empCursoId");
    dom.empCursoNomePreview = qs("#empCursoNomePreview");
    dom.empCursoConclusao = qs("#empCursoConclusao");
    dom.empCursoValidade = qs("#empCursoValidade");

    return true;
  }

  // =========================
  // RENDER
  // =========================
  function renderCatalogo() {
    if (!dom.catalogoBody) return;

    const q = (state.filtro || "").trim().toLowerCase();
    const items = state.cursos
      .filter((c) => c.ativo !== false)
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.nome} ${c.cargaHoraria} ${c.categoriaLabel || c.categoria} ${c.observacao} ${c.descricao}`.toLowerCase();
        return hay.includes(q);
      });

    dom.catalogoBody.innerHTML = "";

    if (!items.length) {
      if (dom.catalogoEmpty) dom.catalogoEmpty.style.display = "block";
      fillCursoSelect();
      return;
    }
    if (dom.catalogoEmpty) dom.catalogoEmpty.style.display = "none";

    for (const c of items) {
      const tr = document.createElement("tr");
      tr.dataset.cursoId = c.id;

      const sub1 = [c.categoriaLabel || c.categoria, c.observacao].filter(Boolean).join(" • ");
      const sub2 = (c.descricao || "").trim();

      tr.innerHTML = `
        <td class="col-curso">
          <div class="curso-title" style="font-weight:900;color:#fff">${escapeHtml(c.nome)}</div>
          ${sub1 ? `<div class="curso-sub filehint" style="margin-top:2px">${escapeHtml(sub1)}</div>` : ""}
          ${sub2 ? `<div class="curso-sub2 filehint" style="margin-top:2px">${escapeHtml(sub2)}</div>` : ""}
        </td>

        <td class="col-carga" style="text-align:center;font-weight:900;color:#34d399;">
          ${Number(c.cargaHoraria || 0)}h
        </td>

        <td class="col-acoes" style="text-align:right;white-space:nowrap">
          <button class="btn" type="button" data-action="pick" title="Selecionar para vincular">
            <i class="fa-solid fa-hand-pointer"></i>
          </button>
          <button class="btn" type="button" data-action="edit" title="Editar curso">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn" type="button" data-action="delete" title="Excluir/inativar curso">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;

      dom.catalogoBody.appendChild(tr);
    }

    fillCursoSelect();
  }

  function fillCursoSelect() {
    if (!dom.cursoSelect) return;

    const current = dom.cursoSelect.value || "";
    const ativos = state.cursos.filter((c) => c.ativo !== false);

    dom.cursoSelect.innerHTML = `<option value="">— Selecione um curso —</option>`;
    for (const c of ativos) {
      const opt = document.createElement("option");
      opt.value = c.id;
      const cat = (c.categoriaLabel || c.categoria) ? ` • ${c.categoriaLabel || c.categoria}` : "";
      opt.textContent = `${c.nome} (${Number(c.cargaHoraria || 0)}h${cat})`;
      dom.cursoSelect.appendChild(opt);
    }
    dom.cursoSelect.value = ativos.some((c) => String(c.id) === String(current)) ? current : "";
  }

  function renderVinculos() {
    if (!dom.funcBody) return;

    dom.funcBody.innerHTML = "";

    if (!state.vinculos.length) {
      if (dom.funcEmpty) dom.funcEmpty.style.display = "block";
      return;
    }
    if (dom.funcEmpty) dom.funcEmpty.style.display = "none";

    for (const v of state.vinculos) {
      const st = statusFromValidade(v.validade);

      const tr = document.createElement("tr");
      tr.dataset.vinculoId = v.id;
      tr.dataset.cursoId = v.cursoId;

      tr.innerHTML = `
        <td class="col-curso">
          <div style="font-weight:900;color:#fff">${escapeHtml(v.cursoNome || "—")}</div>
          <div class="filehint" style="margin-top:2px">
            ${(v.cursoCategoria || "").trim() ? escapeHtml(v.cursoCategoria) + " • " : ""}${Number(v.cursoCargaHoraria || 0)}h
          </div>
        </td>

        <td class="col-conc">${fmtBR(v.dataConclusao)}</td>

        <td class="col-status">
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
            <span class="chip ${st.cls}">${escapeHtml(st.label)}</span>
            
          </div>
        </td>

        <td class="col-acoes" style="text-align:right;white-space:nowrap">
          <button class="btn" type="button" data-action="edit-vinculo" title="Alterar conclusão/validade">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn" type="button" data-action="edit-curso" title="Alterar nome/categoria do curso">
            <i class="fa-solid fa-font"></i>
          </button>
          <button class="btn" type="button" data-action="delete-vinculo" title="Remover curso do funcionário">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;

      dom.funcBody.appendChild(tr);
    }
  }

  function renderEmpHeader() {
    if (dom.empNomeLabel) {
      dom.empNomeLabel.textContent = state.empNome ? state.empNome : "Funcionário";
    }
  }

  // =========================
  // LOADERS
  // =========================
  async function loadCatalogo() {
    const data = await apiFetch(API.cursos(), { method: "GET" });
    const arr = Array.isArray(data) ? data : (data?.items || data?.value || []);
    state.cursos = arr.map(normalizeCurso);
    renderCatalogo();
  }

  async function loadVinculosFuncionario() {
    if (!state.empId) {
      state.vinculos = [];
      renderVinculos();
      return;
    }

    // ✅ SUA ROTA REAL
    const data = await apiFetch(API.funcionarioCursos(state.empId), { method: "GET" });
    const arr = Array.isArray(data) ? data : (data?.items || data?.value || []);
    state.vinculos = arr.map(normalizeVinculo);
    renderVinculos();
  }

  // =========================
  // MODAL CURSO
  // =========================
  function openModalCursoCreate() {
    state.editingCursoId = null;

    if (dom.cursoId) dom.cursoId.value = "";
    if (dom.cursoNome) dom.cursoNome.value = "";
    if (dom.cursoCarga) dom.cursoCarga.value = "";
    if (dom.cursoCategoria) dom.cursoCategoria.value = "";
    if (dom.cursoObs) dom.cursoObs.value = "";
    if (dom.cursoDescricao) dom.cursoDescricao.value = "";

    openOverlay(dom.modalCurso);
    dom.cursoNome?.focus();
  }

  function openModalCursoEdit(cursoId) {
    const c = state.cursos.find((x) => String(x.id) === String(cursoId));
    if (!c) return;

    state.editingCursoId = c.id;

    if (dom.cursoId) dom.cursoId.value = c.id ?? "";
    if (dom.cursoNome) dom.cursoNome.value = c.nome ?? "";
    if (dom.cursoCarga) dom.cursoCarga.value = c.cargaHoraria ?? "";

    if (dom.cursoCategoria) {
      const tiny = parseCategoriaToTinyInt(c.categoria);
      dom.cursoCategoria.value = tiny != null ? String(tiny) : String(c.categoria ?? "");
    }

    if (dom.cursoObs) dom.cursoObs.value = c.observacao ?? "";
    if (dom.cursoDescricao) dom.cursoDescricao.value = c.descricao ?? "";

    openOverlay(dom.modalCurso);
    dom.cursoNome?.focus();
  }

  async function saveCurso() {
    const nome = (dom.cursoNome?.value || "").trim();
    const carga = Number(dom.cursoCarga?.value || 0);
    const categoriaRaw = dom.cursoCategoria?.value || "";
    const categoriaTiny = parseCategoriaToTinyInt(categoriaRaw);
    const observacao = (dom.cursoObs?.value || "").trim();
    const descricao = (dom.cursoDescricao?.value || "").trim();

    if (!nome) {
      alert("Informe o nome do curso.");
      dom.cursoNome?.focus();
      return;
    }
    if (!categoriaTiny) {
      alert("Selecione a categoria do curso (1..4).");
      dom.cursoCategoria?.focus();
      return;
    }

    const payload = {
      nome,
      cargaHoraria: carga,
      categoria: categoriaTiny,
      observacao,
      descricao,
      ativo: true,
    };

    if (!state.editingCursoId) {
      await apiFetch(API.cursos(), { method: "POST", body: payload });
    } else {
      await apiFetch(API.cursoById(state.editingCursoId), { method: "PUT", body: payload });
    }

    closeOverlay(dom.modalCurso);
    await loadCatalogo();
    await loadVinculosFuncionario();
  }

  async function deleteCurso(cursoId) {
    const ok = confirm("Deseja excluir/inativar este curso do catálogo?");
    if (!ok) return;

    await apiFetch(API.cursoById(cursoId), { method: "DELETE" });

    await loadCatalogo();
    await loadVinculosFuncionario();
  }

  // =========================
  // VINCULAR CURSO (POST /api/funcionario-curso)
  // =========================
  async function vincularCurso() {
    if (!state.empId) {
      alert("Abra o card de um funcionário antes de vincular (empId vazio).");
      return;
    }

    const cursoId = Number(dom.cursoSelect?.value || 0);
    const conclusao = dom.cursoConclusao?.value || "";
    const validade = dom.cursoValidade?.value || "";

    if (!cursoId) {
      alert("Selecione um curso do catálogo.");
      dom.cursoSelect?.focus();
      return;
    }
    if (!conclusao) {
      alert("Informe a data de conclusão.");
      dom.cursoConclusao?.focus();
      return;
    }

    // ✅ Seu controller flat precisa receber o funcionarioId no BODY
    const payload = {
      funcionarioId: Number(state.empId),
      cursoId,
      dataConclusao: conclusao,
      // seu back pode estar esperando "dataValidade" (mais comum)
      dataValidade: validade || null,
      // e/ou "validade" (tolerante)
      validade: validade || null,
      ativo: true,
    };

    await apiFetch(API.funcionarioCursoCreate(), { method: "POST", body: payload });

    if (dom.cursoConclusao) dom.cursoConclusao.value = "";
    if (dom.cursoValidade) dom.cursoValidade.value = "";

    await loadVinculosFuncionario();
  }

  // =========================
  // MODAL EDITAR VÍNCULO
  // =========================
  function openModalVinculoEdit(vinculoId) {
    const v = state.vinculos.find((x) => String(x.id) === String(vinculoId));
    if (!v) return;

    state.editingVinculoId = v.id;

    if (dom.empCursoId) dom.empCursoId.value = v.id ?? "";
    if (dom.empCursoNomePreview) dom.empCursoNomePreview.textContent = v.cursoNome || "—";
    if (dom.empCursoConclusao) dom.empCursoConclusao.value = (v.dataConclusao || "").slice(0, 10);

    const val = v.validade || "";
    if (dom.empCursoValidade) dom.empCursoValidade.value = val ? String(val).slice(0, 10) : "";

    openOverlay(dom.modalEmpCurso);
  }

  async function saveVinculo() {
    if (!state.editingVinculoId) return;

    const conclusao = dom.empCursoConclusao?.value || "";
    const validade = dom.empCursoValidade?.value || "";

    if (!conclusao) {
      alert("Informe a data de conclusão.");
      dom.empCursoConclusao?.focus();
      return;
    }

    const payload = {
      dataConclusao: conclusao,
      dataValidade: validade || null,
      validade: validade || null,
    };

    await apiFetch(API.funcionarioCursoById(state.editingVinculoId), {
      method: "PUT",
      body: payload,
    });

    closeOverlay(dom.modalEmpCurso);
    state.editingVinculoId = null;
    await loadVinculosFuncionario();
  }

  async function deleteVinculo(vinculoId) {
    const ok = confirm("Remover este curso do funcionário?");
    if (!ok) return;

    await apiFetch(API.funcionarioCursoById(vinculoId), { method: "DELETE" });
    await loadVinculosFuncionario();
  }

  // =========================
  // EVENTS
  // =========================
  function bindEvents() {
    if (state.bound) return;
    state.bound = true;

    dom.btnNovoCurso?.addEventListener("click", () => openModalCursoCreate());
    dom.btnRefreshCursos?.addEventListener("click", () => loadCatalogo().catch(showErr));
    dom.btnReloadVinculos?.addEventListener("click", () => loadVinculosFuncionario().catch(showErr));
    dom.btnVincular?.addEventListener("click", () => vincularCurso().catch(showErr));

    dom.cursoSearch?.addEventListener("input", () => {
      state.filtro = dom.cursoSearch.value || "";
      renderCatalogo();
    });

    const closeCurso = () => closeOverlay(dom.modalCurso);
    dom.btnCloseModalCurso?.addEventListener("click", closeCurso);
    dom.btnCancelarCurso?.addEventListener("click", closeCurso);
    bindOverlayCloseOnBackdrop(dom.modalCurso, closeCurso);
    dom.btnSalvarCurso?.addEventListener("click", () => saveCurso().catch(showErr));

    const closeV = () => closeOverlay(dom.modalEmpCurso);
    dom.btnCloseModalEmpCurso?.addEventListener("click", closeV);
    dom.btnCancelarEmpCurso?.addEventListener("click", closeV);
    bindOverlayCloseOnBackdrop(dom.modalEmpCurso, closeV);
    dom.btnSalvarEmpCurso?.addEventListener("click", () => saveVinculo().catch(showErr));

    dom.tblCatalogo?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const tr = btn.closest("tr");
      const cursoId = tr?.dataset?.cursoId;
      const act = btn.dataset.action;

      if (!cursoId) return;

      if (act === "edit") openModalCursoEdit(cursoId);
      if (act === "delete") deleteCurso(cursoId).catch(showErr);
      if (act === "pick") {
        if (dom.cursoSelect) dom.cursoSelect.value = String(cursoId);
        dom.cursoConclusao?.focus();
      }
    });

    dom.tblFunc?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const tr = btn.closest("tr");
      const vincId = tr?.dataset?.vinculoId;
      const cursoId = tr?.dataset?.cursoId;
      const act = btn.dataset.action;

      if (act === "edit-vinculo" && vincId) openModalVinculoEdit(vincId);
      if (act === "delete-vinculo" && vincId) deleteVinculo(vincId).catch(showErr);
      if (act === "edit-curso" && cursoId) openModalCursoEdit(cursoId);
    });

    // ✅ bônus: se seu funcionarios.js dispara evento, pega aqui também
    window.addEventListener("atrium:employee:selected", (ev) => {
      const d = ev?.detail || {};
      setEmployee(d.id ?? d.funcionarioId ?? null, d.nome ?? "");
    });
  }

  function showErr(err) {
    console.error(err);
    alert(err?.message || "Erro inesperado.");
  }

  // =========================
  // PUBLIC API (setar funcionário do card)
  // =========================
  async function setEmployee(emp, nome) {
    const empId =
      typeof emp === "object" ? (emp?.id ?? emp?.Id ?? emp?.funcionarioId ?? emp?.FuncionarioId) : emp;
    const empNome =
      typeof emp === "object" ? (emp?.nome ?? emp?.Nome ?? "") : (nome ?? "");

    state.empId = empId ? String(empId) : null;
    state.empNome = empNome ? String(empNome) : "";

    if (dom.empIdHidden) dom.empIdHidden.value = state.empId || "";
    renderEmpHeader();

    await loadVinculosFuncionario().catch(showErr);
  }

  // =========================
  // INIT
  // =========================
  async function waitForPaneCursos() {
    for (let i = 0; i < 100; i++) {
      if (document.querySelector("#paneCursos")) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  async function init() {
    const ok = await waitForPaneCursos();
    if (!ok) return;

    if (!cacheDom()) return;

    bindEvents();
    await loadCatalogo().catch(showErr);

    const initialEmpId = dom.empIdHidden?.value;
    if (initialEmpId && !state.empId) {
      await setEmployee(initialEmpId, "").catch(showErr);
    } else {
      renderVinculos();
    }
  }

  window.CursosPane = { init, setEmployee };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init().catch(showErr), { once: true });
  } else {
    init().catch(showErr);
  }
})();
