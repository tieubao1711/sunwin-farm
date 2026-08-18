import { callApi } from '../api'

export const INSPECT_TABS = [
  { id: 'wallet', label: 'Số dư', endpoint: 'wallet', actionLabel: 'Wallet (WS)' },
  { id: 'banks', label: 'Bank', endpoint: 'fetch-bank-accounts', actionLabel: 'Bank Accounts' },
  { id: 'deposit', label: 'Lịch sử nạp', endpoint: 'deposit-history', actionLabel: 'Deposit History' },
  { id: 'withdraw', label: 'Lịch sử rút', endpoint: 'withdraw-history', actionLabel: 'Withdraw History' }
]

export function canInspectAccount(account) {
  const password = account?.password || account?.holderPassword
  return Boolean(account?.username && password)
}

export function getInspectPassword(account) {
  return account?.password || account?.holderPassword || ''
}

function normalizeInspectResult(tabId, result) {
  if (tabId === 'wallet') {
    return {
      ...result,
      data: {
        wallet: result.data?.wallet,
        walletInfo: result.data,
        wsMeta: result.data?.wsMeta
      }
    }
  }

  if (tabId === 'deposit') {
    return {
      ...result,
      data: {
        slipHistory: {
          deposit: result.data
        }
      }
    }
  }

  if (tabId === 'withdraw') {
    return {
      ...result,
      data: {
        slipHistory: {
          withdraw: result.data
        }
      }
    }
  }

  return result
}

export async function inspectAccount(account, proxyRaw, tabId, { limit = 10 } = {}) {
  const tab = INSPECT_TABS.find((item) => item.id === tabId)
  if (!tab) throw new Error('Tab tra cứu không hợp lệ')
  if (!canInspectAccount(account)) {
    throw new Error('Account thiếu username hoặc mật khẩu')
  }

  const payload = {
    username: account.username,
    password: getInspectPassword(account),
    proxyUrl: proxyRaw || '',
    limit
  }

  const result = await callApi(tab.endpoint, payload)
  return normalizeInspectResult(tabId, result)
}
