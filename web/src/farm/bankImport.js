import { BANK_LIST } from '../banks'

export function resolveBankId(input) {
  const trimmed = (input || '').trim()
  if (!trimmed) return null

  const byId = BANK_LIST.find((bank) => bank.id === trimmed)
  if (byId) return byId.id

  const lower = trimmed.toLowerCase()
  const byName = BANK_LIST.find((bank) => bank.name.toLowerCase() === lower)
  if (byName) return byName.id

  const partial = BANK_LIST.find((bank) => (
    bank.name.toLowerCase().includes(lower) || lower.includes(bank.name.toLowerCase())
  ))
  return partial?.id || null
}

export function parseBankLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[|\t]/).map((part) => part.trim())
      const bankId = resolveBankId(parts[0] || '')
      return {
        bankId,
        bankLabel: parts[0] || '',
        accountHolder: parts[1] || '',
        accountNo: parts[2] || '',
        raw: line,
        valid: Boolean(bankId && parts[1] && parts[2])
      }
    })
}

export function accountHasBank(account) {
  return Boolean(account.accountHolder && account.accountNo)
}

export function applyBankLinesToAccounts(accounts, lines) {
  const patches = []
  const count = Math.min(accounts.length, lines.length)

  for (let i = 0; i < count; i += 1) {
    const line = lines[i]
    if (!line.valid) continue
    patches.push({
      accountId: accounts[i].id,
      patch: {
        bankId: line.bankId,
        accountHolder: line.accountHolder,
        accountNo: line.accountNo,
        lastError: ''
      }
    })
  }

  return {
    patches,
    matched: patches.length,
    skipped: lines.length - patches.filter((_, idx) => idx < count && lines[idx].valid).length
  }
}
