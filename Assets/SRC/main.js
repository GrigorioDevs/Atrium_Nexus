import './style.css'
import { router, registerRoute } from './modules/core/router.js'
import { notify } from './modules/core/notify.js'

import { PontoView } from './features/ponto/index.js'
import { DocumentosView } from './features/documentos/index.js'
import { FuncionariosView } from './features/funcionarios/index.js'
import { BeneficiosView } from './features/beneficios/index.js'
import { AssinaturaPublicaView } from './features/assinatura-publica/index.js'

// Oculta o splash assim que o DOM estiver pronto
window.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash')
  if (splash) splash.style.display = 'none'

  // Rotas
  registerRoute('/ponto', PontoView)
  registerRoute('/documentos', DocumentosView)
  registerRoute('/funcionarios', FuncionariosView)
  registerRoute('/beneficios', BeneficiosView)
  registerRoute('/assinatura-publica', AssinaturaPublicaView)

  router.start()

  // Exemplo de uso do notify com fallback nativo
  // notify.info('Ambiente iniciado com sucesso.')
})
