// Wrapper de notificação com fallback que usa o alert nativo do navegador
const nativeAlert = window.alert ? window.alert.bind(window) : (msg) => console.log('[ALERT]', msg)

export const notify = {
  info (msg) {
    nativeAlert(String(msg))
  },
  error (msg) {
    nativeAlert('Erro: ' + String(msg))
  }
}
