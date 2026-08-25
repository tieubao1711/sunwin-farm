const { getBankList } = require('../../src/banks')

const SUNWIN_BANKS = getBankList()

function toId(doc) {
  if (!doc) return null
  const obj = doc.toObject ? doc.toObject() : doc
  return { ...obj, id: String(obj._id), _id: undefined }
}

function resolveBankId(input) {
  const trimmed = (input || '').trim()
  if (!trimmed) return null

  const byId = SUNWIN_BANKS.find((bank) => bank.id === trimmed)
  if (byId) return byId

  const lower = trimmed.toLowerCase()
  const byName = SUNWIN_BANKS.find((bank) => bank.name.toLowerCase() === lower)
  if (byName) return byName

  const partial = SUNWIN_BANKS.find((bank) => (
    bank.name.toLowerCase().includes(lower) || lower.includes(bank.name.toLowerCase())
  ))
  return partial || null
}

function parseBankLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[|\t]/).map((part) => part.trim())
      const bank = resolveBankId(parts[0] || '')
      return {
        bankId: bank?.id || '',
        bankName: bank?.name || parts[0] || '',
        accountHolder: parts[1] || '',
        accountNo: parts[2] || '',
        note: parts[3] || '',
        raw: line,
        valid: Boolean(bank?.id && parts[1] && parts[2])
      }
    })
}

function countProxyUsage(accounts, proxyId) {
  return accounts.filter((acc) => String(acc.proxyId) === String(proxyId)).length
}

/** Proxy xoay: maxSlots <= 0 = không giới hạn (IP gateway đổi ~30p) */
function isProxyUnlimited(proxy) {
  const type = proxy?.type || 'rotating'
  if (type !== 'rotating') return false
  const max = proxy?.maxSlots
  return max == null || max <= 0
}

function getProxyRemainingSlots(accounts, proxy) {
  if (isProxyUnlimited(proxy)) return Number.MAX_SAFE_INTEGER
  const usage = countProxyUsage(accounts, proxy._id)
  return Math.max(0, (proxy.maxSlots || 0) - usage)
}

function pickProxy(proxies, accounts, defaultProxyId = null) {
  if (!proxies.length) return null

  const candidates = proxies.filter((proxy) => getProxyRemainingSlots(accounts, proxy) > 0)
  if (!candidates.length) return null

  if (defaultProxyId) {
    const preferred = candidates.find((proxy) => String(proxy._id) === String(defaultProxyId))
    if (preferred) return preferred
  }

  return candidates.reduce((best, proxy) => {
    const usage = countProxyUsage(accounts, proxy._id)
    const bestUsage = countProxyUsage(accounts, best._id)
    return usage < bestUsage ? proxy : best
  })
}

function getProxyStats(accounts, proxies) {
  const bound = accounts.filter((a) => a.proxyId).length
  const unlimited = proxies.some((p) => isProxyUnlimited(p))
  const capped = proxies.filter((p) => !isProxyUnlimited(p))
  const capacity = capped.reduce((sum, p) => sum + (p.maxSlots || 0), 0)
  const slotsFree = capped.reduce((sum, p) => sum + getProxyRemainingSlots(accounts, p), 0)

  return {
    proxyAccountsBound: bound,
    proxyUnlimited: unlimited,
    proxyCapacity: unlimited && capped.length === 0 ? null : capacity,
    proxySlotsFree: unlimited && capped.length === 0 ? null : slotsFree
  }
}

function generateUsername(existingSet) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let username = ''
    for (let i = 0; i < 8; i += 1) {
      username += chars[Math.floor(Math.random() * chars.length)]
    }
    if (!existingSet.has(username)) {
      existingSet.add(username)
      return username
    }
  }
  const fallback = `u${Date.now().toString(36).slice(-7)}`
  existingSet.add(fallback)
  return fallback
}

function getAccountStats(accounts, proxies) {
  return {
    total: accounts.length,
    pending: accounts.filter((a) => a.status === 'pending').length,
    registered: accounts.filter((a) => a.status === 'registered').length,
    bankPending: accounts.filter((a) => a.status === 'bank_pending').length,
    bankVerified: accounts.filter((a) => a.status === 'bank_verified').length,
    deposited: accounts.filter((a) => a.status === 'deposited').length,
    error: accounts.filter((a) => a.status === 'error').length,
    proxiesTotal: proxies.length,
    ...getProxyStats(accounts, proxies)
  }
}

async function logActivity(employeeName, action, entityType, entityId, detail) {
  const ActivityLog = require('../models/ActivityLog')
  await ActivityLog.create({
    employeeName: employeeName || 'system',
    action,
    entityType,
    entityId: entityId ? String(entityId) : '',
    detail: detail || ''
  })
}

async function getSettings() {
  const FarmSettings = require('../models/FarmSettings')
  let doc = await FarmSettings.findOne({ key: 'global' })
  if (!doc) {
    doc = await FarmSettings.create({ key: 'global' })
  }
  return doc
}

module.exports = {
  toId,
  resolveBankId,
  parseBankLines,
  countProxyUsage,
  isProxyUnlimited,
  getProxyRemainingSlots,
  pickProxy,
  getProxyStats,
  getAccountStats,
  logActivity,
  getSettings,
  generateUsername,
  SUNWIN_BANKS
}
