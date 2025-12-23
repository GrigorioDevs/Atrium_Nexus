// Assets/JS/cracha-acesso.js
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const modalCracha     = $('modalCracha');
  const btnFecharCracha = $('btnFecharCracha');
  const btnCrachaGerar  = $('btnCrachaGerar');

  const crachaFoto      = $('crachaFoto');
  const crachaNome      = $('crachaNome');
  const crachaCpf       = $('crachaCpf');
  const crachaFuncao    = $('crachaFuncao');
  const crachaCursos    = $('crachaCursos');
  const crachaContrato  = $('crachaContrato');

  // Usa o mesmo avatar padrão do módulo de funcionários, se existir
  function defaultAvatar() {
    try {
      if (typeof window.defaultAvatarDataURL === 'function') {
        return window.defaultAvatarDataURL();
      }
    } catch {}

    // fallback simples: um SVG pequeno
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#00E0FF"/>
            <stop offset="1" stop-color="#FF2FB9"/>
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="24" fill="url(#g)" opacity="0.25"/>
        <circle cx="64" cy="50" r="22" fill="#cfe0ef"/>
        <rect x="24" y="78" width="80" height="34" rx="17" fill="#cfe0ef"/>
      </svg>`;
    return 'data:image/svg+xml;base64,' +
      btoa(unescape(encodeURIComponent(svg)));
  }

  function fillCracha(f) {
    if (!f) f = {};

    const foto =
      (typeof f.foto === 'string' && f.foto.trim())
        ? f.foto.trim()
        : defaultAvatar();

    const nome =
      f.nome || f.Nome || f.nomeCompleto || 'Funcionário';

    const cpf =
      f.cpf || f.CPF || '—';

    const funcao =
      f.funcao || f.cargo || f.Funcao || f.Cargo || '—';

    // Cursos: você pode guardar no objeto como "cursos"
    // (string única tipo "NR10, NR35, ...")
    const cursos =
      f.cursos || f.Cursos || f.cursosDescricao || '—';

    const contrato =
      f.tipoContrato || f.contrato || f.TipoContrato || f.Contrato || '—';

    if (crachaFoto)   crachaFoto.src = foto;
    if (crachaNome)   crachaNome.textContent = nome;
    if (crachaCpf)    crachaCpf.textContent = cpf;
    if (crachaFuncao) crachaFuncao.textContent = funcao;
    if (crachaCursos) crachaCursos.textContent = cursos;
    if (crachaContrato) crachaContrato.textContent = contrato;
  }

  function showCracha() {
    if (!modalCracha) return;
    modalCracha.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  function hideCracha() {
    if (!modalCracha) return;
    modalCracha.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  // === Função global chamada pelo funcionarios.js ===
  // funcionarios.js deve chamar: window.openCrachaFuncionario(f);
  window.openCrachaFuncionario = function (funcionario) {
    if (!funcionario) {
      alert('Funcionário não encontrado para o crachá.');
      return;
    }
    fillCracha(funcionario);
    showCracha();
  };

  // Fechar modal (X)
  btnFecharCracha?.addEventListener('click', hideCracha);

  // Fechar clicando fora do card
  modalCracha?.addEventListener('click', (e) => {
    if (e.target === modalCracha) hideCracha();
  });

  // Fechar com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalCracha && modalCracha.style.display === 'flex') {
      hideCracha();
    }
  });

  // ====== GERAR / IMPRIMIR CARTÃO (PDF) ======
  btnCrachaGerar?.addEventListener('click', () => {
    if (!modalCracha) return;
    const card = modalCracha.querySelector('.cracha-card');
    if (!card) return;

    const htmlCard = card.outerHTML;

    const win = window.open('', '_blank', 'width=900,height=600');
    if (!win) return;

    const doc = win.document;
    doc.open();
    doc.write(`
      <html>
      <head>
        <meta charset="utf-8">
        <title>Crachá de acesso - RCR Engenharia</title>
        <style>
          *{
            box-sizing:border-box;
            margin:0;
            padding:0;
          }
          @page{
            size: A4;
            margin: 0;
          }
          body{
            margin:0;
            padding:24px;
            background:#050b12;
            color:#e4edf7;
            font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            display:flex;
            align-items:center;
            justify-content:center;
          }

          /* === layout do crachá no PDF (igual ao da tela) === */
          .cracha-card{
            width:640px;
            max-width:100%;
            border-radius:20px;
            padding:22px 24px;
            background:
              linear-gradient(#050b12,#050b12) padding-box,
              linear-gradient(135deg,#00E0FF,#FF2FB9) border-box;
            border:2px solid transparent;
            box-shadow:0 18px 45px rgba(0,0,0,.75);
            display:flex;
            gap:18px;
          }
          .cracha-left{
            min-width:210px;
            padding-right:18px;
            border-right:1px solid rgba(255,255,255,.07);
            display:flex;
            flex-direction:column;
            align-items:center;
            gap:10px;
          }
          .cracha-foto-wrap{
            width:180px;
            height:180px;
            border-radius:24px;
            padding:3px;
            background:
              linear-gradient(#050b12,#050b12) padding-box,
              linear-gradient(135deg,#00E0FF,#FF2FB9) border-box;
            border:2px solid transparent;
            overflow:hidden;
            display:flex;
            align-items:center;
            justify-content:center;
          }
          .cracha-foto-wrap img{
            width:100%;
            height:100%;
            object-fit:cover;
          }
          .cracha-nome{
            font-weight:800;
            font-size:18px;
            text-align:center;
          }
          .cracha-cpf{
            font-size:13px;
            opacity:.85;
          }

          .cracha-right{
            flex:1;
            display:flex;
            flex-direction:column;
            gap:10px;
          }
          .cracha-field{
            font-size:13px;
            display:flex;
            flex-direction:column;
          }
          .cracha-field .label{
            font-size:11px;
            text-transform:uppercase;
            letter-spacing:.08em;
            background:#1d4ed8;
            padding:2px 8px;
            border-radius:999px;
            align-self:flex-start;
            margin-bottom:4px;
          }
          .cracha-field .value{
            font-size:14px;
            font-weight:600;
          }

          .cracha-footer{
            margin-top:auto;
            padding-top:14px;
            border-top:1px dashed rgba(148,163,184,.6);
            display:flex;
            justify-content:flex-end;
            align-items:center;
            font-size:12px;
          }
          .cracha-empresa-sec{
            font-weight:600;
            color:#60a5fa;
          }

          /* some o botão de gerar dentro do PDF */
          .cracha-footer button{
            display:none !important;
          }

          @media print{
            body{
              padding:0;
              background:#000;
            }
            .cracha-card{
              box-shadow:none;
            }
          }
        </style>
      </head>
      <body>
        ${htmlCard}
        <script>
          window.onload = function(){
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);
    doc.close();
  });
})();
