  /* ===================== PERFIL (usuário logado) ===================== */

// helper simples pra pegar elemento por id
function $(id) {
  return document.getElementById(id);
}

// converte typeUser num texto amigável
function mapTypeUser(typeUser) {
  switch (typeUser) {
    case 1: return "Administrador(a)";
    case 2: return "Gestão";
    case 3: return "Segurança do Trabalho";
    case 4: return "Funcionário(a)";
    default: return "Usuário";
  }
}

// lê o usuário salvo pelo login no localStorage
window.getMe = function () {
  try {
    const raw = localStorage.getItem("usuario");
    if (!raw) return null;

    const u = JSON.parse(raw);

    return {
      id: u.id,
      nome: u.nome || u.login || "Colaborador(a)",
      login: u.login,
      email: u.email,
      typeUser: u.typeUser,
      // se tiver "role" vindo do back, usa. Se não tiver, monta a partir do typeUser
      funcao: u.role || mapTypeUser(u.typeUser)
    };
  } catch (e) {
    console.error("Erro ao ler usuário logado:", e);
    return null;
  }
};

/* ===================== PERFIL (usuário logado) ===================== */
(function initMe() {
  try {
    const me = window.getMe && window.getMe();
    if (!me) return;

    const elNome   = $("uNome");
    const elFuncao = $("uFuncao");
    const elHello  = $("helloNome");

    if (elNome)   elNome.textContent   = me.nome   || "Colaborador(a)";
    if (elFuncao) elFuncao.textContent = me.funcao || "Função";
    if (elHello)  elHello.textContent  = me.nome   || "Colaborador(a)";
  } catch (e) {
    console.error("Erro ao inicializar perfil:", e);
  }
})();


// helper pra pegar elemento por id
function $(id) {
  return document.getElementById(id);
}

// converte typeUser num texto amigável (pra mostrar no card)
function mapTypeUser(typeUser) {
  switch (typeUser) {
    case 1: return "Administrador(a)";
    case 2: return "Gestão";
    case 3: return "Segurança do Trabalho";
    case 4: return "Colaborador(a)";
    default: return "Usuário";
  }
}

// lê o usuário salvo pelo login
window.getMe = function () {
  try {
    const raw = localStorage.getItem("usuario");
    if (!raw) return null;

    const u = JSON.parse(raw);

    return {
      id: u.id,
      nome: u.nome || u.login || "Colaborador(a)",
      login: u.login,
      email: u.email,
      typeUser: u.typeUser,
      funcao: u.role || mapTypeUser(u.typeUser)
    };
  } catch (e) {
    console.error("Erro ao ler usuário logado:", e);
    return null;
  }
};

// aplica regras de acesso na tela
function applyAccessControl() {
  const me = window.getMe && window.getMe();
  if (!me || !me.typeUser) return;

  const role = String(me.typeUser);

  // opcional: colocar o role no <html> pra usar em CSS, se quiser
  document.documentElement.setAttribute("data-role", role);

  // percorre qualquer elemento com data-roles="1,2,..."
  document.querySelectorAll("[data-roles]").forEach(el => {
    const allowed = (el.dataset.roles || "")
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);

    // se o role do usuário NÃO estiver na lista, esconde
    if (!allowed.includes(role)) {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    }
  });
}

/* ===================== PERFIL (usuário logado) ===================== */
(function initMe() {
  try {
    const me = window.getMe && window.getMe();
    if (!me) return;

    const elNome   = $("uNome");
    const elFuncao = $("uFuncao");
    const elHello  = $("helloNome");

    if (elNome)   elNome.textContent   = me.nome   || "Colaborador(a)";
    if (elFuncao) elFuncao.textContent = me.funcao || "Função";
    if (elHello)  elHello.textContent  = me.nome   || "Colaborador(a)";

    // depois de preencher o card, aplica as regras de permissão visual
    applyAccessControl();
  } catch (e) {
    console.error("Erro ao inicializar perfil:", e);
  }
})();