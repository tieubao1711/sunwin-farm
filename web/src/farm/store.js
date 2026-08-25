import { createId, FARM_STORAGE_KEY, DEFAULT_ROTATING_SLOTS } from './constants'

const DEFAULT_STATE = {
  proxies: [],
  accounts: [],
  settings: {
    autoCheckBank: false,
    defaultPassword: 'abc123',
    depositAmount: 100000,
    defaultProxyId: null
  }
}

function migrateProxy(proxy) {
  return {
    id: proxy.id,
    raw: proxy.raw,
    type: proxy.type || 'rotating',
    maxSlots: proxy.maxSlots ?? DEFAULT_ROTATING_SLOTS,
    createdAt: proxy.createdAt || Date.now()
  }
}

/** Proxy xoay: maxSlots <= 0 = không giới hạn (IP gateway đổi ~30p) */
export function isProxyUnlimited(proxy) {
  const type = proxy?.type || 'rotating'
  if (type !== 'rotating') return false
  const max = proxy?.maxSlots
  return max == null || max <= 0
}

export function countProxyUsage(state, proxyId) {
  return state.accounts.filter((acc) => acc.proxyId === proxyId).length
}

export function getProxyRemainingSlots(state, proxy) {
  if (isProxyUnlimited(proxy)) return Number.MAX_SAFE_INTEGER
  const usage = countProxyUsage(state, proxy.id)
  return Math.max(0, (proxy.maxSlots || 0) - usage)
}

export function getTotalProxyCapacity(state) {
  return state.proxies
    .filter((proxy) => !isProxyUnlimited(proxy))
    .reduce((sum, proxy) => sum + (proxy.maxSlots || 0), 0)
}

export function getAvailableProxySlots(state) {
  return state.proxies.reduce((sum, proxy) => {
    if (isProxyUnlimited(proxy)) return sum
    return sum + getProxyRemainingSlots(state, proxy)
  }, 0)
}

export function getProxyStats(state) {
  const proxies = state.proxies || []
  const bound = (state.accounts || []).filter((a) => a.proxyId).length
  const unlimited = proxies.some((p) => isProxyUnlimited(p))
  const capped = proxies.filter((p) => !isProxyUnlimited(p))
  const capacity = capped.reduce((sum, p) => sum + (p.maxSlots || 0), 0)
  const slotsFree = capped.reduce((sum, p) => sum + getProxyRemainingSlots(state, p), 0)

  return {
    proxyAccountsBound: bound,
    proxyUnlimited: unlimited,
    proxyCapacity: unlimited && capped.length === 0 ? null : capacity,
    proxySlotsFree: unlimited && capped.length === 0 ? null : slotsFree
  }
}

export function loadFarm() {
  try {
    const raw = localStorage.getItem(FARM_STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_STATE)
    const parsed = JSON.parse(raw)
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      proxies: (parsed.proxies || []).map(migrateProxy)
    }
  } catch {
    return structuredClone(DEFAULT_STATE)
  }
}

export function saveFarm(state) {
  localStorage.setItem(FARM_STORAGE_KEY, JSON.stringify(state))
}

export function parseProxyLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function maskProxy(raw) {
  if (!raw) return '—'
  const at = raw.lastIndexOf('@')
  if (at === -1) return raw.length > 20 ? `${raw.slice(0, 12)}...` : raw
  const creds = raw.slice(0, at)
  const host = raw.slice(at + 1)
  const user = creds.split(':')[0] || ''
  return `${user.slice(0, 8)}...@${host}`
}

export function getProxyById(state, proxyId) {
  return state.proxies.find((p) => p.id === proxyId)
}

export function addProxies(state, lines) {
  const existing = new Set(state.proxies.map((p) => p.raw))
  const added = []

  for (const raw of lines) {
    if (existing.has(raw)) continue
    existing.add(raw)
    added.push({
      id: createId(),
      raw,
      type: 'rotating',
      maxSlots: DEFAULT_ROTATING_SLOTS,
      createdAt: Date.now()
    })
  }

  return {
    ...state,
    proxies: [...state.proxies, ...added]
  }
}

export function updateProxy(state, proxyId, patch) {
  return {
    ...state,
    proxies: state.proxies.map((p) => (
      p.id === proxyId ? { ...p, ...patch } : p
    ))
  }
}

export function removeProxy(state, proxyId) {
  const usage = countProxyUsage(state, proxyId)
  if (usage > 0) {
    throw new Error(`Proxy đang phục vụ ${usage} tài khoản, không thể xóa`)
  }
  return {
    ...state,
    proxies: state.proxies.filter((p) => p.id !== proxyId)
  }
}

/** Chọn gateway xoay — ưu tiên gateway mặc định, rồi gateway ít account nhất */
export function pickProxy(state) {
  if (!state.proxies.length) return null

  const candidates = state.proxies.filter((proxy) => getProxyRemainingSlots(state, proxy) > 0)
  if (!candidates.length) return null

  const defaultId = state.settings?.defaultProxyId
  if (defaultId) {
    const preferred = candidates.find((proxy) => proxy.id === defaultId)
    if (preferred) return preferred
  }

  return candidates.reduce((best, proxy) => {
    const usage = countProxyUsage(state, proxy.id)
    const bestUsage = countProxyUsage(state, best.id)
    return usage < bestUsage ? proxy : best
  })
}

export function upsertAccount(state, account) {
  const idx = state.accounts.findIndex((a) => a.id === account.id)
  const accounts = [...state.accounts]
  if (idx >= 0) accounts[idx] = account
  else accounts.unshift(account)
  return { ...state, accounts }
}

export function updateAccount(state, accountId, patch) {
  return {
    ...state,
    accounts: state.accounts.map((acc) => (
      acc.id === accountId
        ? { ...acc, ...patch, updatedAt: Date.now() }
        : acc
    ))
  }
}

export function removeAccount(state, accountId) {
  return {
    ...state,
    accounts: state.accounts.filter((a) => a.id !== accountId)
  }
}

const USERNAME_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function generateUsername(existingAccounts = []) {
  const taken = new Set(
    existingAccounts.map((acc) => acc.username?.toLowerCase()).filter(Boolean)
  )

  for (let attempt = 0; attempt < 100; attempt += 1) {
    let username = ''
    for (let i = 0; i < 8; i += 1) {
      username += USERNAME_CHARS[Math.floor(Math.random() * USERNAME_CHARS.length)]
    }
    if (!taken.has(username)) return username
  }

  return `u${Date.now().toString(36).slice(-7)}`
}

export function buildDisplayName(username) {
  return `${username}d`
}

export function getAccountStats(state) {
  const list = state.accounts || []
  const proxies = state.proxies || []
  return {
    total: list.length,
    pending: list.filter((a) => a.status === 'pending').length,
    registered: list.filter((a) => a.status === 'registered').length,
    bankPending: list.filter((a) => a.status === 'bank_pending').length,
    bankVerified: list.filter((a) => a.status === 'bank_verified').length,
    deposited: list.filter((a) => a.status === 'deposited').length,
    error: list.filter((a) => a.status === 'error').length,
    proxiesTotal: proxies.length,
    ...getProxyStats(state)
  }
}
