// Ngân hàng xác minh chính chủ (data.items)
const BANK_MAP = {
  '5c38a33f07d13c886978a2e1': 'Vietcombank',
  '5c4f2c84606041e424f47423': 'ACB',
  '5c4f2cb0606041e424f47832': 'BIDV',
  '5c4f2cda606041e424f47bfd': 'VikkiBank',
  '5c4f2d0b606041e424f48086': 'Sacombank',
  '5c4f2d31606041e424f4840d': 'Techcombank',
  '5c4f2d57606041e424f48781': 'VietinBank',
  '606fca9a34cff1095663ab35': 'Maritimebank',
  '606fcade34cff1095663ab65': 'SCB',
  '6139d3b734cff16a9eb27159': 'Eximbank',
  '6139d3c834cff16a9eb2715b': 'MBbank',
  '614c7a0434cff18c9af972cc': 'VPbank',
  '61517c5934cff1add969397d': 'VietCapital',
  '63770e1834cff12cbcbd8498': 'crypto',
  '638080ed34cff12cbcd0805b': 'SHB',
  '63d7998034cff16116edf35b': 'LPBank',
  '63e05e4934cff1f76a5c239d': 'TPbank',
  '641e7a1634cff1421d99d769': 'HDBank',
  '642981b834cff105eef75021': 'SeaBank',
  '642981d434cff105eef750eb': 'Wooribank',
  '6429821834cff105eef75182': 'PGbank',
  '6432eed534cff18b199ab237': 'ABBank',
  '6432eedd34cff18b199ab23f': 'OCB',
  '6433dfb934cff18b199cc01e': 'Kienlongbank',
  '6453997e34cff192f505f2d3': 'NamABank',
  '64a0202434cff1690a088c7a': 'NCB',
  '64a7c5ad34cff11048d29668': 'PVcombank',
  '65588f2734cff1f1b0859ec8': 'IndovinaBank',
  '6666ea5434cff107bcb105f8': 'BacABank',
  '673b156a34cff19257b17722': 'PublicBank',
  '673b162e34cff19257b187b7': 'VietBank'
};

// Kênh nạp CodePay (data.codepay) — khác bankId ngân hàng thường
const CODEPAY_MAP = {
  '69833b1a6b14962ff9289a5d': 'Napnhanh247'
};

function getBankNameById(bankId) {
  return BANK_MAP[bankId] || CODEPAY_MAP[bankId] || null;
}

function getBankList() {
  return Object.entries(BANK_MAP).map(([id, name]) => ({ id, name }));
}

function getCodePayList() {
  return Object.entries(CODEPAY_MAP).map(([id, name]) => ({ id, name }));
}

module.exports = {
  BANK_MAP,
  CODEPAY_MAP,
  getBankNameById,
  getBankList,
  getCodePayList
};
