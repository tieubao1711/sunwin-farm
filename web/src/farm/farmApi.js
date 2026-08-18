const EMPLOYEE_KEY = 'sunwin-employee'

export function getEmployeeName() {
  return sessionStorage.getItem(EMPLOYEE_KEY) || ''
}

export function setEmployeeName(name) {
  sessionStorage.setItem(EMPLOYEE_KEY, name || '')
}

async function farmFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Employee-Name': getEmployeeName(),
    ...(options.headers || {})
  }

  const res = await fetch(`/api/farm${path}`, { ...options, headers })
  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()

  if (!contentType.includes('application/json')) {
    throw new Error(
      res.status === 503
        ? 'MongoDB chưa kết nối. Chạy MongoDB và kiểm tra MONGODB_URI.'
        : `Farm API lỗi (HTTP ${res.status})`
    )
  }

  const data = JSON.parse(text)
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

export function fetchFarmState() {
  return farmFetch('/state').then((res) => res.data)
}

export function patchSettings(patch) {
  return farmFetch('/settings', { method: 'PATCH', body: JSON.stringify(patch) })
}

export function importProxies(text, maxSlots) {
  return farmFetch('/proxies/import', { method: 'POST', body: JSON.stringify({ text, maxSlots }) })
}

export function patchProxy(proxyId, patch) {
  return farmFetch(`/proxies/${proxyId}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteProxy(proxyId) {
  return farmFetch(`/proxies/${proxyId}`, { method: 'DELETE' })
}

export function createAccountsFromBankHolder(payload) {
  return farmFetch('/accounts/from-bank-holder', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function fetchBankSelectGroups() {
  return farmFetch('/banks/select-groups').then((res) => res.data)
}

export function createAccount(payload) {
  return farmFetch('/accounts', { method: 'POST', body: JSON.stringify(payload) })
}

export function patchAccountApi(accountId, patch) {
  return farmFetch(`/accounts/${accountId}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteAccountApi(accountId) {
  return farmFetch(`/accounts/${accountId}`, { method: 'DELETE' })
}

export function fetchBanks(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return farmFetch(`/banks${qs ? `?${qs}` : ''}`).then((res) => res.data)
}

export function fetchBanksGrouped(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return farmFetch(`/banks/grouped${qs ? `?${qs}` : ''}`).then((res) => res.data)
}

export function createBank(payload) {
  return farmFetch('/banks', { method: 'POST', body: JSON.stringify(payload) })
}

export function importSheet(text, bankMeta = {}) {
  return farmFetch('/accounts/import-sheet', {
    method: 'POST',
    body: JSON.stringify({ text, ...bankMeta })
  })
}

export function fetchAccountsGrouped() {
  return farmFetch('/accounts/grouped').then((res) => res.data)
}

export function importBanks(text) {
  return farmFetch('/banks/import', { method: 'POST', body: JSON.stringify({ text }) })
}

export function patchBank(bankId, patch) {
  return farmFetch(`/banks/${bankId}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteBank(bankId) {
  return farmFetch(`/banks/${bankId}`, { method: 'DELETE' })
}

export function reserveBank(bankId) {
  return farmFetch(`/banks/${bankId}/reserve`, { method: 'POST' })
}

export function releaseBank(bankId) {
  return farmFetch(`/banks/${bankId}/release`, { method: 'POST' })
}

export function assignBanksToAccounts(accountIds, options = {}) {
  return farmFetch('/banks/assign-accounts', {
    method: 'POST',
    body: JSON.stringify({ accountIds, ...options })
  })
}

export function markBankUsed(bankId) {
  return farmFetch(`/banks/mark-used/${bankId}`, { method: 'POST' })
}

export function fetchActivity(limit = 50) {
  return farmFetch(`/activity?limit=${limit}`).then((res) => res.data)
}

export function fetchEmployees() {
  return farmFetch('/employees').then((res) => res.data)
}
