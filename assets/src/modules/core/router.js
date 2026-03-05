const routes = new Map()

export function registerRoute (path, ViewCtor) {
  routes.set(path, ViewCtor)
}

function getPath () {
  const raw = location.hash.slice(1)
  return raw || '/ponto'
}

function render () {
  const mount = document.getElementById('app')
  const path = getPath()
  const ViewCtor = routes.get(path)

  if (!ViewCtor) {
    mount.innerHTML = `<div class="card"><h2>404</h2><p>Rota não encontrada: <code>${path}</code></p></div>`
    return
  }
  const view = new ViewCtor()
  mount.replaceChildren(view.el)
  if (typeof view.onMount === 'function') view.onMount()
}

export const router = {
  start () {
    window.addEventListener('hashchange', render)
    if (!location.hash) location.hash = '#/ponto'
    render()
  }
}
