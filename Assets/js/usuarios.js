// ===================== Cadastro de Usuário (Admin) =====================
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const el = {
    // (opcional) item de menu / tab
    menuItem: document.querySelector('li[data-tab="tabCadastroUsuario"]'),
    tab: $('tabCadastroUsuario'),

    // inputs
    login: $('usrLogin'),
    email: $('usrEmail'),
    cpf: $('usrCPF'),
    tel: $('usrTelefone'),
    senha: $('usrSenha'),
    senha2: $('usrSenha2'),
    perfil: $('usrPerfil'),

    // botões + status
    btnSalvar: $('btnUsrSalvar'),
    btnLimpar: $('btnUsrLimpar'),
    status: $('usrStatus'),
  };

  // Se não existir na página, não faz nada
  if (!el.login || !el.btnSalvar || !el.btnLimpar || !el.status) return;

  // ---------------- Utils ----------------
  function toast(msg, type = 'info') {
    if (typeof window.showToast === 'function') return window.showToast(msg, type);
    if (typeof window.notify === 'function') return window.notify(msg, type);
    console.log(`[${type}] ${msg}`);
  }

  function setStatus(msg, tipo = 'info') {
    el.status.textContent = msg;
    el.status.classList.remove('success', 'error', 'info');
    el.status.classList.add(tipo);
  }

  function setBusy(b) {
    const disabled = !!b;
    el.btnSalvar.disabled = disabled;
    el.btnLimpar.disabled = disabled;
    el.login.disabled = disabled;
    el.email.disabled = disabled;
    el.cpf.disabled = disabled;
    el.tel.disabled = disabled;
    el.senha.disabled = disabled;
    el.senha2.disabled = disabled;
    el.perfil.disabled = disabled;
  }

  // ---------------- Admin check (UX) ----------------
  function getMeSafe() {
    try {
      if (typeof window.getMe === 'function') return window.getMe() || {};
    } catch {}
    return {};
  }

  function getUserTypeFromMe() {
    const me = getMeSafe();
    const type = me.typeUser ?? me.type ?? me.perfil ?? me.roleId;
    const n = Number(type);
    return Number.isFinite(n) ? n : 0;
  }

  
  function isAdminUser() {
    return getUserTypeFromMe() === 1;
  }


  function applyAdminVisibility() {
    const isAdmin = isAdminUser();
    document.querySelectorAll('.only-admin').forEach((n) => {
      n.style.display = isAdmin ? '' : 'none';
    });

    // Se não for admin e a tab estiver ativa, volta pra tabPonto
    if (!isAdmin && el.tab?.classList.contains('active')) {
      el.tab.classList.remove('active');
      document.getElementById('tabPonto')?.classList.add('active');
    }
  }

  // ---------------- Máscaras ----------------
  function maskCPF(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    const p1 = d.slice(0, 3);
    const p2 = d.slice(3, 6);
    const p3 = d.slice(6, 9);
    const p4 = d.slice(9, 11);
    let out = p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '-' + p4;
    return out;
  }

  function maskPhone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  // Mantém cursor mais estável (não perfeito em todos os casos, mas bem melhor)
  function applyMaskKeepingEnd(inputEl, masker) {
    const before = inputEl.value || '';
    const rawBefore = before.replace(/\D/g, '');
    const masked = masker(before);
    inputEl.value = masked;

    // tenta colocar o cursor no "fim lógico" do que foi digitado
    // (como você usa só input, isso costuma ficar ok)
    const rawAfter = masked.replace(/\D/g, '');
    const delta = rawAfter.length - rawBefore.length;

    let pos = inputEl.selectionStart ?? masked.length;
    pos = Math.max(0, Math.min(masked.length, pos + (delta > 0 ? 1 : 0)));
    inputEl.selectionStart = inputEl.selectionEnd = pos;
  }

  el.cpf.addEventListener('input', () => applyMaskKeepingEnd(el.cpf, maskCPF));
  el.tel.addEventListener('input', () => applyMaskKeepingEnd(el.tel, maskPhone));

  // ---------------- Validação CPF ----------------
  function isValidCPF(cpfDigits) {
    const cpf = String(cpfDigits || '').replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    const calc = (base, factor) => {
      let sum = 0;
      for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
      const mod = (sum * 10) % 11;
      return mod === 10 ? 0 : mod;
    };

    const d1 = calc(cpf.slice(0, 9), 10);
    const d2 = calc(cpf.slice(0, 10), 11);

    return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
  }

  function getPayload() {
    const login = (el.login.value || '').trim();
    const email = (el.email.value || '').trim();
    const cpf = (el.cpf.value || '').replace(/\D/g, '');
    const telefone = (el.tel.value || '').replace(/\D/g, '');
    const senha = el.senha.value || '';
    const senha2 = el.senha2.value || '';
    const typeUser = Number(el.perfil.value || 0);
    return { login, email, cpf, telefone, senha, senha2, typeUser };
  }

  function validate(p) {
    if (!p.login) return 'Informe o Nome Login.';
    if (!p.email) return 'Informe o Email.';
    if (!p.cpf) return 'Informe o CPF.';
    if (!isValidCPF(p.cpf)) return 'CPF inválido.';
    if (!p.telefone) return 'Informe o Telefone.';
    if (!p.senha) return 'Informe a Senha.';
    if (p.senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
    if (p.senha !== p.senha2) return 'As senhas não conferem.';
    if (![1, 2, 3, 4].includes(p.typeUser)) return 'Selecione um perfil válido.';
    return null;
  }

  function limpar() {
    el.login.value = '';
    el.email.value = '';
    el.cpf.value = '';
    el.tel.value = '';
    el.senha.value = '';
    el.senha2.value = '';
    el.perfil.value = '4';
    setStatus('Preencha os dados e clique em “Cadastrar Usuário”.', 'info');
  }

  // ---------------- POST /api/usuarios ----------------
  async function salvar() {
    // UX check (a segurança real é no backend)
    if (!isAdminUser()) {
      const msg = 'Apenas Admin pode cadastrar usuários.';
      setStatus(msg, 'error');
      toast(msg, 'error');
      return;
    }

    const payload = getPayload();
    const err = validate(payload);
    if (err) {
      setStatus(err, 'error');
      toast(err, 'error');
      return;
    }

    // Header X-User-Type (temporário até você ter Auth real)
    const userTypeHeader = String(getUserTypeFromMe() || 1);

    try {
      setBusy(true);
      setStatus('Cadastrando usuário…', 'info');

      const resp = await fetch('/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Type': userTypeHeader,
        },
        body: JSON.stringify({
          login: payload.login,
          nome: payload.login, // regra atual: nome = login (se você quiser separar, trocamos)
          email: payload.email,
          cpf: payload.cpf,
          telefone: payload.telefone,
          senha: payload.senha,
          confirmarSenha: payload.senha2, // importante se o DTO validar confirmação
          typeUser: payload.typeUser,
        }),
      });

      let data = null;
      try {
        data = await resp.json();
      } catch {}

      if (!resp.ok) {
        const msg =
          data?.message ||
          data?.error ||
          (typeof data === 'string' ? data : null) ||
          `Falha ao cadastrar (HTTP ${resp.status}).`;
        setStatus(msg, 'error');
        toast(msg, 'error');
        return;
      }

      setStatus(`Usuário cadastrado com sucesso. ID: ${data?.id ?? '—'}`, 'success');
      toast('Usuário cadastrado!', 'success');
      limpar();
    } catch (e) {
      console.error(e);
      setStatus('Erro inesperado ao cadastrar. Veja o console.', 'error');
      toast('Erro ao cadastrar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------------- Events ----------------
  el.btnLimpar.addEventListener('click', (e) => {
    e.preventDefault();
    limpar();
  });

  el.btnSalvar.addEventListener('click', async (e) => {
    e.preventDefault();
    await salvar();
  });

  // Boot
  applyAdminVisibility();
  setStatus('Preencha os dados e clique em “Cadastrar Usuário”.', 'info');
})();
