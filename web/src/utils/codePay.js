export function parseCodePayPayload(result) {
  if (!result) return null

  const candidates = [
    result?.data?.data?.data,
    result?.data?.data,
    result?.data,
    result?.depositInfo,
    result
  ].filter((item) => item && typeof item === 'object')

  for (const raw of candidates) {
    if (
      raw.codepay
      || raw.qrcode
      || raw.qrCode
      || raw.bankAccount
      || raw.bank_account
      || raw.amount
      || raw.expireAt
      || raw.expireIn
      || raw.message
      || raw.content
    ) {
      return normalizeCodePay(raw)
    }
  }

  return null
}

function pickString(...values) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim()
  }
  return ''
}

function parseTimestamp(value) {
  if (value == null || value === '') return null

  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const num = Number(value)
    if (!Number.isFinite(num) || num <= 0) return null
    return num < 1e12 ? num * 1000 : num
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeExpiresAt(raw) {
  const absolute = parseTimestamp(
    raw.expiresAt
    ?? raw.expireAt
    ?? raw.expiredAt
    ?? raw.expireTime
    ?? raw.expiredTime
    ?? raw.validTo
    ?? raw.validUntil
    ?? raw.endTime
    ?? raw.timeExpired
    ?? (typeof raw.expired === 'number' ? raw.expired : null)
  )

  if (absolute) return absolute

  const expireIn = Number(raw.expireIn ?? raw.expireInSeconds ?? raw.ttl)
  if (!Number.isFinite(expireIn) || expireIn <= 0) return null

  const base = parseTimestamp(raw.createdAt ?? raw.createTime ?? raw.createdTime) ?? Date.now()
  return base + expireIn * 1000
}

function normalizeCodePay(raw) {
  return {
    codepay: pickString(raw.codepay, raw.code, raw.codePay),
    qrcode: pickString(raw.qrcode, raw.qrCode, raw.qr_code),
    amount: raw.amount ?? raw.money ?? raw.transferAmount ?? null,
    bankName: pickString(raw.bankName, raw.bank_name, raw.bank, raw.bankLabel),
    accountName: pickString(
      raw.accountName,
      raw.account_name,
      raw.accountHolder,
      raw.holderName,
      raw.name,
      raw.receiverName
    ),
    bankAccount: pickString(
      raw.bankAccount,
      raw.bank_account,
      raw.accountNo,
      raw.accountNumber,
      raw.stk,
      raw.receiverAccount
    ),
    content: pickString(
      raw.content,
      raw.transferContent,
      raw.transfer_content,
      raw.description,
      raw.note,
      raw.noidung,
      raw.memo,
      raw.message,
      raw.transferMessage
    ),
    expiresAt: normalizeExpiresAt(raw)
  }
}

export function formatDepositAmount(amount) {
  if (amount == null || amount === '') return '—'
  const num = Number(amount)
  if (Number.isNaN(num)) return String(amount)
  return `${num.toLocaleString('vi-VN')} VND`
}

export function formatCodePayExpiry(expiresAtMs) {
  if (!expiresAtMs) return ''

  const date = new Date(expiresAtMs)
  if (Number.isNaN(date.getTime())) return ''

  const formatted = date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const remainMs = expiresAtMs - Date.now()
  if (remainMs <= 0) return `${formatted} · đã hết hạn`

  const remainMin = Math.max(1, Math.ceil(remainMs / 60000))
  return `${formatted} · còn ~${remainMin} phút`
}
