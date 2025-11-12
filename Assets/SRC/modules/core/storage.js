const NS = 'rcr_rh_v1'

function key (k) { return `${NS}:${k}` }

export function get (k, fallback = null) {
  try {
    const raw = localStorage.getItem(key(k))
    return raw ? JSON.parse(raw) : fallback
  } catch (err) {
    console.error('storage.get', err)
    return fallback
  }
}

export function set (k, value) {
  try {
    localStorage.setItem(key(k), JSON.stringify(value))
    return true
  } catch (err) {
    console.error('storage.set', err)
    return false
  }
}

export function del (k) {
  try {
    localStorage.removeItem(key(k))
    return true
  } catch (err) {
    console.error('storage.del', err)
    return false
  }
}

export function allKeys () {
  return Object.keys(localStorage).filter(k => k.startsWith(NS + ':'))
}
