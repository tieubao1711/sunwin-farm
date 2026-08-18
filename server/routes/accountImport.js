/** Parse paste từ Excel — format giống ảnh mẫu của user */

function isPasswordLine(line) {
  return line.includes('@') || /^[^\s|]+\d+$/.test(line)
}

function isUsedMarker(value) {
  if (!value) return false
  return /^x$/i.test(String(value).trim())
}

function parseLine(line) {
  if (line.includes('\t')) {
    return line.split('\t').map((part) => part.trim())
  }
  if (line.includes('|')) {
    return line.split('|').map((part) => part.trim())
  }
  if (line.includes(';')) {
    return line.split(';').map((part) => part.trim())
  }
  return [line.trim()]
}

function normalizeHolderName(line) {
  return line.trim().replace(/\s+/g, ' ').toUpperCase()
}

/**
 * Hỗ trợ dán block từ Excel:
 *
 * BUI THI LAN
 *   username    STK    x
 *   ...
 * trangvaden123@
 *
 * Hoặc:
 * BUI THI LAN | trangvaden123@
 * username | STK
 * username | STK | x
 */
function parseAccountBlocks(text, defaultBank = { bankId: '', bankName: 'Vietcombank' }) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const groups = []
  let current = null

  function flush() {
    if (current && current.rows.length > 0) {
      groups.push(current)
    }
    current = null
  }

  for (const rawLine of lines) {
    const parts = parseLine(rawLine).filter(Boolean)
    if (parts.length === 0) continue

    // Dòng: CHỦ KHOẢN | mật khẩu
    if (parts.length === 2 && !/^\d+$/.test(parts[1]) && isPasswordLine(parts[1])) {
      flush()
      current = {
        accountHolder: normalizeHolderName(parts[0]),
        holderPassword: parts[1],
        rows: []
      }
      continue
    }

    // Dòng: CHỦ KHOẢN (tên in hoa, không có STK dạng số dài ở cột 2)
    if (parts.length === 1 && /^[A-ZÀ-Ỹ\s]+$/.test(parts[0]) && parts[0].length > 3) {
      flush()
      current = {
        accountHolder: normalizeHolderName(parts[0]),
        holderPassword: '',
        rows: []
      }
      continue
    }

    // Dòng mật khẩu cuối block
    if (parts.length === 1 && isPasswordLine(parts[0]) && current) {
      current.holderPassword = parts[0]
      continue
    }

    // Dòng account: username | STK | x?
    if (parts.length >= 2) {
      if (!current) {
        current = {
          accountHolder: 'CHUA CO TEN',
          holderPassword: '',
          rows: []
        }
      }

      const username = parts[0]
      const accountNo = parts[1]
      const usedFlag = parts[2] ? isUsedMarker(parts[2]) : false

      if (!username || !accountNo) continue

      current.rows.push({
        username: username.toLowerCase(),
        accountNo,
        usageStatus: usedFlag ? 'used' : 'unused',
        password: current.holderPassword || '',
        accountHolder: current.accountHolder,
        bankId: defaultBank.bankId,
        bankName: defaultBank.bankName
      })
    }
  }

  flush()

  // Gán password cho từng row sau khi biết holderPassword
  for (const group of groups) {
    for (const row of group.rows) {
      row.password = group.holderPassword || row.password
      row.accountHolder = group.accountHolder
    }
  }

  const accounts = groups.flatMap((group) => group.rows)
  return { groups, accounts }
}

module.exports = { parseAccountBlocks }
