const STORAGE_KEY = 'sunwin-api-test-v1'

export const DEFAULT_FORM = {
  username: '',
  password: '',
  newPassword: '',
  proxyUrl: '',
  limit: 5,
  bankId: '',
  codePayId: '',
  accountHolder: '',
  accountNo: '',
  amount: 100000,
  displayName: ''
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveSession(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}
