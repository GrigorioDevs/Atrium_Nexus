// Assets/JS/incluir-ponto-ui.js
(() => {
  "use strict";

  /* ===================== Helpers ===================== */

  const $ = (id) => document.getElementById(id);

  const safeNotify = (msg, type = "info") => {
    try {
      if (typeof window.notify === "function") return window.notify(msg, type);
      if (typeof window.showToast === "function") return window.showToast(msg, type);
    } catch {}
    // fallback bem simples
    if (type === "error") console.error(msg);
    else console.log(msg);
    alert(msg);
  };

  const two = (n) => String(n).padStart(2, "0");
  const todayYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  };
  const nowHHMM = () => {
    const d = new Date();
    return `${two(d.getHours())}:${two(d.getMinutes())}`;
  };

  // remove tudo que não é dígito
  const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

  // Storage keys (front-only)
  const LS_PUNCHES = "PONTO_PUNCHES_V1";
  const LS_AJUSTES = "PONTO_AJUSTES_V1";
  const LS_JUSTS = "PONTO_JUSTIFICATIVAS_V1";
  const LS_LAST_LATLNG = "PONTO_LAST_LATLNG_V1";

  const readLS = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  };
  const writeLS = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const uid = (prefix = "id") =>
    `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  /* ===================== Refs do seu HTML ===================== */

  // header chips
  const lblAgora = $("lblAgora");
  const lblCoord = $("lblCoord");

  // map
  const mapEl = $("map");
  const mapSkeleton = mapEl ? mapEl.querySelector(".map-skeleton") : null;

  // botões
  const btnBaterPonto = $("btnBaterPonto");
  const btnAjustarPonto = $("btnAjustarPonto");
  const btnJustificarAusencia = $("btnJustificarAusencia");

  // modal ajuste
  const modalAjustarPonto = $("modalAjustarPonto");
  const btnFecharAjustarPonto = $("btnFecharAjustarPonto");
  const btnCancelarAjustePonto = $("btnCancelarAjustePonto");
  const btnEnviarAjustePonto = $("btnEnviarAjustePonto");

  const ajData = $("ajData");
  const ajE1 = $("ajE1");
  const ajS1 = $("ajS1");
  const ajE2 = $("ajE2");
  const ajS2 = $("ajS2");
  const ajE3 = $("ajE3");
  const ajS3 = $("ajS3");
  const ajObs = $("ajObs");

  // modal justificativa
  const modalJustificarAusencia = $("modalJustificarAusencia");
  const btnFecharJustificarAusencia = $("btnFecharJustificarAusencia");
  const btnCancelarJustificativa = $("btnCancelarJustificativa");
  const btnEnviarJustificativa = $("btnEnviarJustificativa");

  const jusTipo = $("jusTipo");
  const jusData = $("jusData");
  const jusDataFim = $("jusDataFim");
  const jusPeriodoWrap = $("jusPeriodoWrap");
  const jusPeriodo = $("jusPeriodo");
  const jusMotivo = $("jusMotivo");
  const jusObs = $("jusObs");

  // Se a aba nem existe, não roda
  if (!mapEl || !btnBaterPonto || !btnAjustarPonto || !btnJustificarAusencia) {
    return;
  }

  /* ===================== Relógio (lblAgora) ===================== */

  function tickAgora() {
    if (!lblAgora) return;
    try {
      lblAgora.textContent = new Date().toLocaleString("pt-BR");
    } catch {
      const d = new Date();
      lblAgora.textContent =
        `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ` +
        `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
    }
  }
  tickAgora();
  setInterval(tickAgora, 1000);

  /* ===================== Geo + Mapa (Leaflet opcional) ===================== */

  let _leafletMap = null;
  let _leafletMarker = null;

  function setCoordLabel(latlng) {
    if (!lblCoord) return;
    if (!latlng || latlng.length !== 2) {
      lblCoord.textContent = "--";
      return;
    }
    lblCoord.textContent = `${Number(latlng[0]).toFixed(5)}, ${Number(latlng[1]).toFixed(5)}`;
  }

  function removeSkeleton() {
    try {
      mapSkeleton?.remove();
    } catch {}
  }

  function initLeafletMap(fallbackLatLng) {
    if (!window.L || !mapEl) return;

    if (_leafletMap) return; // já iniciado

    try {
      _leafletMap = window.L.map(mapEl, { zoomControl: true, preferCanvas: true });

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      })
        .addTo(_leafletMap)
        .on("load", () => removeSkeleton());

      _leafletMap.setView(fallbackLatLng, 16);
      _leafletMarker = window.L.marker(fallbackLatLng).addTo(_leafletMap);
    } catch (e) {
      console.warn("Falha ao iniciar Leaflet:", e);
    }
  }

  function updateLeafletMarker(latlng, zoom = 17) {
    if (!_leafletMap || !window.L) return;
    try {
      if (!_leafletMarker) _leafletMarker = window.L.marker(latlng).addTo(_leafletMap);
      else _leafletMarker.setLatLng(latlng);
      _leafletMap.setView(latlng, zoom);
    } catch {}
  }

  function loadLastLatLng() {
    const v = readLS(LS_LAST_LATLNG, null);
    if (!v || !Array.isArray(v) || v.length !== 2) return null;
    const lat = Number(v[0]);
    const lng = Number(v[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }

  function saveLastLatLng(latlng) {
    writeLS(LS_LAST_LATLNG, latlng);
  }

  function startGeo() {
    const fallback = loadLastLatLng() || [-23.5619, -46.6564]; // SP fallback
    setCoordLabel(loadLastLatLng() || null); // se tiver, já mostra

    // inicia Leaflet se existir
    initLeafletMap(fallback);

    const GEO_OPTS = { enableHighAccuracy: false, maximumAge: 180000, timeout: 7000 };

    if (!("geolocation" in navigator)) {
      removeSkeleton();
      setCoordLabel(loadLastLatLng() || fallback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        saveLastLatLng(latlng);
        setCoordLabel(latlng);
        updateLeafletMarker(latlng, 17);
        removeSkeleton();
      },
      () => {
        // erro -> usa fallback
        setCoordLabel(loadLastLatLng() || fallback);
        updateLeafletMarker(loadLastLatLng() || fallback, 13);
        removeSkeleton();
      },
      GEO_OPTS
    );
  }

  // inicia já (se o tab estiver oculto, Leaflet pode precisar de invalidateSize depois)
  startGeo();

  // se Leaflet existir e você alterna tabs, isso ajuda quando o mapa aparece depois
  document.addEventListener("click", () => {
    if (_leafletMap) {
      try {
        _leafletMap.invalidateSize();
      } catch {}
    }
  });

  /* ===================== Pontos (fallback localStorage) ===================== */

  function getAllPunchesCompat() {
    try {
      if (typeof window.getAllPunches === "function") {
        const arr = window.getAllPunches();
        return Array.isArray(arr) ? arr : [];
      }
    } catch {}
    const arr = readLS(LS_PUNCHES, []);
    return Array.isArray(arr) ? arr : [];
  }

  function setAllPunchesCompat(arr) {
    try {
      if (typeof window.setAllPunches === "function") {
        window.setAllPunches(arr);
        return true;
      }
    } catch {}
    return writeLS(LS_PUNCHES, Array.isArray(arr) ? arr : []);
  }

  function punchesByDate(ymd) {
    return getAllPunchesCompat()
      .filter((b) => b && b.date === ymd)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }

  function nextTypeFor(ymd) {
    const list = punchesByDate(ymd);
    if (list.length === 0) return "Entrada";
    return list[list.length - 1].type === "Entrada" ? "Saída" : "Entrada";
  }

  function addPunchNow() {
    const ymd = todayYMD();
    const next = nextTypeFor(ymd);
    const list = punchesByDate(ymd);
    const eCount = list.filter((b) => b.type === "Entrada").length;
    const sCount = list.filter((b) => b.type === "Saída").length;

    if (next === "Entrada" && eCount >= 3) return safeNotify("Limite atingido: 3 entradas.", "error");
    if (next === "Saída" && sCount >= 3) return safeNotify("Limite atingido: 3 saídas.", "error");

    const lastLatLng = loadLastLatLng();
    const lat = lastLatLng ? Number(lastLatLng[0]).toFixed(5) : "--";
    const lon = lastLatLng ? Number(lastLatLng[1]).toFixed(5) : "--";

    const all = getAllPunchesCompat();
    all.push({
      date: ymd,
      time: nowHHMM(),
      type: next,
      origin: "Web",
      note: `GPS ${lat},${lon}`
    });

    if (!setAllPunchesCompat(all)) return safeNotify("Não foi possível salvar o ponto (armazenamento cheio).", "error");

    safeNotify(`Ponto registrado: ${next} ${nowHHMM()}`, "success");

    // se existir renderização global do cartão
    try {
      if (typeof window.renderPonto === "function") window.renderPonto();
    } catch {}
    // se existir modal do dia no seu sistema
    try {
      if (typeof window.openBatimentosDia === "function") window.openBatimentosDia(ymd);
    } catch {}
  }

  btnBaterPonto.addEventListener("click", addPunchNow);

  /* ===================== Modais (abrir/fechar) ===================== */

  function showModal(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = "flex";
    document.body.classList.add("modal-open");
  }

  function hideModal(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = "none";
    document.body.classList.remove("modal-open");
  }

  function bindBackdropClose(modalEl) {
    if (!modalEl) return;
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) hideModal(modalEl);
    });
  }

  bindBackdropClose(modalAjustarPonto);
  bindBackdropClose(modalJustificarAusencia);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modalAjustarPonto && modalAjustarPonto.style.display === "flex") hideModal(modalAjustarPonto);
    if (modalJustificarAusencia && modalJustificarAusencia.style.display === "flex")
      hideModal(modalJustificarAusencia);
  });

  /* ===================== Ajustar Ponto ===================== */

  function openAjustarPonto() {
    if (ajData && !ajData.value) ajData.value = todayYMD();
    showModal(modalAjustarPonto);
  }

  function closeAjustarPonto() {
    hideModal(modalAjustarPonto);
  }

  btnAjustarPonto.addEventListener("click", openAjustarPonto);
  btnFecharAjustarPonto?.addEventListener("click", closeAjustarPonto);
  btnCancelarAjustePonto?.addEventListener("click", closeAjustarPonto);

  // valida horário HH:MM
  function validTimeOrEmpty(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    if (!/^\d{2}:\d{2}$/.test(s)) return "";
    const [h, m] = s.split(":").map((x) => Number(x));
    if (h < 0 || h > 23 || m < 0 || m > 59) return "";
    return s;
  }

  function collectAjustePayload() {
    const date = (ajData?.value || "").trim();
    if (!date) {
      safeNotify("Informe a data do ajuste.", "warn");
      return null;
    }

    const payload = {
      id: uid("aj"),
      createdAt: new Date().toISOString(),
      date,
      entrada1: validTimeOrEmpty(ajE1?.value),
      saida1: validTimeOrEmpty(ajS1?.value),
      entrada2: validTimeOrEmpty(ajE2?.value),
      saida2: validTimeOrEmpty(ajS2?.value),
      entrada3: validTimeOrEmpty(ajE3?.value),
      saida3: validTimeOrEmpty(ajS3?.value),
      obs: (ajObs?.value || "").trim(),
      status: "Pendente"
    };

    const anyTime =
      payload.entrada1 ||
      payload.saida1 ||
      payload.entrada2 ||
      payload.saida2 ||
      payload.entrada3 ||
      payload.saida3;

    if (!anyTime) {
      safeNotify("Preencha pelo menos um horário (Entrada/Saída).", "warn");
      return null;
    }

    return payload;
  }

  function clearAjusteForm() {
    [ajE1, ajS1, ajE2, ajS2, ajE3, ajS3, ajObs].forEach((el) => {
      if (el) el.value = "";
    });
    // mantém ajData por conveniência
  }

  async function submitAjustePonto() {
    const payload = collectAjustePayload();
    if (!payload) return;

    // Se existir um endpoint/função global no futuro, plugável:
    // window.apiCreateAjustePonto(payload)
    try {
      if (typeof window.apiCreateAjustePonto === "function") {
        await window.apiCreateAjustePonto(payload);
        safeNotify("Ajuste enviado com sucesso.", "success");
        clearAjusteForm();
        closeAjustarPonto();
        return;
      }
    } catch (e) {
      console.error(e);
      safeNotify("Falha ao enviar ajuste via API. Salvando localmente.", "warn");
    }

    const list = readLS(LS_AJUSTES, []);
    const arr = Array.isArray(list) ? list : [];
    arr.unshift(payload);

    if (!writeLS(LS_AJUSTES, arr)) {
      safeNotify("Não foi possível salvar o ajuste (armazenamento cheio).", "error");
      return;
    }

    safeNotify("Ajuste registrado (mock/local).", "success");
    clearAjusteForm();
    closeAjustarPonto();
  }

  btnEnviarAjustePonto?.addEventListener("click", submitAjustePonto);

  /* ===================== Justificar Ausência ===================== */

  function syncJustTipoUI() {
    const tipo = (jusTipo?.value || "dia").toLowerCase();
    if (!jusPeriodoWrap) return;
    jusPeriodoWrap.style.display = tipo === "periodo" ? "" : "none";
    if (tipo !== "periodo" && jusDataFim) jusDataFim.value = "";
  }

  function openJustificar() {
    if (jusData && !jusData.value) jusData.value = todayYMD();
    syncJustTipoUI();
    showModal(modalJustificarAusencia);
  }

  function closeJustificar() {
    hideModal(modalJustificarAusencia);
  }

  btnJustificarAusencia.addEventListener("click", openJustificar);
  btnFecharJustificarAusencia?.addEventListener("click", closeJustificar);
  btnCancelarJustificativa?.addEventListener("click", closeJustificar);
  jusTipo?.addEventListener("change", syncJustTipoUI);

  function collectJustificativaPayload() {
    const tipo = (jusTipo?.value || "dia").toLowerCase();
    const dataIni = (jusData?.value || "").trim();
    const dataFim = (jusDataFim?.value || "").trim();
    const periodo = (jusPeriodo?.value || "").trim();
    const motivo = (jusMotivo?.value || "").trim();
    const obs = (jusObs?.value || "").trim();

    if (!dataIni) {
      safeNotify("Informe a data da ausência.", "warn");
      return null;
    }

    if (tipo === "periodo") {
      if (!dataFim) {
        safeNotify("Informe a data final do período.", "warn");
        return null;
      }
      if (dataFim < dataIni) {
        safeNotify("Data final não pode ser menor que a inicial.", "warn");
        return null;
      }
    }

    if (!motivo) {
      safeNotify("Selecione um motivo.", "warn");
      return null;
    }

    return {
      id: uid("jus"),
      createdAt: new Date().toISOString(),
      tipo, // dia | periodo
      dataIni,
      dataFim: tipo === "periodo" ? dataFim : "",
      periodo: periodo || "dia_inteiro",
      motivo,
      obs,
      status: "Pendente"
    };
  }

  function clearJustificativaForm() {
    // mantém tipo por conveniência
    if (jusData) jusData.value = "";
    if (jusDataFim) jusDataFim.value = "";
    if (jusPeriodo) jusPeriodo.value = "dia_inteiro";
    if (jusMotivo) jusMotivo.value = "";
    if (jusObs) jusObs.value = "";
    syncJustTipoUI();
  }

  async function submitJustificativa() {
    const payload = collectJustificativaPayload();
    if (!payload) return;

    // Se existir uma função global futura:
    // window.apiCreateJustificativa(payload)
    try {
      if (typeof window.apiCreateJustificativa === "function") {
        await window.apiCreateJustificativa(payload);
        safeNotify("Justificativa enviada com sucesso.", "success");
        clearJustificativaForm();
        closeJustificar();
        return;
      }
    } catch (e) {
      console.error(e);
      safeNotify("Falha ao enviar justificativa via API. Salvando localmente.", "warn");
    }

    const list = readLS(LS_JUSTS, []);
    const arr = Array.isArray(list) ? list : [];
    arr.unshift(payload);

    if (!writeLS(LS_JUSTS, arr)) {
      safeNotify("Não foi possível salvar a justificativa (armazenamento cheio).", "error");
      return;
    }

    safeNotify("Justificativa registrada (mock/local).", "success");
    clearJustificativaForm();
    closeJustificar();
  }

  btnEnviarJustificativa?.addEventListener("click", submitJustificativa);

  /* ===================== Defaults ===================== */

  // deixa UI coerente ao carregar
  syncJustTipoUI();

  // se quiser: pré-preencher data do ajuste sempre com hoje ao abrir
  if (ajData && !ajData.value) ajData.value = todayYMD();
})();
