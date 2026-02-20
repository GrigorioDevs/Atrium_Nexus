/* ===================== FUNCIONÁRIOS — EXPLORER =====================
   Responsável por:
   - Listar pastas/arquivos
   - Criar pasta
   - Renomear
   - Excluir
   - Upload de arquivos
   - Copiar/Colar (move via endpoint /copy)
   - Download
   Integra com funcionarios.js via:
     window.FuncionariosExplorer.open({ funcionarioId, viewerRole })
     window.FuncionariosExplorer.close()
====================================================================== */
(() => {
  'use strict';

  // ✅ IMPORTANTE: usa o MESMO host da página (resolve 127 vs localhost nos cookies)
  const API_HOST = String(window.API_HOST || window.location.hostname || 'localhost');
  const API_BASE = String(window.API_BASE || `http://${API_HOST}:5253`).replace(/\/+$/, '');

  const $ = (id) => document.getElementById(id);

  const escapeHTML = (s) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const notify =
    window.notify && typeof window.notify === 'function'
      ? window.notify
      : (msg, type) => {
          try { console[type === 'error' ? 'error' : 'log'](msg); } catch {}
          alert(msg);
        };

  const two = (n) => String(n).padStart(2, '0');

  function bytesHuman(bytes) {
    let b = Number(bytes || 0);
    if (!b) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
    const dec = i === 0 ? 0 : (b < 10 ? 1 : 0);
    return `${b.toFixed(dec)} ${units[i]}`;
  }

  // ✅ resolve URL de download vinda do back:
  function resolveApiUrl(u) {
    const url = String(u || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return API_BASE + url;
    return API_BASE + '/' + url;
  }

  // Regra de permissão por role
  function canSeeOwnerRole(ownerRole, viewerRole) {
    const o = Number(ownerRole || 0);
    const v = Number(viewerRole || 0);
    if (v === 1) return true;                 // Admin vê tudo
    if (v === 2) return o === 2 || o === 3;   // Gestão vê Gestão + Segurança
    if (v === 3) return o === 3;              // Segurança vê só Segurança
    return true;
  }

  // ✅ fetch com cookie (Cookie Auth HttpOnly)
  async function apiFetch(path, opt = {}) {
    opt.credentials ??= "include";          // <<< TEM que ser antes do fetch
    const url = API_BASE + path;
    const res = await fetch(url, opt);

    let data = null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    try {
      if (ct.includes('application/json')) data = await res.json();
      else {
        const t = await res.text();
        data = t ? JSON.parse(t) : null;
      }
    } catch { /* ignore */ }

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || `Erro na API (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  // ===================== API Explorer =====================

  async function apiExplorerList(empId) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer`, { method: 'GET' });
  }

  async function apiExplorerCreateFolder(empId, parentId, name, viewerRole) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: parentId ?? null, name, ownerRole: viewerRole }),
    });
  }

  async function apiExplorerRename(empId, itemId, newName) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/items/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
  }

  async function apiExplorerDelete(empId, itemId) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    });
  }

  async function apiExplorerUploadFiles(empId, parentId, files, viewerRole) {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    if (parentId) fd.append('parentId', parentId);
    fd.append('ownerRole', String(viewerRole));
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/files`, {
      method: 'POST',
      body: fd,
    });
  }

  async function apiExplorerCopy(empId, srcItemId, targetParentId, viewerRole) {
    return await apiFetch(`/api/funcionarios/${encodeURIComponent(empId)}/explorer/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcItemId,
        targetParentId: targetParentId ?? null,
        ownerRole: viewerRole,
      }),
    });
  }

  // ===================== State =====================

  const STATE = {
    currentEmpId: null,
    viewerRole: 2,
    explorerItems: [],
    currentFolderId: null,
    selection: null,
    copyBuffer: null,
    bound: false,
  };

  function dom() {
    return {
      feTree: $('feTree'),
      feList: $('feList'),
      fePath: $('fePath'),
      feUpload: $('feUpload'),
      feBtnNewFolder: $('feBtnNewFolder'),
      feBtnRename: $('feBtnRename'),
      feBtnDelete: $('feBtnDelete'),
      feBtnCopy: $('feBtnCopy'),
      feBtnPaste: $('feBtnPaste'),
      feBtnDownload: $('feBtnDownload'),
    };
  }

  function canSeeItem(it) {
    return canSeeOwnerRole(it?.ownerRole, STATE.viewerRole);
  }

  function feRefresh() {
    const { feTree, feList, fePath } = dom();
    if (!feTree || !feList || !fePath || !STATE.currentEmpId) return;

    const list = Array.isArray(STATE.explorerItems) ? STATE.explorerItems : [];

    if (STATE.currentFolderId) {
      const stillExists = list.some((it) => it.type === 'folder' && it.id === STATE.currentFolderId);
      if (!stillExists) STATE.currentFolderId = null;
    }

    feRenderPath(fePath, list);
    feRenderTree(feTree, list);
    feRenderList(feList, list);
  }

  function feRenderPath(fePath, list) {
    const crumbs = [];
    let folderId = STATE.currentFolderId;

    while (folderId) {
      const f = list.find((it) => it.id === folderId && it.type === 'folder');
      if (!f) break;
      crumbs.unshift({ id: f.id, name: f.name || 'Pasta' });
      folderId = f.parentId ?? null;
    }

    let html = `<span class="fe-bc${STATE.currentFolderId ? '' : ' current'}" data-id="">Documentos</span>`;
    if (crumbs.length) {
      html =
        `<span class="fe-bc" data-id="">Documentos</span>` +
        crumbs
          .map((c, idx) => {
            const last = idx === crumbs.length - 1;
            return `<span class="fe-bc${last ? ' current' : ''}" data-id="${c.id}">${escapeHTML(c.name)}</span>`;
          })
          .join(' ');
    }
    fePath.innerHTML = html;
  }

  function feRenderTree(feTree, list) {
    function renderFolder(parentId) {
      const children = list
        .filter((it) => it.type === 'folder' && (it.parentId ?? null) === parentId)
        .filter(canSeeItem)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

      if (!children.length) return '';

      return `<ul class="fe-tree-list">
        ${children
          .map(
            (f) => `
          <li>
            <div class="fe-tree-folder ${STATE.currentFolderId === f.id ? 'active' : ''}" data-id="${f.id}">
              <span class="fe-icon"><i class="fa-regular fa-folder"></i></span>
              <span class="fe-label">${escapeHTML(f.name || 'Pasta')}</span>
            </div>
            ${renderFolder(f.id)}
          </li>`
          )
          .join('')}
      </ul>`;
    }

    const rootActive = STATE.currentFolderId == null;
    feTree.innerHTML = `
      <div class="fe-tree-root">
        <div class="fe-tree-folder ${rootActive ? 'active' : ''}" data-id="">
          <span class="fe-icon"><i class="fa-regular fa-folder-open"></i></span>
          <span class="fe-label">Documentos</span>
        </div>
        ${renderFolder(null)}
      </div>`;
  }

  function feRenderList(feList, list) {
    const tbody = feList.querySelector('tbody');
    if (!tbody) return;

    const parentId = STATE.currentFolderId ?? null;

    const folders = list
      .filter((it) => it.type === 'folder' && (it.parentId ?? null) === parentId)
      .filter(canSeeItem)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

    const files = list
      .filter((it) => it.type !== 'folder' && (it.parentId ?? null) === parentId)
      .filter(canSeeItem)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

    if (!folders.length && !files.length) {
      tbody.innerHTML = `<tr class="fe-empty"><td colspan="4">Pasta vazia</td></tr>`;
      return;
    }

    const rows = [];

    folders.forEach((f) => {
      const when = f.uploadedAt ? new Date(f.uploadedAt) : null;
      const whenLabel = when
        ? `${two(when.getDate())}/${two(when.getMonth() + 1)}/${when.getFullYear()} ${two(when.getHours())}:${two(when.getMinutes())}`
        : '—';

      rows.push(`
        <tr data-type="folder" data-id="${f.id}">
          <td><span class="fe-icon"><i class="fa-regular fa-folder"></i></span> ${escapeHTML(f.name || 'Pasta')}</td>
          <td>Pasta</td>
          <td>${bytesHuman(f.size || 0)}</td>
          <td>${whenLabel}</td>
        </tr>`);
    });

    files.forEach((file) => {
      const when = file.uploadedAt ? new Date(file.uploadedAt) : null;
      const whenLabel = when
        ? `${two(when.getDate())}/${two(when.getMonth() + 1)}/${when.getFullYear()} ${two(when.getHours())}:${two(when.getMinutes())}`
        : '—';

      rows.push(`
        <tr data-type="file" data-id="${file.id}">
          <td><span class="fe-icon"><i class="fa-regular fa-file-lines"></i></span> ${escapeHTML(file.name || '(sem nome)')}</td>
          <td>Arquivo</td>
          <td>${bytesHuman(file.size || 0)}</td>
          <td>${whenLabel}</td>
        </tr>`);
    });

    tbody.innerHTML = rows.join('');

    if (STATE.selection) {
      const row = tbody.querySelector(`tr[data-type="${STATE.selection.type}"][data-id="${STATE.selection.id}"]`);
      if (row) row.classList.add('selected');
      else STATE.selection = null;
    }
  }

  async function reloadList() {
    if (!STATE.currentEmpId) return;
    const allItems = await apiExplorerList(STATE.currentEmpId);
    STATE.explorerItems = Array.isArray(allItems) ? allItems : (allItems?.items || []);
  }

  function bindOnce() {
    if (STATE.bound) return;
    STATE.bound = true;

    const { feTree, feList, fePath, feUpload, feBtnNewFolder, feBtnRename, feBtnDelete, feBtnCopy, feBtnPaste, feBtnDownload } = dom();

    const uploadForm = feUpload?.closest('form');
    if (uploadForm) {
      uploadForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      });
    }
    if (feUpload) feUpload.onchange = null;

    fePath?.addEventListener('click', (e) => {
      const el = e.target.closest('.fe-bc');
      if (!el) return;
      const id = el.dataset.id || '';
      STATE.currentFolderId = id || null;
      STATE.selection = null;
      feRefresh();
    });

    feTree?.addEventListener('click', (e) => {
      const node = e.target.closest('.fe-tree-folder');
      if (!node) return;
      const id = node.dataset.id || '';
      STATE.currentFolderId = id || null;
      STATE.selection = null;
      feRefresh();
    });

    feList?.addEventListener('click', (e) => {
      const row = e.target.closest('tbody tr[data-id]');
      if (!row) return;
      const tbody = feList.querySelector('tbody');
      if (!tbody) return;

      tbody.querySelectorAll('tr.selected').forEach((tr) => tr.classList.remove('selected'));
      row.classList.add('selected');
      STATE.selection = { type: row.dataset.type, id: row.dataset.id };
    });

    feList?.addEventListener('dblclick', (e) => {
      const row = e.target.closest('tbody tr[data-id]');
      if (!row) return;

      const type = row.dataset.type;
      const id = row.dataset.id;

      if (type === 'folder') {
        STATE.currentFolderId = id;
        STATE.selection = null;
        feRefresh();
        return;
      }

      if (type === 'file') {
        const file = (STATE.explorerItems || []).find((it) => it.id === id && it.type !== 'folder');
        if (!file) return;

        const full = resolveApiUrl((file.downloadUrl || '').trim());
        if (full) window.open(full, '_blank', 'noopener');
        else notify('Arquivo sem downloadUrl retornado pelo back.', 'warn');
      }
    });

    if (feUpload) {
      feUpload.setAttribute('multiple', '');
      feUpload.removeAttribute('accept');
    }

    feUpload?.addEventListener(
      'change',
      async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (!STATE.currentEmpId) return notify('Abra um funcionário primeiro.', 'warn');
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        try {
          await apiExplorerUploadFiles(STATE.currentEmpId, STATE.currentFolderId, files, STATE.viewerRole);
          await reloadList();
          feUpload.value = '';
          feRefresh();
        } catch (err) {
          console.error(err);
          notify(err.message || 'Falha ao enviar arquivos para o explorer.', 'error');
        }
      },
      { capture: true }
    );

    feBtnNewFolder?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return notify('Abra um funcionário primeiro.', 'warn');

      let name = prompt('Nome da nova pasta:', 'Nova pasta');
      if (!name) return;
      name = name.trim();
      if (!name) return;

      try {
        await apiExplorerCreateFolder(STATE.currentEmpId, STATE.currentFolderId, name, STATE.viewerRole);
        await reloadList();
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao criar pasta.', 'error');
      }
    });

    feBtnRename?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.selection) return notify('Selecione uma pasta ou arquivo para renomear.', 'warn');

      const item = (STATE.explorerItems || []).find((it) => it.id === STATE.selection.id);
      if (!item) return;

      if (!canSeeItem(item)) return notify('Você não tem permissão para ver/alterar este item.', 'warn');

      const newName = prompt('Novo nome:', item.name || '');
      if (!newName) return;

      try {
        await apiExplorerRename(STATE.currentEmpId, item.id, newName.trim());
        await reloadList();
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao renomear.', 'error');
      }
    });

    feBtnDelete?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.selection) return notify('Selecione uma pasta ou arquivo para excluir.', 'warn');

      const item = (STATE.explorerItems || []).find((it) => it.id === STATE.selection.id);
      if (!item) return;

      if (!canSeeItem(item)) return notify('Você não tem permissão para excluir este item.', 'warn');

      const isFolder = STATE.selection.type === 'folder';
      if (!confirm(isFolder ? 'Excluir esta pasta e todo o conteúdo?' : `Excluir o arquivo "${item.name}"?`)) return;

      try {
        await apiExplorerDelete(STATE.currentEmpId, item.id);
        await reloadList();
        STATE.selection = null;
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao excluir.', 'error');
      }
    });

    feBtnCopy?.addEventListener('click', () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.selection) return notify('Selecione uma pasta ou arquivo para copiar.', 'warn');

      const item = (STATE.explorerItems || []).find((it) => it.id === STATE.selection.id);
      if (!item) return;
      if (!canSeeItem(item)) return notify('Você não tem permissão para copiar este item.', 'warn');

      STATE.copyBuffer = { id: item.id };
      notify('Copiado. Vá até a pasta de destino e clique em "Colar".', 'info');
    });

    feBtnPaste?.addEventListener('click', async () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.copyBuffer) return notify('Nada para colar. Use o botão Copiar primeiro.', 'warn');

      try {
        await apiExplorerCopy(STATE.currentEmpId, STATE.copyBuffer.id, STATE.currentFolderId, STATE.viewerRole);
        await reloadList();
        feRefresh();
      } catch (err) {
        console.error(err);
        notify(err.message || 'Falha ao colar.', 'error');
      }
    });

    feBtnDownload?.addEventListener('click', () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.selection) return notify('Selecione um arquivo ou pasta para baixar.', 'warn');

      const item = (STATE.explorerItems || []).find((it) => it.id === STATE.selection.id);
      if (!item) return notify('Item não encontrado.', 'error');

      if (!canSeeItem(item)) return notify('Você não tem permissão para baixar este item.', 'warn');

      const full = resolveApiUrl((item.downloadUrl || '').trim());
      if (full) window.open(full, '_blank', 'noopener');
      else notify('Sem downloadUrl retornado pelo back.', 'warn');
    });
  }

  async function open({ funcionarioId, viewerRole }) {
    bindOnce();

    STATE.currentEmpId = Number(funcionarioId);
    STATE.viewerRole = Number(viewerRole || 2);

    STATE.currentFolderId = null;
    STATE.selection = null;
    STATE.copyBuffer = null;

    try {
      await reloadList();
    } catch (err) {
      console.warn(err);
      STATE.explorerItems = [];
    }

    feRefresh();
  }

  function close() {
    STATE.currentEmpId = null;
    STATE.explorerItems = [];
    STATE.currentFolderId = null;
    STATE.selection = null;
    STATE.copyBuffer = null;

    const { feTree, feList, fePath } = dom();
    if (feTree) feTree.innerHTML = '';
    if (fePath) fePath.innerHTML = '';
    if (feList) {
      const tbody = feList.querySelector('tbody');
      if (tbody) tbody.innerHTML = '';
    }
  }

  window.FuncionariosExplorer = { open, close };

  // ===================== MODAL PANES (Documentos / Importantes / Cursos) =====================
  function setActiveModalPane(paneId, clickedBtn) {
    const modal = document.getElementById('modalFuncionario');
    if (!modal) return;

    modal.querySelectorAll('.emp-pane').forEach((p) => {
      p.classList.toggle('active', p.id === paneId);
    });

    const tabs = modal.querySelector('.emp-tabs');
    if (tabs) {
      tabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      if (clickedBtn) clickedBtn.classList.add('active');
    }
  }

  // ===================== Abas do Modal =====================
  document.addEventListener(
    'click',
    (e) => {
      const modal = e.target.closest('#modalFuncionario');
      if (!modal) return;

      const impBtn = e.target.closest('[data-impdocs-open="1"]');
      if (impBtn) {
        e.preventDefault();
        e.stopPropagation();
        setActiveModalPane('paneDocsImportantes', impBtn);
        return;
      }

      const tabBtn = e.target.closest('.emp-tab-btn[data-target]');
      if (tabBtn) {
        e.preventDefault();
        const target = String(tabBtn.getAttribute('data-target') || '').trim();
        if (!target.startsWith('#')) return;
        setActiveModalPane(target.slice(1), tabBtn);
      }
    },
    true
  );

  /* =========================================================
     DOCUMENTOS IMPORTANTES (docs + tipos)
     - Cookie Auth HttpOnly (credentials include)
     ========================================================= */
  (function () {
    "use strict";

    // =========================================================
    // 1) TIPOS (CRUD)
    // =========================================================
    const MODAL_TIPO_ID = "modalTipoDocumento";

    const TipoState = {
      cache: [],
      editingId: null,
      lastLoadedAt: 0,
    };

    // API Tipos
    async function apiTiposList() {
      return await apiFetch(`/api/documentos-importantes/tipos`, { method: "GET" });
    }

    async function apiTiposCreate(nome) {
      return await apiFetch(`/api/documentos-importantes/tipos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
    }

    async function apiTiposRename(id, nome) {
      return await apiFetch(`/api/documentos-importantes/tipos/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
    }

    async function apiTiposDelete(id) {
      return await apiFetch(`/api/documentos-importantes/tipos/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    }

    function openModalTipoDoc() {
      const m = $(MODAL_TIPO_ID);
      if (!m) return;
      m.style.display = "block";
      m.classList.add("open");
      setTimeout(() => $("tipoDocNome")?.focus(), 50);
    }

    function closeModalTipoDoc() {
      const m = $(MODAL_TIPO_ID);
      if (!m) return;
      m.classList.remove("open");
      m.style.display = "none";
      TipoState.editingId = null;
    }

    function renderTiposNoModal() {
      const tbody = $("tipoDocTableBody");
      if (!tbody) return;

      const tipos = Array.isArray(TipoState.cache) ? TipoState.cache : [];

      if (!tipos.length) {
        tbody.innerHTML = `<tr><td colspan="2">Nenhum tipo cadastrado.</td></tr>`;
        return;
      }

      tbody.innerHTML = tipos
        .map((t) => {
          const isEditing = TipoState.editingId === t.id;
          const nomeSafe = escapeHTML(t.nome || "");

          const nomeCell = isEditing
            ? `<input type="text" class="tipo-doc-edit-input" data-edit-id="${t.id}" value="${nomeSafe}" />`
            : `<span>${nomeSafe}</span>`;

          const actions = isEditing
            ? `
              <button type="button" class="btn btn-ok btn-sm" data-tipo-action="save" data-id="${t.id}" title="Salvar">
                <i class="fa-regular fa-floppy-disk"></i>
              </button>
              <button type="button" class="btn btn-light btn-sm" data-tipo-action="cancel" data-id="${t.id}" title="Cancelar">
                <i class="fa-solid fa-xmark"></i>
              </button>
            `
            : `
              <button type="button" class="btn btn-light btn-sm" data-tipo-action="edit" data-id="${t.id}" title="Renomear">
                <i class="fa-regular fa-pen-to-square"></i>
              </button>
              <button type="button" class="btn btn-warn btn-sm" data-tipo-action="delete" data-id="${t.id}" title="Inativar">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            `;

          return `
            <tr data-id="${t.id}">
              <td>${nomeCell}</td>
              <td style="white-space:nowrap;">${actions}</td>
            </tr>
          `;
        })
        .join("");
    }

    // ✅ SELECT guarda o NOME (porque no banco é varchar)
    function syncSelectTipos() {
      const sel = $("impDocType");
      if (!sel) return;

      const keep = sel.value; // nome selecionado
      sel.innerHTML = `<option value="">Selecione...</option>`;

      (TipoState.cache || []).forEach((t) => {
        const opt = document.createElement("option");
        opt.value = String(t.nome || "");
        opt.textContent = t.nome || "";
        opt.dataset.tipoId = String(t.id);
        sel.appendChild(opt);
      });

      if (keep) sel.value = keep;
    }

    async function loadTipos(force = false) {
      const now = Date.now();

      if (!force && TipoState.lastLoadedAt && now - TipoState.lastLoadedAt < 60_000 && TipoState.cache.length) {
        syncSelectTipos();
        return;
      }

      const list = await apiTiposList();
      const tipos = Array.isArray(list) ? list : list?.items || [];

      TipoState.cache = tipos.map((x) => ({ id: x.id, nome: x.nome }));
      TipoState.lastLoadedAt = now;

      syncSelectTipos();
      renderTiposNoModal();
    }

    // Abrir modal no lápis
    document.addEventListener(
      "click",
      async (e) => {
        const btn = e.target.closest("#btnOpenTipoDocModal");
        if (!btn) return;
        if (!e.target.closest("#modalFuncionario")) return;

        e.preventDefault();
        e.stopPropagation();

        openModalTipoDoc();
        try {
          await loadTipos(true);
        } catch (err) {
          console.error(err);
          notify(err.message || "Falha ao carregar tipos.", "error");
        }
      },
      true
    );

    // Fechar modal: X e Cancelar
    document.addEventListener(
      "click",
      (e) => {
        if (e.target.closest("#btnFecharTipoDoc") || e.target.closest("#btnCancelarTipoDoc")) {
          e.preventDefault();
          e.stopPropagation();
          closeModalTipoDoc();
        }
      },
      true
    );

    // Fechar clicando no overlay
    document.addEventListener(
      "click",
      (e) => {
        const modal = $(MODAL_TIPO_ID);
        if (!modal) return;
        if (e.target === modal) closeModalTipoDoc();
      },
      true
    );

    // ESC fecha
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const m = $(MODAL_TIPO_ID);
      if (!m) return;
      if (m.classList.contains("open") || m.style.display === "block") closeModalTipoDoc();
    });

    // Criar tipo
    document.addEventListener(
      "click",
      async (e) => {
        if (!e.target.closest("#btnSalvarTipoDoc")) return;

        const modal = $(MODAL_TIPO_ID);
        if (!modal || modal.style.display === "none") return;

        e.preventDefault();
        e.stopPropagation();

        const nome = ($("tipoDocNome")?.value || "").trim();
        if (!nome) {
          notify("Digite o nome do tipo.", "warn");
          $("tipoDocNome")?.focus();
          return;
        }

        try {
          await apiTiposCreate(nome);
          await loadTipos(true);

          // seleciona no select principal pelo NOME
          const sel = $("impDocType");
          if (sel) sel.value = nome;

          if ($("tipoDocNome")) $("tipoDocNome").value = "";
          notify(`Tipo "${nome}" cadastrado.`, "info");
        } catch (err) {
          console.error(err);
          notify(err.message || "Falha ao cadastrar tipo.", "error");
        }
      },
      true
    );

    // Ações na tabela (edit/save/cancel/delete)
    document.addEventListener(
      "click",
      async (e) => {
        const btn = e.target.closest("[data-tipo-action]");
        if (!btn) return;

        const action = btn.getAttribute("data-tipo-action");
        const id = Number(btn.getAttribute("data-id") || 0);
        if (!id) return;

        e.preventDefault();
        e.stopPropagation();

        if (action === "edit") {
          TipoState.editingId = id;
          renderTiposNoModal();
          setTimeout(() => {
            document.querySelector(`.tipo-doc-edit-input[data-edit-id="${id}"]`)?.focus();
          }, 30);
          return;
        }

        if (action === "cancel") {
          TipoState.editingId = null;
          renderTiposNoModal();
          return;
        }

        // ✅ SAVE (estava faltando no seu arquivo)
        if (action === "save") {
          const input = document.querySelector(`.tipo-doc-edit-input[data-edit-id="${id}"]`);
          const novoNome = String(input?.value || "").trim();
          if (!novoNome) {
            notify("Digite o nome do tipo.", "warn");
            input?.focus();
            return;
          }

          try {
            await apiTiposRename(id, novoNome);
            TipoState.editingId = null;
            await loadTipos(true);
            notify("Tipo atualizado.", "info");
          } catch (err) {
            console.error(err);
            notify(err.message || "Falha ao atualizar tipo.", "error");
          }
          return;
        }

        if (action === "delete") {
          const old = (TipoState.cache || []).find(t => t.id === id);
          if (!confirm("Inativar este tipo? Ele vai sumir do select.")) return;

          try {
            await apiTiposDelete(id);
            TipoState.editingId = null;
            await loadTipos(true);

            // se estava selecionado, limpa (comparando por NOME)
            const sel = $("impDocType");
            if (sel && old?.nome && sel.value === old.nome) sel.value = "";

            notify("Tipo inativado.", "info");
          } catch (err) {
            console.error(err);
            notify(err.message || "Falha ao inativar tipo.", "error");
          }
        }
      },
      true
    );

    // =========================================================
    // 2) DOCUMENTOS IMPORTANTES (upload/list/delete/download)
    // =========================================================
    const DocState = {
      funcionarioId: 0,
      cache: [],
    };

    async function apiDocsList(funcId) {
      return await apiFetch(`/api/funcionarios/${encodeURIComponent(funcId)}/documentos-importantes`, {
        method: "GET",
      });
    }

    async function apiDocsUpload(funcId, formData) {
      return await apiFetch(`/api/funcionarios/${encodeURIComponent(funcId)}/documentos-importantes`, {
        method: "POST",
        body: formData,
      });
    }

    async function apiDocsDelete(funcId, docId) {
      return await apiFetch(
        `/api/funcionarios/${encodeURIComponent(funcId)}/documentos-importantes/${encodeURIComponent(docId)}`,
        { method: "DELETE" }
      );
    }

    function formatDateBR(v) {
      if (!v) return "—";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    }

    function renderDocs() {
      const tbody = $("impDocsTable");
      if (!tbody) return;

      const docs = Array.isArray(DocState.cache) ? DocState.cache : [];
      if (!docs.length) {
        tbody.innerHTML = `<tr><td colspan="5">—</td></tr>`;
        return;
      }

      tbody.innerHTML = docs
        .map((d) => {
          const id = d.id;
          const nome = escapeHTML(d.nome || "");
          const tipo = escapeHTML(d.tipo || "");
          const em = formatDateBR(d.dataEmissao);
          const val = formatDateBR(d.dataValidade);

          return `
            <tr data-id="${id}">
              <td>${nome}</td>
              <td>${tipo}</td>
              <td>${em}</td>
              <td>${val}</td>
              <td style="white-space:nowrap;">
                <button type="button" class="btn btn-light btn-sm" data-impdoc-action="download" data-id="${id}" title="Baixar">
                  <i class="fa-solid fa-download"></i>
                </button>
                <button type="button" class="btn btn-warn btn-sm" data-impdoc-action="delete" data-id="${id}" title="Excluir">
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    async function loadDocs(funcId) {
      const list = await apiDocsList(funcId);
      const docs = Array.isArray(list) ? list : list?.items || [];
      DocState.cache = docs;
      renderDocs();
    }

    // Abrir a pane “Documentos importantes”
    document.addEventListener(
      "click",
      async (e) => {
        const impBtn = e.target.closest('[data-impdocs-open="1"]');
        if (!impBtn) return;

        const modal = e.target.closest("#modalFuncionario");
        if (!modal) return;

        e.preventDefault();
        e.stopPropagation();

        // ✅ usa o ID REAL que você abriu no modal (evita 123 fixo)
        const funcId = Number(STATE.currentEmpId || impBtn.getAttribute("data-emp-id") || 0);
        if (!funcId) {
          notify('Não achei o funcionarioId do modal. Garanta que você chama FuncionariosExplorer.open({ funcionarioId }) ao abrir o card.', "warn");
          return;
        }

        DocState.funcionarioId = funcId;
        setActiveModalPane("paneDocsImportantes", impBtn);

        try {
          await loadTipos(false);
          await loadDocs(funcId);
        } catch (err) {
          console.error(err);
          notify(err.message || "Falha ao carregar documentos importantes.", "error");
        }
      },
      true
    );

    // Adicionar documento importante
    document.addEventListener(
      "click",
      async (e) => {
        if (!e.target.closest("#btnAddImpDoc")) return;

        const pane = e.target.closest("#paneDocsImportantes");
        if (!pane) return;

        e.preventDefault();
        e.stopPropagation();

        const funcId = DocState.funcionarioId || Number(STATE.currentEmpId || 0);
        if (!funcId) {
          notify('Abra um funcionário e clique na aba "Documentos importantes" primeiro.', "warn");
          return;
        }

        const file = $("impDocFile")?.files?.[0] || null;
        const nome = ($("impDocName")?.value || "").trim();
        const tipo = ($("impDocType")?.value || "").trim(); // ✅ agora é NOME (string)
        const dataEmissao = ($("impDocIssue")?.value || "").trim();
        const dataValidade = ($("impDocDue")?.value || "").trim();

        if (!file) return notify("Selecione um arquivo.", "warn");
        if (!nome) return notify("Informe o nome do documento.", "warn");
        if (!tipo) return notify("Selecione o tipo.", "warn");

        const fd = new FormData();
        // ✅ nomes do C# UploadForm: File, Nome, Tipo, DataEmissao, DataValidade
        fd.append("file", file);
        fd.append("nome", nome);
        fd.append("tipo", tipo);
        if (dataEmissao) fd.append("dataEmissao", dataEmissao);
        if (dataValidade) fd.append("dataValidade", dataValidade);

        try {
          await apiDocsUpload(funcId, fd);

          if ($("impDocFile")) $("impDocFile").value = "";
          if ($("impDocName")) $("impDocName").value = "";
          if ($("impDocIssue")) $("impDocIssue").value = "";
          if ($("impDocDue")) $("impDocDue").value = "";

          await loadDocs(funcId);
          notify("Documento importante adicionado.", "info");
        } catch (err) {
          console.error(err);
          notify(err.message || "Falha ao adicionar documento.", "error");
        }
      },
      true
    );

    // Ações (download / delete)
    document.addEventListener(
      "click",
      async (e) => {
        const btn = e.target.closest("[data-impdoc-action]");
        if (!btn) return;

        const action = btn.getAttribute("data-impdoc-action");
        const docId = Number(btn.getAttribute("data-id") || 0);
        if (!docId) return;

        const funcId = DocState.funcionarioId || Number(STATE.currentEmpId || 0);
        if (!funcId) return;

        e.preventDefault();
        e.stopPropagation();

        if (action === "download") {
          const url = `${API_BASE}/api/funcionarios/${encodeURIComponent(funcId)}/documentos-importantes/${encodeURIComponent(docId)}/download`;
          window.open(url, "_blank", "noopener");
          return;
        }

        if (action === "delete") {
          if (!confirm("Excluir este documento importante?")) return;

          try {
            await apiDocsDelete(funcId, docId);
            await loadDocs(funcId);
            notify("Documento removido.", "info");
          } catch (err) {
            console.error(err);
            notify(err.message || "Falha ao excluir documento.", "error");
          }
        }
      },
      true
    );
  })();

})();
