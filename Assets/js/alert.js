// alert.js — Central de Lembretes (GET docs importantes) + Popup (vence HOJE) + “Corrigido”
// ✅ Funciona mesmo quando o script é carregado DEPOIS do DOMContentLoaded (loader dinâmico)

(function () {
  "use strict";

  // =========================================================
  // INIT "à prova" do loader dinâmico
  // =========================================================
  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  whenReady(() => {
    // Se quiser ver se o arquivo foi carregado MESMO:
    console.log("ALERT JS carregado ✅");

    // Rode init async sem depender do evento
    init().catch((err) => console.error("Erro no init do alert.js:", err));
  });

  async function init() {
    console.log("ALERT INIT ✅");

    // =========================================================
    // 0) CONFIG
    // =========================================================
    const ALERTS_API_URL = "http://localhost:5253/api/lembretes/docs-importantes";

    // =========================================================
    // 1) SELETORES
    // =========================================================
    const btnAlerts = document.getElementById("btnAlerts");
    const notifDot = document.getElementById("notifDot");

    const modalLembretes = document.getElementById("modalLembretes");
    const btnCloseLembretesTop = document.getElementById("btnCloseLembretes");
    const btnCloseLembretesBottom = document.getElementById("btnFecharLembretesBottom");
    const btnNovoLembrete = document.getElementById("btnNovoLembrete");

    const modalCadastro = document.getElementById("modalCadastroUsuario");
    const btnCloseCadastroTop = document.getElementById("btnFecharCadastro");
    const btnCancelarCadastro = document.getElementById("btnCancelarCadastro");
    const btnSalvarCadastro = document.getElementById("btnSalvarCadastro");

    const popupAlarme = document.getElementById("popupAlarme");
    const btnSnooze = document.getElementById("btnSnooze");
    const btnResolve = document.getElementById("btnResolve");
    const alarmList = document.getElementById("alarmList");

    const listaLembretesBody = document.getElementById("listaLembretesBody");

    // Log de diagnóstico (se algum ID estiver faltando)
    if (!btnAlerts) console.warn("Faltando #btnAlerts no HTML");
    if (!modalLembretes) console.warn("Faltando #modalLembretes no HTML");
    if (!listaLembretesBody) console.warn("Faltando #listaLembretesBody no HTML");

    // =========================================================
    // 2) STORAGE (corrigidos / snooze)
    // =========================================================
    const LS_KEY_RESOLVED = "alerts_resolved_docs_v2"; // { [docKey]: true }
    const LS_KEY_SNOOZE_UNTIL = "alerts_snooze_until_v2"; // timestamp ms

    function loadResolvedMap() {
      try {
        const raw = localStorage.getItem(LS_KEY_RESOLVED);
        const obj = raw ? JSON.parse(raw) : {};
        return obj && typeof obj === "object" ? obj : {};
      } catch {
        return {};
      }
    }

    function saveResolvedMap(map) {
      try {
        localStorage.setItem(LS_KEY_RESOLVED, JSON.stringify(map || {}));
      } catch {}
    }

    function getSnoozeUntil() {
      const raw = localStorage.getItem(LS_KEY_SNOOZE_UNTIL);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    }

    function setSnooze(msFromNow) {
      try {
        localStorage.setItem(LS_KEY_SNOOZE_UNTIL, String(Date.now() + msFromNow));
      } catch {}
    }

    function clearSnooze() {
      try {
        localStorage.removeItem(LS_KEY_SNOOZE_UNTIL);
      } catch {}
    }

    // =========================================================
    // 3) HELPERS UI (corrige aria-hidden + foco)
    // =========================================================
    function safeAddClass(el, cls) {
      if (el && el.classList) el.classList.add(cls);
    }
    function safeRemoveClass(el, cls) {
      if (el && el.classList) el.classList.remove(cls);
    }
    function lockBodyScroll(lock) {
      if (lock) document.body.classList.add("modal-open");
      else document.body.classList.remove("modal-open");
    }

    const lastFocusByModal = new WeakMap();

    function openModal(modal) {
      if (!modal) return;

      lastFocusByModal.set(modal, document.activeElement);

      // Se algum fallback colocou display:none inline, isso ajuda:
      if (modal.style && modal.style.display === "none") modal.style.display = "";

      safeAddClass(modal, "open");
      lockBodyScroll(true);

      modal.setAttribute("aria-hidden", "false");
      try {
        if ("inert" in modal) modal.inert = false;
      } catch {}

      // foco no botão de fechar
      setTimeout(() => {
        const focusTarget =
          modal.querySelector("#btnCloseLembretes") ||
          modal.querySelector("#btnFecharCadastro") ||
          modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');

        if (focusTarget && typeof focusTarget.focus === "function") {
          focusTarget.focus();
        }
      }, 0);
    }

    function closeModal(modal) {
      if (!modal) return;

      // evita warning do aria-hidden com foco dentro
      if (modal.contains(document.activeElement)) {
        try {
          document.activeElement.blur();
        } catch {}
      }

      try {
        if ("inert" in modal) modal.inert = true;
      } catch {}

      safeRemoveClass(modal, "open");
      modal.setAttribute("aria-hidden", "true");

      const anyOpen = document.querySelector(".modal-overlay.open, .alarm-overlay.open");
      if (!anyOpen) lockBodyScroll(false);

      const last = lastFocusByModal.get(modal);
      if (last && typeof last.focus === "function") last.focus();
      else if (btnAlerts && typeof btnAlerts.focus === "function") btnAlerts.focus();
    }

    function closeAll() {
      closeModal(modalLembretes);
      closeModal(modalCadastro);
      closeModal(popupAlarme);
    }

    function setNotifDotVisible(visible) {
      if (!notifDot) return;
      notifDot.style.display = visible ? "" : "none";
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });

    // =========================================================
    // 4) ABRIR / FECHAR MODAIS
    // =========================================================
    // ✅ evita duplicar listeners se o loader executar esse arquivo mais de 1 vez
    function bindOnce(el, key, handler) {
      if (!el) return;
      if (el.dataset && el.dataset[key] === "1") return;
      if (el.dataset) el.dataset[key] = "1";
      el.addEventListener("click", handler);
    }

    if (btnAlerts && modalLembretes) {
      bindOnce(btnAlerts, "alertsBound", async (e) => {
        e.preventDefault();
        openModal(modalLembretes);

        // Recarrega sempre que abrir
        try {
          await carregarDocsImportantes();
        } catch (err) {
          console.error("Erro ao recarregar ao abrir modal:", err);
        }
      });
    }

    if (btnCloseLembretesTop && modalLembretes) {
      bindOnce(btnCloseLembretesTop, "closeBound", () => closeModal(modalLembretes));
    }
    if (btnCloseLembretesBottom && modalLembretes) {
      bindOnce(btnCloseLembretesBottom, "closeBound", () => closeModal(modalLembretes));
    }
    if (modalLembretes) {
      if (modalLembretes.dataset.backdropBound !== "1") {
        modalLembretes.dataset.backdropBound = "1";
        modalLembretes.addEventListener("click", (e) => {
          if (e.target === modalLembretes) closeModal(modalLembretes);
        });
      }
    }

    if (btnNovoLembrete) {
      bindOnce(btnNovoLembrete, "novoBound", () => {
        closeModal(modalLembretes);
        if (modalCadastro) setTimeout(() => openModal(modalCadastro), 200);
      });
    }

    // Modal cadastro (opcional)
    if (btnCloseCadastroTop && modalCadastro) {
      bindOnce(btnCloseCadastroTop, "closeCadBound", () => closeModal(modalCadastro));
    }
    if (btnCancelarCadastro && modalCadastro) {
      bindOnce(btnCancelarCadastro, "cancelCadBound", () => {
        closeModal(modalCadastro);
        if (modalLembretes) setTimeout(() => openModal(modalLembretes), 200);
      });
    }
    if (btnSalvarCadastro && modalCadastro) {
      bindOnce(btnSalvarCadastro, "saveCadBound", () => {
        const original = btnSalvarCadastro.innerHTML;
        btnSalvarCadastro.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        btnSalvarCadastro.disabled = true;

        setTimeout(() => {
          closeModal(modalCadastro);
          if (modalLembretes) openModal(modalLembretes);

          btnSalvarCadastro.innerHTML = original;
          btnSalvarCadastro.disabled = false;
          console.log("Cadastro salvo (simulação) ✅");
        }, 800);
      });
    }
    if (modalCadastro) {
      if (modalCadastro.dataset.backdropBound !== "1") {
        modalCadastro.dataset.backdropBound = "1";
        modalCadastro.addEventListener("click", (e) => {
          if (e.target === modalCadastro) closeModal(modalCadastro);
        });
      }
    }

    // =========================================================
    // 5) HELPERS DE TEXTO / DATA
    // =========================================================
    function escapeHtml(str) {
      return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function parseISODate(iso) {
      const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return null;
      const yyyy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
      const d = new Date(yyyy, mm - 1, dd);
      d.setHours(0, 0, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    function getToday() {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      return t;
    }

    function isDueToday(tr) {
      const dt = parseISODate(tr?.dataset?.validade);
      if (!dt) return false;
      return dt.getTime() === getToday().getTime();
    }

    function isDueTomorrow(tr) {
      const dt = parseISODate(tr?.dataset?.validade);
      if (!dt) return false;
      const tom = getToday();
      tom.setDate(tom.getDate() + 1);
      return dt.getTime() === tom.getTime();
    }

    function formatBRFromISO(iso) {
      const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return "";
      return `${m[3]}/${m[2]}/${m[1]}`;
    }

    function getInitials(nome) {
      return String(nome || "")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("");
    }

    // =========================================================
    // 6) CHAVE / STATUS / RESOLVIDO
    // =========================================================
    function buildDocKey(tr) {
      if (tr && tr.dataset && tr.dataset.key) return String(tr.dataset.key);
      const nome = (tr.dataset.emp || "").trim() || "Funcionario";
      const doc = (tr.dataset.doc || "").trim() || "Documento";
      const validade = (tr.dataset.validade || "").trim() || "";
      return `${nome}__${doc}__${validade}`.toLowerCase();
    }

    function isActive(tr) {
      return tr.dataset.ativo === "1" || !!tr.querySelector(".rem-status.active");
    }

    function isResolved(tr, resolvedMap) {
      if (tr.dataset.resolvido === "1") return true;
      const resolveBtn = tr.querySelector(".rem-resolve-toggle");
      if (resolveBtn && resolveBtn.classList.contains("active")) return true;
      const key = buildDocKey(tr);
      return !!resolvedMap[key];
    }

    function getRowDisplayInfo(tr) {
      return {
        funcionarioId: Number(tr.dataset.empId || 0),
        nome: tr.dataset.emp || "Funcionário",
        doc: tr.dataset.doc || "",
        validadeISO: tr.dataset.validade || "",
        validadeText: tr.dataset.validade ? formatBRFromISO(tr.dataset.validade) : "",
      };
    }

    // =========================================================
    // 7) RENDER VIA API (GET)
    // =========================================================
    function renderLoadingRow() {
      if (!listaLembretesBody) return;
      listaLembretesBody.innerHTML = `
        <tr class="js-loading-row">
          <td colspan="5" style="opacity:.8">Carregando lembretes...</td>
        </tr>
      `;
    }

    function renderEmptyRow() {
      if (!listaLembretesBody) return;
      listaLembretesBody.innerHTML = `
        <tr>
          <td colspan="5" style="opacity:.85">Nenhum lembrete para HOJE ou AMANHÃ.</td>
        </tr>
      `;
    }

    async function carregarDocsImportantes() {
      if (!listaLembretesBody) return;

      renderLoadingRow();

      const resp = await fetch(ALERTS_API_URL, {
        headers: { Accept: "application/json" },
        credentials: "include",
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.log("Erro API:", resp.status, (txt || "").slice(0, 200));
        throw new Error("Falha ao buscar lembretes: " + resp.status);
      }

      const data = await resp.json();

      const items = (Array.isArray(data) ? data : []).map((d) => ({
        documentoId: d?.documentoId ?? d?.DocumentoId ?? 0,
        funcionarioId: d?.funcionarioId ?? d?.FuncionarioId ?? 0,
        funcionarioNome: d?.funcionarioNome ?? d?.FuncionarioNome ?? "",
        documentoNome: d?.documentoNome ?? d?.DocumentoNome ?? "",
        tipo: d?.tipo ?? d?.Tipo ?? "",
        dataEmissao: d?.dataEmissao ?? d?.DataEmissao ?? "",
        dataValidade: d?.dataValidade ?? d?.DataValidade ?? "",
        ativo: d?.ativo ?? d?.Ativo ?? false,
      }));

      if (!items.length) {
        renderEmptyRow();
        verificarVencimentos({ silent: true });
        return;
      }

      listaLembretesBody.innerHTML = items
        .map((d) => {
          const emissaoBR = d.dataEmissao ? formatBRFromISO(d.dataEmissao) : "";
          const validadeBR = d.dataValidade ? formatBRFromISO(d.dataValidade) : "";
          const nome = d.funcionarioNome || "Funcionário";
          const doc = d.documentoNome || d.tipo || "";

          return `
            <tr
              data-key="doc_${d.documentoId}"
              data-emp-id="${Number(d.funcionarioId) || 0}"
              data-emp="${escapeHtml(nome)}"
              data-doc="${escapeHtml(doc)}"
              data-emissao="${d.dataEmissao || ""}"
              data-validade="${d.dataValidade || ""}"
              data-ativo="${d.ativo ? "1" : "0"}"
              data-resolvido="0"
            >
              <td>
                <div class="rem-user">
                  <div class="rem-avatar-small no-photo">${escapeHtml(getInitials(nome))}</div>
                  <span>${escapeHtml(nome)}<br>
                    <small style="color:#64748b; font-size:11px;">${escapeHtml(doc)}</small>
                  </span>
                </div>
              </td>

              <td>${escapeHtml(emissaoBR)}</td>
              <td class="js-validade-cell">${escapeHtml(validadeBR)}</td>

              <td class="text-center">
                <button class="rem-status ${d.ativo ? "active" : "inactive"}" type="button" title="${d.ativo ? "Ativo" : "Inativo"}">
                  ${d.ativo ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>'}
                </button>
              </td>

              <td class="text-center">
                <button class="toggle-check inactive rem-resolve-toggle" type="button" title="Marcar como corrigido">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </td>
            </tr>
          `;
        })
        .join("");

      refreshLembretesUI();
    }

    // =========================================================
    // 8) TOGGLES (ATIVO / CORRIGIDO)
    // =========================================================
    function setIconForStatus(el, active) {
      if (!el) return;
      if (el.classList.contains("toggle-check")) {
        el.innerHTML = active ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
      } else {
        el.innerHTML = active
          ? '<i class="fa-solid fa-circle-check"></i>'
          : '<i class="fa-solid fa-circle-xmark"></i>';
      }
    }

    function toggleActiveInactive(el) {
      const isActiveNow = el.classList.contains("active");
      if (isActiveNow) {
        el.classList.remove("active");
        el.classList.add("inactive");
        setIconForStatus(el, false);
      } else {
        el.classList.remove("inactive");
        el.classList.add("active");
        setIconForStatus(el, true);
      }
    }

    function attachToggleHandlers(root) {
      const scope = root || document;

      const statusToggles = scope.querySelectorAll(".rem-status");
      statusToggles.forEach((el) => {
        if (el.dataset.bound === "1") return;
        el.dataset.bound = "1";

        el.addEventListener("click", () => {
          toggleActiveInactive(el);
          const tr = el.closest("tr");
          if (tr) tr.dataset.ativo = el.classList.contains("active") ? "1" : "0";
          verificarVencimentos({ silent: true });
        });
      });

      const resolveToggles = scope.querySelectorAll(".rem-resolve-toggle");
      resolveToggles.forEach((el) => {
        if (el.dataset.bound === "1") return;
        el.dataset.bound = "1";

        el.addEventListener("click", () => {
          const tr = el.closest("tr");
          if (!tr) return;

          const resolvedMap = loadResolvedMap();
          const key = buildDocKey(tr);
          const willResolve = !el.classList.contains("active");

          if (willResolve) {
            el.classList.remove("inactive");
            el.classList.add("active");
            setIconForStatus(el, true);
            resolvedMap[key] = true;
            saveResolvedMap(resolvedMap);
            tr.dataset.resolvido = "1";
          } else {
            el.classList.remove("active");
            el.classList.add("inactive");
            setIconForStatus(el, false);
            delete resolvedMap[key];
            saveResolvedMap(resolvedMap);
            tr.dataset.resolvido = "0";
          }

          verificarVencimentos({ silent: true });
        });
      });
    }

    // =========================================================
    // 9) POPUP
    // =========================================================
    function renderAlarmList(items) {
      if (!alarmList) return;
      alarmList.innerHTML = "";

      if (!items.length) {
        alarmList.innerHTML =
          '<div class="alarm-item"><i class="fa-solid fa-circle-exclamation"></i><span>Nenhum vencimento encontrado.</span></div>';
        return;
      }

      const frag = document.createDocumentFragment();
      items.forEach((it) => {
        const div = document.createElement("div");
        div.className = "alarm-item";
        div.innerHTML = `
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>${escapeHtml(it.nome)}${it.doc ? " - " + escapeHtml(it.doc) : ""}${it.validadeText ? " (" + escapeHtml(it.validadeText) + ")" : ""}</span>
        `;
        frag.appendChild(div);
      });

      alarmList.appendChild(frag);
    }

    function abrirFuncionarioPorId(funcionarioId) {
      if (!funcionarioId) return;

      if (typeof window.abrirFuncionarioPorId === "function") {
        window.abrirFuncionarioPorId(funcionarioId);
        return;
      }
      if (typeof window.openFuncionarioModal === "function") {
        window.openFuncionarioModal(funcionarioId);
        return;
      }

      document.dispatchEvent(new CustomEvent("alerts:openFuncionario", { detail: { funcionarioId } }));
    }

    function verificarVencimentos(opts) {
      const silent = !!(opts && opts.silent);
      if (!listaLembretesBody) return;

      const snoozeUntil = getSnoozeUntil();
      const inSnooze = snoozeUntil && Date.now() < snoozeUntil;

      const rows = Array.from(listaLembretesBody.querySelectorAll("tr"));
      const resolvedMap = loadResolvedMap();

      const dueTodayActiveNotResolved = [];

      rows.forEach((tr) => {
        if (tr.classList.contains("js-loading-row")) return;

        const dueToday = isDueToday(tr);
        const dueTomorrow = isDueTomorrow(tr);

        tr.style.display = dueToday || dueTomorrow ? "" : "none";

        const validadeCell = tr.querySelector(".js-validade-cell") || tr.querySelectorAll("td")[2];
        if (validadeCell) validadeCell.classList.toggle("text-danger", dueToday);

        const active = isActive(tr);
        const resolved = isResolved(tr, resolvedMap);

        if (dueToday && active && !resolved) {
          dueTodayActiveNotResolved.push(getRowDisplayInfo(tr));
        }
      });

      setNotifDotVisible(dueTodayActiveNotResolved.length > 0);

      if (!popupAlarme) return;

      if (dueTodayActiveNotResolved.length > 0) {
        renderAlarmList(dueTodayActiveNotResolved);

        if (btnResolve) {
          btnResolve.dataset.empId = String(dueTodayActiveNotResolved[0].funcionarioId || "");
        }

        if (!silent) console.log("Vence HOJE:", dueTodayActiveNotResolved);

        if (!inSnooze) openModal(popupAlarme);
      } else {
        if (btnResolve) btnResolve.dataset.empId = "";
        closeModal(popupAlarme);
        clearSnooze();
      }
    }

    // =========================================================
    // 10) BOTÕES POPUP
    // =========================================================
    const ONE_HOUR = 60 * 60 * 1000;

    if (btnSnooze && popupAlarme) {
      bindOnce(btnSnooze, "snoozeBound", () => {
        closeModal(popupAlarme);
        setSnooze(ONE_HOUR);
      });
    }

    if (btnResolve && popupAlarme) {
      bindOnce(btnResolve, "resolveBound", () => {
        closeModal(popupAlarme);

        const empId = Number(btnResolve.dataset.empId || 0);
        if (empId) {
          abrirFuncionarioPorId(empId);
          return;
        }

        if (modalLembretes) openModal(modalLembretes);
      });
    }

    if (popupAlarme) {
      if (popupAlarme.dataset.backdropBound !== "1") {
        popupAlarme.dataset.backdropBound = "1";
        popupAlarme.addEventListener("click", (e) => {
          if (e.target === popupAlarme) closeModal(popupAlarme);
        });
      }
    }

    // =========================================================
    // 11) API PÚBLICA
    // =========================================================
    function refreshLembretesUI() {
      attachToggleHandlers(modalLembretes || document);
      verificarVencimentos({ silent: true });
    }

    window.refreshLembretesUI = refreshLembretesUI;
    window.reloadLembretesFromAPI = async function () {
      await carregarDocsImportantes();
    };

    // =========================================================
    // 12) BOOT
    // =========================================================
    attachToggleHandlers(document);

    try {
      await carregarDocsImportantes();
    } catch (err) {
      console.error("Erro ao carregar docs importantes do GET:", err);
    }

    verificarVencimentos({ silent: true });

    setInterval(() => verificarVencimentos({ silent: true }), ONE_HOUR);

    console.log("ALERTS prontos ✅");
  }
})();
