export function formatWalletShort(lastWallet) {
  if (!lastWallet) return null

  const parts = []
  if (lastWallet.gold != null && lastWallet.gold !== '') {
    parts.push(`${Number(lastWallet.gold).toLocaleString('vi-VN')} G`)
  }
  if (lastWallet.chip != null && lastWallet.chip !== '') {
    parts.push(`${Number(lastWallet.chip).toLocaleString('vi-VN')} C`)
  }

  return parts.length ? parts.join(' · ') : null
}

export function extractWalletFromResult(result) {
  const raw = result?.data?.walletInfo?.wallet || result?.data?.wallet || null
  if (!raw || typeof raw !== 'object') return null

  const gold = Number(raw.gold)
  const chip = Number(raw.chip)
  if (!Number.isFinite(gold) && !Number.isFinite(chip)) return null

  return {
    gold: Number.isFinite(gold) ? gold : 0,
    chip: Number.isFinite(chip) ? chip : 0,
    vip: raw.vip ?? null,
    safe: Number.isFinite(Number(raw.safe)) ? Number(raw.safe) : null
  }
}
