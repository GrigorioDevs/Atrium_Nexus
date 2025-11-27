// assets/js/assinatura-publica.js
(() => {
  'use strict';

  // ELEMENTOS QUE ELE USA
  const docTipo = $('docTipo');
  const docNome = $('docNome');
  const docDoc = $('docDoc');
  const docTexto = $('docTexto');

  const btnGerarLinkAss = $('btnGerarLinkAss');
  const btnCopiarLinkAss = $('btnCopiarLinkAss');
  const assLink = $('assLink');

  const publicSign = $('publicSign');
  const pubDocTitle = $('pubDocTitle');
  const pubDocWho = $('pubDocWho');
  const pubDocText = $('pubDocText');

  const btnLimparAssPublic = $('btnLimparAssPublic');
  const btnFecharPublic = $('btnFecharPublic');
  const btnBaixarPDFPublic = $('btnBaixarPDFPublic');

  if (!publicSign) {
    // se a tela pública não existir nessa página, não faz nada
    return;
  }

  /* ===================== PUBLIC SIGN ===================== */
  function docTitleFromType(val) {
    const map = {
      interesse: 'DECLARAÇÃO DE INTERESSE',
      anuencia: 'CARTA DE ANUÊNCIA',
      dividas: 'DECLARAÇÃO DE AUSÊNCIA DE DÍVIDAS'
    };
    if (val && val.startsWith('tpl:')) {
      const tpl = (getTemplates() || []).find((t) => t.id === val.slice(4));
      return (tpl?.name || 'DOCUMENTO PERSONALIZADO').toUpperCase();
    }
    return (map[val] || 'DOCUMENTO').toUpperCase();
  }

  function buildSignLink() {
    const payload = {
      titulo: docTitleFromType(docTipo?.value),
      nome: docNome?.value || getMe().nome || '',
      documento: docDoc?.value || '',
      texto: String(docTexto?.value || '').slice(0, 250000)
    };
    const token = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const base = location.origin + location.pathname;
    return `${base}#assinar=${token}`;
  }

  btnGerarLinkAss?.addEventListener('click', () => {
    const link = buildSignLink();
    if (assLink) assLink.value = link;
    notify('Link de assinatura gerado!', 'success');
  });

  btnCopiarLinkAss?.addEventListener('click', async () => {
    if (!assLink?.value) return notify('Primeiro gere o link.', 'warn');
    try {
      await navigator.clipboard.writeText(assLink.value);
      notify('Link copiado.', 'success');
    } catch {
      notify('Não foi possível copiar automaticamente.', 'warn');
    }
  });

  let sigPadPublic = null;

  function initSigPublic() {
    const canvas = $('sigPadPublic');
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    sigPadPublic = new SignaturePad(canvas, {
      minWidth: 1.2,
      maxWidth: 2.5,
      penColor: '#eaf6ff',
      backgroundColor: 'rgba(0,0,0,0)'
    });
  }

  function showPublicSign(data) {
    document
      .querySelector('.container')
      ?.setAttribute('style', 'display:none!important');
    $('btnHamb')?.setAttribute('style', 'display:none!important');

    if (pubDocTitle) pubDocTitle.textContent = data.titulo || 'DOCUMENTO';
    if (pubDocWho) {
      pubDocWho.textContent = data.nome
        ? `${data.nome} • ${data.documento || ''}`
        : '—';
    }
    if (pubDocText) pubDocText.textContent = data.texto || '';

    publicSign.style.display = 'block';
    setTimeout(initSigPublic, 30);
  }

  function hidePublicSign() {
    publicSign.style.display = 'none';
    document
      .querySelector('.container')
      ?.setAttribute('style', '');
    $('btnHamb')?.setAttribute('style', '');
  }

  function parseSignHash() {
    if (!location.hash.startsWith('#assinar=')) return null;
    try {
      const token = location.hash.slice('#assinar='.length);
      const json = decodeURIComponent(escape(atob(token)));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  window.addEventListener('hashchange', () => {
    const data = parseSignHash();
    if (data) showPublicSign(data);
    else hidePublicSign();
  });

  btnLimparAssPublic?.addEventListener('click', () => sigPadPublic?.clear());

  btnFecharPublic?.addEventListener('click', () => {
    hidePublicSign();
    history.replaceState(
      null,
      '',
      location.pathname + location.search
    );
  });

  btnBaixarPDFPublic?.addEventListener('click', () => {
    const data = parseSignHash();
    if (!data) return notify('Algo deu errado com o link.', 'error');
    if (!sigPadPublic || sigPadPublic.isEmpty()) {
      return notify('Assine no quadro antes de baixar.', 'warn');
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return notify('jsPDF não carregado.', 'error');

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 56;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - margin * 2;
    const lineH = 16;
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(data.titulo || 'DOCUMENTO', margin, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);

    if (data.nome) {
      doc.text(
        `Colaborador: ${data.nome}${
          data.documento ? ` — Doc.: ${data.documento}` : ''
        }`,
        margin,
        y
      );
      y += 18;
    }

    const paragraphs = String(data.texto || '').split('\n');
    for (const p of paragraphs) {
      const wrapped = doc.splitTextToSize(p || ' ', contentW);
      const arr = Array.isArray(wrapped) ? wrapped : [wrapped];
      for (const part of arr) {
        if (y + lineH > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(String(part), margin, y);
        y += lineH;
      }
    }

    if (y + 100 > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Assinatura do colaborador:', margin, y);
    y += 8;

    const img = sigPadPublic.toDataURL('image/png');
    doc.addImage(img, 'PNG', margin, y, 240, 80);
    y += 90;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      'Assinado via link público • ' +
        new Date().toLocaleString('pt-BR'),
      margin,
      pageH - 24
    );

    const safeName = (data.titulo || 'documento')
      .replace(/\s+/g, '_')
      .toLowerCase();

    doc.save(`${safeName}_assinado.pdf`);
    notify('PDF assinado gerado.', 'success');
  });

  // Quando a página carrega, se já vier com #assinar=..., abre direto
  const initialData = parseSignHash();
  if (initialData) {
    showPublicSign(initialData);
  }
})();
