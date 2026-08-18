// Ngân hàng xác minh chính chủ (data.items)
export const BANK_LIST = [
  { id: '5c38a33f07d13c886978a2e1', name: 'Vietcombank' },
  { id: '5c4f2c84606041e424f47423', name: 'ACB' },
  { id: '5c4f2cb0606041e424f47832', name: 'BIDV' },
  { id: '5c4f2cda606041e424f47bfd', name: 'VikkiBank' },
  { id: '5c4f2d0b606041e424f48086', name: 'Sacombank' },
  { id: '5c4f2d31606041e424f4840d', name: 'Techcombank' },
  { id: '5c4f2d57606041e424f48781', name: 'VietinBank' },
  { id: '606fca9a34cff1095663ab35', name: 'Maritimebank' },
  { id: '606fcade34cff1095663ab65', name: 'SCB' },
  { id: '6139d3b734cff16a9eb27159', name: 'Eximbank' },
  { id: '6139d3c834cff16a9eb2715b', name: 'MBbank' },
  { id: '614c7a0434cff18c9af972cc', name: 'VPbank' },
  { id: '61517c5934cff1add969397d', name: 'VietCapital' },
  { id: '63770e1834cff12cbcbd8498', name: 'crypto' },
  { id: '638080ed34cff12cbcd0805b', name: 'SHB' },
  { id: '63d7998034cff16116edf35b', name: 'LPBank' },
  { id: '63e05e4934cff1f76a5c239d', name: 'TPbank' },
  { id: '641e7a1634cff1421d99d769', name: 'HDBank' },
  { id: '642981b834cff105eef75021', name: 'SeaBank' },
  { id: '642981d434cff105eef750eb', name: 'Wooribank' },
  { id: '6429821834cff105eef75182', name: 'PGbank' },
  { id: '6432eed534cff18b199ab237', name: 'ABBank' },
  { id: '6432eedd34cff18b199ab23f', name: 'OCB' },
  { id: '6433dfb934cff18b199cc01e', name: 'Kienlongbank' },
  { id: '6453997e34cff192f505f2d3', name: 'NamABank' },
  { id: '64a0202434cff1690a088c7a', name: 'NCB' },
  { id: '64a7c5ad34cff11048d29668', name: 'PVcombank' },
  { id: '65588f2734cff1f1b0859ec8', name: 'IndovinaBank' },
  { id: '6666ea5434cff107bcb105f8', name: 'BacABank' },
  { id: '673b156a34cff19257b17722', name: 'PublicBank' },
  { id: '673b162e34cff19257b187b7', name: 'VietBank' }
]

// Kênh nạp CodePay (data.codepay)
export const CODEPAY_LIST = [
  { id: '69833b1a6b14962ff9289a5d', name: 'Napnhanh247' },
  { id: '6a4c32086b14962ff9fc196c', name: 'OnePay' },
  { id: '6a4c32156b14962ff9fcbdeb', name: 'QRPay' },
  { id: '6a4c321d6b14962ff9fd14ea', name: 'Smartpay' },
  { id: '6a4c32266b14962ff9fd74ac', name: 'VNPay' },
  { id: '6a4c322d6b14962ff9fdc57c', name: 'NowPay' },
  { id: '6a4c32356b14962ff9fe2286', name: 'FlexPay' },
  { id: '6a4c323b6b14962ff9fe63ef', name: 'EPay' }
]

export const DEFAULT_BANK_ID = BANK_LIST[0].id
export const DEFAULT_CODEPAY_ID = CODEPAY_LIST[0].id

export function getBankNameById(bankId) {
  return BANK_LIST.find((bank) => bank.id === bankId)?.name
    || CODEPAY_LIST.find((bank) => bank.id === bankId)?.name
    || null
}

/** Hiển thị kiểu Excel: Vietcombank - NGUYEN VAN A */
export function formatBankHolderLabel(bankName, bankId, accountHolder) {
  const bank = (bankName || getBankNameById(bankId) || '').trim()
  const holder = (accountHolder || '').trim().replace(/\s+/g, ' ')
  if (bank && holder) return `${bank} - ${holder}`
  return bank || holder || '—'
}
