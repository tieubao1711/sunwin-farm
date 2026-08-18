const { SunwinClient } = require('./client');
const { BANK_MAP, CODEPAY_MAP, getBankNameById, getBankList, getCodePayList } = require('./banks');
const { SunwinWSSession, getWalletInfoFromWS, CMD_LABELS } = require('./ws');
const { normalizeProxyUrl } = require('./proxy');

module.exports = {
  SunwinClient,
  SunwinWSSession,
  getWalletInfoFromWS,
  CMD_LABELS,
  normalizeProxyUrl,
  BANK_MAP,
  CODEPAY_MAP,
  getBankNameById,
  getBankList,
  getCodePayList
};
