import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as farmApi from './farmApi'
import { parseProxyLines, pickProxy } from './store'

const EMPTY_STATE = {
  proxies: [],
  accounts: [],
  settings: {
    autoCheckBank: false,
    defaultPassword: 'abc123',
    depositAmount: 100000
  },
  stats: {
    total: 0,
    registered: 0,
    bankPending: 0,
    bankVerified: 0,
    deposited: 0,
    error: 0,
    proxiesTotal: 0,
    proxyCapacity: null,
    proxySlotsFree: null,
    proxyUnlimited: false,
    proxyAccountsBound: 0,
    bankAvailable: 0,
    bankReserved: 0,
    bankUsed: 0,
    banksTotal: 0,
    accountUnused: 0,
    accountUsed: 0
  }
}

const FarmContext = createContext(null)

export function FarmProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setError('')
      const data = await farmApi.fetchFarmState()
      setState(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const api = useMemo(() => ({
    state,
    stats: state.stats,
    loading,
    error,
    dbOk: !error,
    refresh,

    setSettings: async (patch) => {
      await farmApi.patchSettings(patch)
      await refresh()
    },

    importProxies: async (text) => {
      const result = await farmApi.importProxies(text)
      await refresh()
      return result.data?.added || 0
    },

    deleteProxy: async (proxyId) => {
      await farmApi.deleteProxy(proxyId)
      await refresh()
    },

    patchProxy: async (proxyId, patch) => {
      await farmApi.patchProxy(proxyId, patch)
      await refresh()
    },

    createAccount: async (payload) => {
      const result = await farmApi.createAccount(payload)
      await refresh()
      return result.data
    },

    createAccountsFromBankHolder: async (payload) => {
      const result = await farmApi.createAccountsFromBankHolder(payload)
      await refresh()
      return result.data
    },

    recreateAccounts: async (ids) => {
      const result = await farmApi.recreateAccounts(ids)
      await refresh()
      return result.data
    },

    createExtraAccounts: async (payload) => {
      const result = await farmApi.createExtraAccounts(payload)
      await refresh()
      return result.data
    },

    fetchBankSelectGroups: farmApi.fetchBankSelectGroups,

    patchAccount: async (accountId, patch) => {
      await farmApi.patchAccountApi(accountId, patch)
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.map((acc) => (
          acc.id === accountId ? { ...acc, ...patch } : acc
        ))
      }))
    },

    deleteAccount: async (accountId) => {
      await farmApi.deleteAccountApi(accountId)
      await refresh()
    },

    pickProxy: () => pickProxy(state),

    importBanks: async (text) => farmApi.importBanks(text),
    fetchBanks: farmApi.fetchBanks,
    fetchBanksGrouped: farmApi.fetchBanksGrouped,
    createBank: farmApi.createBank,
    patchBank: farmApi.patchBank,
    deleteBank: farmApi.deleteBank,
    reserveBank: farmApi.reserveBank,
    releaseBank: farmApi.releaseBank,
    assignBanksToAccounts: farmApi.assignBanksToAccounts,
    markBankUsed: farmApi.markBankUsed,
    fetchActivity: farmApi.fetchActivity,
    fetchEmployees: farmApi.fetchEmployees,

    parseProxyLines
  }), [state, loading, error, refresh])

  return (
    <FarmContext.Provider value={api}>
      {children}
    </FarmContext.Provider>
  )
}

export function useFarm() {
  const ctx = useContext(FarmContext)
  if (!ctx) throw new Error('useFarm must be used within FarmProvider')
  return ctx
}
