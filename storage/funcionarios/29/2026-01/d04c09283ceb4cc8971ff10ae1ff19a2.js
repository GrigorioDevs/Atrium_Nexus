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

  const API_BASE = String(window.API_BASE || 'http://localhost:5253').replace(/\/+$/, '');

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

  // Regra de permissão por role (mesma lógica que você já tinha no arquivo antigo)
  function canSeeOwnerRole(ownerRole, viewerRole) {
    const o = Number(ownerRole || 0);
    const v = Number(viewerRole || 0);
    if (v === 1) return true;                 // Admin vê tudo
    if (v === 2) return o === 2 || o === 3;   // Gestão vê Gestão + Segurança
    if (v === 3) return o === 3;              // Segurança vê só Segurança
    return true;
  }

  async function apiFetch(path, opt = {}) {
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

    // valida pasta atual
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
        `<span class="fe-bc" data-id="">Documentos</span> / ` +
        crumbs
          .map((c, idx) => {
            const last = idx === crumbs.length - 1;
            return `<span class="fe-bc${last ? ' current' : ''}" data-id="${c.id}">${escapeHTML(c.name)}</span>`;
          })
          .join(' / ');
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

    // Pastas (AGORA com tamanho e data se o back enviar)
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

    // Arquivos
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

    // Breadcrumb
    fePath?.addEventListener('click', (e) => {
      const el = e.target.closest('.fe-bc');
      if (!el) return;
      const id = el.dataset.id || '';
      STATE.currentFolderId = id || null;
      STATE.selection = null;
      feRefresh();
    });

    // Clique na árvore
    feTree?.addEventListener('click', (e) => {
      const node = e.target.closest('.fe-tree-folder');
      if (!node) return;
      const id = node.dataset.id || '';
      STATE.currentFolderId = id || null;
      STATE.selection = null;
      feRefresh();
    });

    // Seleção na lista
    feList?.addEventListener('click', (e) => {
      const row = e.target.closest('tbody tr[data-id]');
      if (!row) return;
      const tbody = feList.querySelector('tbody');
      if (!tbody) return;

      tbody.querySelectorAll('tr.selected').forEach((tr) => tr.classList.remove('selected'));
      row.classList.add('selected');
      STATE.selection = { type: row.dataset.type, id: row.dataset.id };
    });

    // Duplo clique: abrir pasta / baixar arquivo
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

        const downloadUrl = (file.downloadUrl || '').trim();
        if (downloadUrl) window.open(downloadUrl, '_blank', 'noopener');
        else notify('Arquivo sem downloadUrl retornado pelo back.', 'warn');
      }
    });

    // Upload
    if (feUpload) {
      feUpload.setAttribute('multiple', '');
      feUpload.removeAttribute('accept');
    }

    feUpload?.addEventListener('change', async (e) => {
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
    });

    // Nova pasta
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

    // Renomear
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

    // Excluir
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

    // Copiar
    feBtnCopy?.addEventListener('click', () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.selection) return notify('Selecione uma pasta ou arquivo para copiar.', 'warn');

      const item = (STATE.explorerItems || []).find((it) => it.id === STATE.selection.id);
      if (!item) return;
      if (!canSeeItem(item)) return notify('Você não tem permissão para copiar este item.', 'warn');

      STATE.copyBuffer = { id: item.id };
      notify('Copiado. Vá até a pasta de destino e clique em "Colar".', 'info');
    });

    // Colar (move)
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

    // Download
    feBtnDownload?.addEventListener('click', () => {
      if (!STATE.currentEmpId) return;
      if (!STATE.selection) return notify('Selecione um arquivo ou pasta para baixar.', 'warn');

      const item = (STATE.explorerItems || []).find((it) => it.id === STATE.selection.id);
      if (!item) return notify('Item não encontrado.', 'error');

      if (!canSeeItem(item)) return notify('Você não tem permissão para baixar este item.', 'warn');

      const downloadUrl = (item.downloadUrl || '').trim();
      if (downloadUrl) window.open(downloadUrl, '_blank', 'noopener');
      else notify('Sem downloadUrl retornado pelo back.', 'warn');
    });
  }

  async function open({ funcionarioId, viewerRole }) {
    // captura os elementos (se ainda não existirem, não quebra)
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

    // opcional: limpar UI
    const { feTree, feList, fePath } = dom();
    if (feTree) feTree.innerHTML = '';
    if (fePath) fePath.innerHTML = '';
    if (feList) {
      const tbody = feList.querySelector('tbody');
      if (tbody) tbody.innerHTML = '';
    }
  }

  window.FuncionariosExplorer = { open, close };
})();