import { get, set } from '../../modules/core/storage.js'

export class FuncionariosView {
  constructor () {
    const root = document.createElement('div')
    root.className = 'card'
    root.innerHTML = `
      <h2 style="margin-top:0">Funcionários</h2>
      <div class="row">
        <div style="flex:1 1 320px">
          <label class="label">Nome</label>
          <input id="f-nome" placeholder="Ex.: Ana Souza" />
        </div>
        <div style="flex:1 1 200px">
          <label class="label">CPF</label>
          <input id="f-cpf" placeholder="000.000.000-00" />
        </div>
        <div style="align-self:flex-end">
          <button id="f-add" class="btn">Adicionar</button>
        </div>
      </div>
      <table style="margin-top:12px">
        <thead><tr><th>Nome</th><th>CPF</th><th>Ações</th></tr></thead>
        <tbody id="f-tbody"></tbody>
      </table>
    `
    this.el = root
  }

  onMount () {
    const tbody = document.getElementById('f-tbody')

    function render () {
      tbody.innerHTML = ''
      for (const f of get('funcionarios', [])) {
        const tr = document.createElement('tr')
        tr.innerHTML = `<td>${f.nome}</td><td>${f.cpf}</td><td><button data-act="del" data-cpf="${f.cpf}" class="btn">Excluir</button></td>`
        tbody.appendChild(tr)
      }
    }
    render()

    document.getElementById('f-add')?.addEventListener('click', () => {
      const nome = document.getElementById('f-nome').value.trim()
      const cpf = document.getElementById('f-cpf').value.trim()
      if (!nome || !cpf) return

      const curr = get('funcionarios', [])
      curr.push({ nome, cpf })
      set('funcionarios', curr)
      render()
      document.getElementById('f-nome').value = ''
      document.getElementById('f-cpf').value = ''
    })

    tbody?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act="del"]')
      if (!btn) return
      const cpf = btn.getAttribute('data-cpf')
      const curr = get('funcionarios', []).filter(f => f.cpf !== cpf)
      set('funcionarios', curr)
      render()
    })
  }
}
