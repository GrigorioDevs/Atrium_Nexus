// ===================== Sub-abas de Documentos + Integração Clicksign (com backend) =====================
(() => {
  'use strict';

  /* -------------------- Helpers -------------------- */
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function fmtPhoneBR(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function pick(obj, keys, fallback = '') {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return fallback;
  }

  async function apiFetch(url, opts = {}) {
    const resp = await fetch(url, {
      credentials: 'same-origin',
      ...opts,
      headers: {
        Accept: 'application/json',
        ...(opts.headers || {})
      }
    });

    const ct = resp.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');

    if (!resp.ok) {
      let extra = '';
      try {
        extra = isJson ? JSON.stringify(await resp.json()) : await resp.text();
      } catch {}
      const err = new Error(`HTTP ${resp.status} — ${url}${extra ? ` — ${extra}` : ''}`);
      err.status = resp.status;
      throw err;
    }

    return isJson ? resp.json() : resp;
  }

  async function apiPostJSON(url, body) {
    return apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {})
    });
  }

  function toast(msg, type = 'info') {
    if (typeof window.showToast === 'function') return window.showToast(msg, type);
    if (typeof window.notify === 'function') return window.notify(msg, type);
    console[(type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log')](msg);
  }

  /* -------------------- Sub-abas (Gerar / Assinar) -------------------- */
  (function initDocsSubTabs() {
    const docsTabButtons = document.querySelectorAll('.docs-tab-btn');
    const docsPanes = document.querySelectorAll('.docs-pane');

    if (!docsTabButtons.length || !docsPanes.length) return;

    docsTabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetSel = btn.dataset.target;
        if (!targetSel) return;

        docsTabButtons.forEach((b) => b.classList.remove('active'));
        docsPanes.forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const pane = document.querySelector(targetSel);
        if (pane) pane.classList.add('active');
      });
    });
  })();

  /* -------------------- Clicksign -------------------- */

  // >>> AJUSTE AQUI AS ROTAS DO SEU BACKEND <<<
  const API = {
    listDocs: '/api/documentos/gerados',
    docById: (id) => `/api/documentos/${encodeURIComponent(id)}`,

    listFuncs: '/api/funcionarios',

    send: '/api/clicksign/send',
    status: (documentKey) => `/api/clicksign/status/${encodeURIComponent(documentKey)}`,
    download: (documentKey) => `/api/clicksign/download/${encodeURIComponent(documentKey)}`,

    existing: (docId, funcId) =>
      `/api/clicksign/existing?documentoId=${encodeURIComponent(docId)}&funcionarioId=${encodeURIComponent(funcId)}`
  };

  const el = {
    selDoc: $('csDocSelect'),
    selFunc: $('csFuncSelect'),

    signerName: $('csSignerName'),
    signerEmail: $('csSignerEmail'),
    signerPhone: $('csSignerPhone'),

    sendChannel: $('csSendChannel'),
    authMethod: $('csAuthMethod'),
    msg: $('csMsg'),

    envelopeKey: $('csEnvelopeKey'),
    docKey: $('csDocKey'),

    btnEnviar: $('btnCsEnviar'),
    btnBaixar: $('btnCsBaixar'),
    btnConsultar: $('btnCsConsultar'),
    btnLimpar: $('btnCsLimparVinculo'),

    status: $('csStatus')
  };

  if (!el.selDoc || !el.btnEnviar || !el.status) return;

  const state = {
    docs: [],
    funcs: [],
    selectedDoc: null,
    selectedFunc: null,
    lastSignUrl: null
  };

  /* -------- Segment (WhatsApp / Gmail / SMS) -> mantém select escondido -------- */
  (function bindSendChannelSegment() {
    const buttons = document.querySelectorAll('.cs-seg-btn');
    if (!buttons.length || !el.sendChannel) return;

    function setActive(channel) {
      buttons.forEach(b => {
        const is = b.getAttribute('data-channel') === channel;
        b.classList.toggle('active', is);
        b.setAttribute('aria-pressed', is ? 'true' : 'false');
      });
      el.sendChannel.value = channel;
      el.sendChannel.dispatchEvent(new Event('change'));
    }

    // inicializa com o valor atual do select (ou whatsapp)
    setActive(el.sendChannel.value || 'whatsapp');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const channel = btn.getAttribute('data-channel');
        setActive(channel);
      });
    });
  })();

  function setStatus(msg, tipo = 'info', extraHtml = '') {
    if (!el.status) return;

    // classes antigas (se você usa em outro css)
    el.status.classList.remove('error', 'success', 'info', 'warn');

    // classes novas
    el.status.classList.remove('cs-status--error', 'cs-status--success', 'cs-status--info', 'cs-status--warn');

    // aplica novas (e mantém compat)
    const map = {
      error: ['error', 'cs-status--error'],
      success: ['success', 'cs-status--success'],
      warn: ['warn', 'cs-status--warn'],
      info: ['info', 'cs-status--info']
    };
    (map[tipo] || map.info).forEach(c => el.status.classList.add(c));

    const base = `<div>${escapeHtml(msg)}</div>`;
    const extra = extraHtml ? `<div style="margin-top:8px">${extraHtml}</div>` : '';
    el.status.innerHTML = base + extra;
  }

  function setBusy(busy) {
    if (el.btnEnviar) el.btnEnviar.disabled = !!busy;
    if (el.btnBaixar) el.btnBaixar.disabled = !!busy;
    if (el.btnConsultar) el.btnConsultar.disabled = !!busy;
    if (el.selDoc) el.selDoc.disabled = !!busy;
    if (el.selFunc) el.selFunc.disabled = !!busy;
  }

  function fillSignerFromFunc(func) {
    const nome = pick(func, ['nome', 'name', 'descricao'], '');
    const email = pick(func, ['email', 'mail', 'emailCorporativo'], '');
    const celular = pick(func, ['celular', 'telefone', 'phone', 'whatsapp'], '');

    if (el.signerName) el.signerName.value = nome || '';
    if (el.signerEmail) el.signerEmail.value = email || '';
    if (el.signerPhone) el.signerPhone.value = fmtPhoneBR(celular);

    if (el.signerName) el.signerName.readOnly = !!nome;
    if (el.signerEmail) el.signerEmail.readOnly = !!email;
    if (el.signerPhone) el.signerPhone.readOnly = !!celular;
  }

  function resetKeysAndStatus(keepStatus = false) {
    if (el.docKey) el.docKey.value = '';
    if (el.envelopeKey) el.envelopeKey.value = '';
    state.lastSignUrl = null;
    if (!keepStatus) setStatus('Nenhuma ação realizada ainda.', 'info');
  }

  function populateDocsSelect() {
    if (!el.selDoc) return;
    el.selDoc.innerHTML = `<option value="">Selecione um documento…</option>`;
    state.docs.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.nome || d.title || `Documento #${d.id}`;
      el.selDoc.appendChild(opt);
    });
  }

  function populateFuncSelect() {
    if (!el.selFunc) return;
    el.selFunc.innerHTML = `<option value="">Selecione um funcionário…</option>`;
    state.funcs.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id || f.codigo || f.cpf || '';
      opt.textContent = f.nome || f.name || f.descricao || 'Funcionário';
      el.selFunc.appendChild(opt);
    });
  }

  async function loadDocs() {
    try {
      const list = await apiFetch(API.listDocs);
      if (Array.isArray(list)) return list;
      if (Array.isArray(list?.items)) return list.items;
    } catch (e) {
      console.warn('Falha listDocs, tentando fallback front:', e);
    }

    if (typeof window.getDocumentosGerados === 'function') {
      try {
        const r = window.getDocumentosGerados();
        if (Array.isArray(r)) return r;
      } catch {}
    }
    return [];
  }

  async function loadFuncs() {
    try {
      const list = await apiFetch(API.listFuncs);
      if (Array.isArray(list)) return list;
      if (Array.isArray(list?.items)) return list.items;
    } catch (e) {
      console.warn('Falha listFuncs, tentando fallback front:', e);
    }

    const candidates = [
      window.getFuncionariosParaDocs,
      window.getFuncionarios,
      window.getAllFuncionarios
    ];
    for (const fn of candidates) {
      if (typeof fn === 'function') {
        try {
          const r = fn();
          if (Array.isArray(r)) return r;
        } catch {}
      }
    }
    return [];
  }

  async function loadDocDetail(docId) {
    try {
      return await apiFetch(API.docById(docId));
    } catch {
      return null;
    }
  }

  async function loadExisting(docId, funcId) {
    try {
      const r = await apiFetch(API.existing(docId, funcId));
      return r || null;
    } catch {
      return null;
    }
  }

  function getSelectedDoc() {
    const id = el.selDoc?.value || '';
    return state.docs.find((d) => String(d.id) === String(id)) || null;
  }

  function getSelectedFunc() {
    const id = el.selFunc?.value || '';
    return state.funcs.find((f) => String(f.id || f.codigo || f.cpf) === String(id)) || null;
  }

  async function onChangeDoc() {
    state.selectedDoc = getSelectedDoc();
    resetKeysAndStatus(true);

    if (!state.selectedDoc) {
      setStatus('Selecione um documento para continuar.', 'info');
      return;
    }

    const detail = await loadDocDetail(state.selectedDoc.id);
    const funcionarioId = detail?.funcionarioId ?? state.selectedDoc?.funcionarioId;

    if (funcionarioId && el.selFunc) {
      el.selFunc.value = String(funcionarioId);
      await onChangeFunc();
    } else {
      setStatus('Agora selecione o funcionário para preencher os dados do signatário.', 'info');
    }
  }

  async function onChangeFunc() {
    state.selectedFunc = getSelectedFunc();
    resetKeysAndStatus(true);

    if (!state.selectedFunc) {
      setStatus('Selecione um funcionário para preencher os dados do signatário.', 'info');
      if (el.signerName) el.signerName.value = '';
      if (el.signerEmail) el.signerEmail.value = '';
      if (el.signerPhone) el.signerPhone.value = '';
      return;
    }

    fillSignerFromFunc(state.selectedFunc);

    const doc = getSelectedDoc();
    if (doc) {
      const existing = await loadExisting(doc.id, state.selectedFunc.id || state.selectedFunc.codigo || state.selectedFunc.cpf);
      if (existing?.documentKey) {
        if (el.docKey) el.docKey.value = existing.documentKey;
        if (el.envelopeKey) el.envelopeKey.value = existing.envelopeKey || '';
        state.lastSignUrl = existing.signUrl || null;

        const extra =
          (existing.signUrl)
            ? `<div class="cs-inline-actions">
                 <a class="btn btn-light" href="${escapeHtml(existing.signUrl)}" target="_blank" rel="noopener">Abrir link de assinatura</a>
                 <button class="btn btn-light" type="button" id="csCopyLinkBtn">Copiar link</button>
               </div>`
            : '';

        setStatus(`Vínculo já encontrado. Você pode consultar status ou baixar quando estiver assinado.`, 'info', extra);

        setTimeout(() => {
          const b = $('csCopyLinkBtn');
          if (b && existing.signUrl) {
            b.onclick = async () => {
              try {
                await navigator.clipboard.writeText(existing.signUrl);
                toast('Link copiado!', 'success');
              } catch {
                toast('Não consegui copiar automaticamente. Selecione e copie o link manualmente.', 'warn');
              }
            };
          }
        }, 0);
      } else {
        setStatus('Dados do signatário preenchidos. Clique em “Enviar para Clicksign”.', 'info');
      }
    }
  }

  async function enviarParaClicksign() {
    const doc = getSelectedDoc();
    const func = getSelectedFunc();

    const signerName = el.signerName?.value?.trim() || '';
    const signerEmail = el.signerEmail?.value?.trim() || '';
    const signerPhoneRaw = (el.signerPhone?.value || '').replace(/\D/g, '');

    if (!doc?.id) return setStatus('Selecione um documento.', 'error');
    if (!func) return setStatus('Selecione um funcionário.', 'error');

    if (!signerName) return setStatus('Nome do signatário está vazio.', 'error');
    if (!signerEmail) return setStatus('E-mail do signatário está vazio.', 'error');

    const payload = {
      documentoId: doc.id,
      funcionarioId: func.id || func.codigo || func.cpf,

      signer: {
        name: signerName,
        email: signerEmail,
        phone: signerPhoneRaw || null
      },

      // preferências
      sendChannel: el.sendChannel?.value || 'email',  // email | whatsapp | gmail | sms
      authMethod: el.authMethod?.value || 'email',    // email | whatsapp | sms
      message: el.msg?.value?.trim() || ''
    };

    try {
      setBusy(true);
      setStatus('Enviando para Clicksign…', 'info');

      const data = await apiPostJSON(API.send, payload);

      const documentKey = data?.documentKey || data?.clicksignKey || data?.key || '';
      const envelopeKey = data?.envelopeKey || '';
      const signUrl = data?.signUrl || data?.urlAssinatura || '';

      if (documentKey && el.docKey) el.docKey.value = documentKey;
      if (envelopeKey && el.envelopeKey) el.envelopeKey.value = envelopeKey;

      state.lastSignUrl = signUrl || null;

      let extra = '';
      if (signUrl) {
        extra = `<div class="cs-inline-actions">
                  <a class="btn btn-light" href="${escapeHtml(signUrl)}" target="_blank" rel="noopener">Abrir link de assinatura</a>
                  <button class="btn btn-light" type="button" id="csCopyLinkBtn">Copiar link</button>
                </div>`;
      }

      setStatus(data?.message || 'Enviado com sucesso. Aguarde a assinatura e depois baixe o PDF assinado.', 'success', extra);

      setTimeout(() => {
        const b = $('csCopyLinkBtn');
        if (b && signUrl) {
          b.onclick = async () => {
            try {
              await navigator.clipboard.writeText(signUrl);
              toast('Link copiado!', 'success');
            } catch {
              toast('Não consegui copiar automaticamente. Selecione e copie o link manualmente.', 'warn');
            }
          };
        }
      }, 0);

    } catch (err) {
      console.error(err);
      setStatus('Falha ao enviar para Clicksign. Veja o console.', 'error');
      toast('Falha ao enviar para Clicksign.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function consultarStatus() {
    const key = (el.docKey?.value || '').trim();
    if (!key) return setStatus('Informe a chave do documento (documentKey) para consultar.', 'error');

    try {
      setBusy(true);
      setStatus('Consultando status…', 'info');

      const data = await apiFetch(API.status(key));

      const status = data?.status || data?.state || '—';
      const canDownload = !!(data?.canDownload || data?.signed || data?.completed);
      const signUrl = data?.signUrl || state.lastSignUrl || '';

      state.lastSignUrl = signUrl || state.lastSignUrl;

      const signersHtml = Array.isArray(data?.signers) && data.signers.length
        ? `<div style="margin-top:8px">
             <div style="font-weight:700;margin-bottom:6px">Signatários</div>
             <div style="display:grid;gap:6px">
               ${data.signers.map(s => {
                 const n = escapeHtml(s.name || s.nome || '—');
                 const e = escapeHtml(s.email || '—');
                 const st = escapeHtml(s.status || s.state || '—');
                 return `<div style="display:flex;justify-content:space-between;gap:10px">
                           <span>${n} <span style="opacity:.75">(${e})</span></span>
                           <b>${st}</b>
                         </div>`;
               }).join('')}
             </div>
           </div>`
        : '';

      const linkHtml = signUrl
        ? `<div class="cs-inline-actions" style="margin-top:10px">
             <a class="btn btn-light" href="${escapeHtml(signUrl)}" target="_blank" rel="noopener">Abrir link de assinatura</a>
             <button class="btn btn-light" type="button" id="csCopyLinkBtn">Copiar link</button>
           </div>`
        : '';

      const msg = `Status do documento: ${status}${canDownload ? ' (pronto para baixar)' : ''}`;
      setStatus(msg, canDownload ? 'success' : 'info', signersHtml + linkHtml);

      setTimeout(() => {
        const b = $('csCopyLinkBtn');
        if (b && signUrl) {
          b.onclick = async () => {
            try {
              await navigator.clipboard.writeText(signUrl);
              toast('Link copiado!', 'success');
            } catch {
              toast('Não consegui copiar automaticamente.', 'warn');
            }
          };
        }
      }, 0);

    } catch (err) {
      console.error(err);
      setStatus('Falha ao consultar status. Veja o console.', 'error');
      toast('Falha ao consultar status.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function baixarDocumentoAssinado() {
    const key = (el.docKey?.value || '').trim();
    if (!key) return setStatus('Informe a chave do documento (documentKey) para baixar.', 'error');

    try {
      setBusy(true);
      setStatus('Baixando PDF assinado…', 'info');

      const resp = await fetch(API.download(key), { method: 'GET', credentials: 'same-origin' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `documento-assinado-${key}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      setStatus('PDF assinado baixado com sucesso.', 'success');

    } catch (err) {
      console.error(err);
      setStatus('Falha ao baixar o PDF assinado. Veja o console.', 'error');
      toast('Falha ao baixar PDF assinado.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function limparVinculo() {
    if (el.selFunc) el.selFunc.value = '';
    if (el.signerName) { el.signerName.value = ''; el.signerName.readOnly = true; }
    if (el.signerEmail) { el.signerEmail.value = ''; el.signerEmail.readOnly = true; }
    if (el.signerPhone) { el.signerPhone.value = ''; el.signerPhone.readOnly = true; }
    resetKeysAndStatus(false);
  }

  /* -------------------- Bind events -------------------- */
  el.selDoc?.addEventListener('change', onChangeDoc);
  el.selFunc?.addEventListener('change', onChangeFunc);
  el.btnEnviar?.addEventListener('click', enviarParaClicksign);
  el.btnConsultar?.addEventListener('click', consultarStatus);
  el.btnBaixar?.addEventListener('click', baixarDocumentoAssinado);
  el.btnLimpar?.addEventListener('click', limparVinculo);

  /* -------------------- Boot -------------------- */
  (async function boot() {
    try {
      setBusy(true);
      setStatus('Carregando documentos e funcionários…', 'info');

      const [docs, funcs] = await Promise.all([loadDocs(), loadFuncs()]);
      state.docs = Array.isArray(docs) ? docs : [];
      state.funcs = Array.isArray(funcs) ? funcs : [];

      populateDocsSelect();
      populateFuncSelect();

      if (!state.docs.length) setStatus('Nenhum documento disponível para assinatura.', 'warn');
      else setStatus('Selecione um documento e um funcionário para iniciar.', 'info');

    } catch (err) {
      console.error(err);
      setStatus('Falha ao carregar dados da assinatura. Veja o console.', 'error');
    } finally {
      setBusy(false);
    }
  })();
})();
