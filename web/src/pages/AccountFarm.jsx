import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { callApi } from '../api'
import { BankSelect } from '../BankSelect'
import { StatusBadge } from '../components/StatusBadge'
import { DEFAULT_BANK_ID, CODEPAY_LIST, DEFAULT_CODEPAY_ID, formatBankHolderLabel, getBankNameById } from '../banks'
import { BankEditModal } from '../components/BankEditModal'
import { DepositInfoPanel } from '../components/DepositInfoPanel'
import { WalletCell } from '../components/WalletCell'
import { AccountInspectModal } from '../components/AccountInspectModal'
import { InspectMenu } from '../components/InspectMenu'
import { inspectAccount } from '../farm/accountInspect'
import { parseCodePayPayload } from '../utils/codePay'
import { extractWalletFromResult } from '../utils/wallet'
import { accountHasBank } from '../farm/bankImport'
import { useFarm } from '../farm/FarmProvider'
import {
  buildDisplayName,
  getProxyById,
  maskProxy,
  pickProxy
} from '../farm/store'

const STEPS = [
  { id: 1, title: 'Chọn kho bank', desc: 'STK → tạo account' },
  { id: 2, title: 'Đăng ký', desc: 'Register Sunwin' },
  { id: 3, title: 'Verify bank', desc: 'Liên kết STK' },
  { id: 4, title: 'Kiểm tra', desc: 'Theo dõi duyệt' },
  { id: 5, title: 'Nạp tiền', desc: 'Tạo mã QR' }
]

function suggestStep(stats) {
  if (stats.total === 0) return 1
  if (stats.pending > 0 || stats.error > 0) return 2
  if (stats.registered > 0) return 3
  if (stats.bankPending > 0) return 4
  if (stats.bankVerified > 0 || stats.deposited > 0) return 5
  return 5
}

function stepCount(stepId, stats) {
  if (stepId === 1) return stats.banksTotal || 0
  if (stepId === 2) return stats.pending + stats.error
  if (stepId === 3) return stats.registered + stats.bankPending
  if (stepId === 4) return stats.bankPending
  if (stepId === 5) return stats.bankVerified + stats.deposited
  return 0
}

function canDepositAccount(acc) {
  return ['registered', 'bank_pending', 'bank_verified'].includes(acc.status)
    && acc.username && acc.password
}

function canRetryVerify(acc) {
  return accountHasBank(acc)
    && acc.username
    && (acc.status === 'registered' || acc.status === 'bank_pending')
}

function isCompletedAccount(acc) {
  return acc.status === 'bank_verified' || acc.status === 'deposited'
}

function getStepAccounts(accounts, stepId) {
  if (stepId === 1) return accounts.filter((acc) => !isCompletedAccount(acc))
  if (stepId === 2) return accounts.filter((acc) => (acc.status === 'pending' || acc.status === 'error') && accountHasBank(acc))
  if (stepId === 3) return accounts.filter(canRetryVerify)
  if (stepId === 4) return accounts.filter((acc) => acc.status === 'bank_pending')
  if (stepId === 5) return accounts.filter((acc) => acc.status === 'bank_verified' || acc.status === 'deposited')
  return accounts
}

function matchesBankGroup(account, group) {
  if (!group?.bankId || !group?.accountHolder) return false
  return account.bankId === group.bankId
    && (account.accountHolder || '').toUpperCase() === group.accountHolder.toUpperCase()
}

const BATCH_STORAGE_KEY = 'sunwin-farm-batch'

function loadActiveBatch() {
  try {
    const raw = sessionStorage.getItem(BATCH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveActiveBatch(batch) {
  if (batch?.bankId && batch?.accountHolder) {
    sessionStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batch))
  } else {
    sessionStorage.removeItem(BATCH_STORAGE_KEY)
  }
}

function parseGroupKey(key) {
  if (!key) return null
  const sep = key.indexOf('|')
  if (sep <= 0) return null
  const bankId = key.slice(0, sep)
  const accountHolder = key.slice(sep + 1)
  if (!accountHolder) return null
  return {
    bankId,
    bankName: getBankNameById(bankId) || '',
    accountHolder
  }
}

export function AccountFarm() {
  const {
    state,
    stats,
    loading,
    error,
    patchAccount,
    deleteAccount,
    refresh,
    fetchBankSelectGroups,
    createAccountsFromBankHolder,
    recreateAccounts,
    createExtraAccounts
  } = useFarm()
  const stateRef = useRef(state)
  stateRef.current = state

  const [activeStep, setActiveStep] = useState(() => suggestStep(stats))
  const [bankGroups, setBankGroups] = useState([])
  const [activeBatch, setActiveBatch] = useState(loadActiveBatch)
  const [selectedGroupKey, setSelectedGroupKey] = useState(() => {
    const batch = loadActiveBatch()
    return batch ? `${batch.bankId}|${batch.accountHolder}` : ''
  })
  const [holderPassword, setHolderPassword] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bankModal, setBankModal] = useState(null)
  const [depositModal, setDepositModal] = useState(null)
  const [inspectModal, setInspectModal] = useState(null)
  const [walletLoading, setWalletLoading] = useState(() => new Set())
  const [lastPollAt, setLastPollAt] = useState(null)
  const [extraCount, setExtraCount] = useState(1)
  const [extraBankKey, setExtraBankKey] = useState('')

  const batchNum = Number(state.settings.batchSize) || 100
  const hasProxy = stats.proxiesTotal > 0
  const proxyUnlimited = stats.proxyUnlimited
  const proxyOk = hasProxy

  const selectedGroup = useMemo(
    () => bankGroups.find((g) => `${g.bankId}|${g.accountHolder}` === selectedGroupKey) || null,
    [bankGroups, selectedGroupKey]
  )

  const effectiveBatch = useMemo(() => {
    if (activeBatch?.bankId && activeBatch?.accountHolder) return activeBatch
    if (selectedGroup) {
      return {
        bankId: selectedGroup.bankId,
        bankName: selectedGroup.bankName,
        accountHolder: selectedGroup.accountHolder
      }
    }
    return parseGroupKey(selectedGroupKey)
  }, [activeBatch, selectedGroup, selectedGroupKey])

  const batchAccounts = useMemo(
    () => state.accounts.filter((acc) => matchesBankGroup(acc, effectiveBatch)),
    [state.accounts, effectiveBatch]
  )
  const batchStats = useMemo(() => {
    const next = {
      total: batchAccounts.length,
      pending: 0,
      error: 0,
      registered: 0,
      bankPending: 0,
      bankVerified: 0,
      deposited: 0,
      banksTotal: selectedGroup?.stkCount || batchAccounts.length
    }
    for (const acc of batchAccounts) {
      if (acc.status === 'pending') next.pending += 1
      else if (acc.status === 'error') next.error += 1
      else if (acc.status === 'registered') next.registered += 1
      else if (acc.status === 'bank_pending') next.bankPending += 1
      else if (acc.status === 'bank_verified') next.bankVerified += 1
      else if (acc.status === 'deposited') next.deposited += 1
    }
    return next
  }, [batchAccounts, selectedGroup])
  const stepScopedAccounts = useMemo(
    () => getStepAccounts(batchAccounts, activeStep),
    [batchAccounts, activeStep]
  )
  const stepScopedIds = useMemo(
    () => new Set(stepScopedAccounts.map((acc) => acc.id)),
    [stepScopedAccounts]
  )

  const extraBankOptions = useMemo(() => {
    const map = new Map()
    for (const acc of batchAccounts) {
      if (!acc.accountNo) continue
      const key = `${acc.bankId}|${acc.accountNo}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          bankId: acc.bankId,
          bankName: acc.bankName,
          accountHolder: acc.accountHolder,
          accountNo: acc.accountNo,
          bankRecordId: acc.bankRecordId,
          sourceAccountId: acc.id
        })
      }
    }
    return [...map.values()]
  }, [batchAccounts])

  useEffect(() => {
    if (extraBankOptions.length === 0) return
    const selectedAcc = batchAccounts.find((acc) => selected.has(acc.id) && acc.accountNo)
    const preferred = selectedAcc
      ? `${selectedAcc.bankId}|${selectedAcc.accountNo}`
      : extraBankOptions[0].key
    if (!extraBankKey || !extraBankOptions.some((opt) => opt.key === extraBankKey)) {
      setExtraBankKey(preferred)
    }
  }, [extraBankOptions, extraBankKey, selected, batchAccounts])

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => batchAccounts.some((acc) => acc.id === id)))
      return next.size === prev.size ? prev : next
    })
  }, [batchAccounts])

  useEffect(() => {
    if (!effectiveBatch?.bankId || !effectiveBatch?.accountHolder) return
    setActiveStep(suggestStep(batchStats))
  }, [effectiveBatch?.bankId, effectiveBatch?.accountHolder])

  function applyBatchSelection(group) {
    if (!group) {
      setSelectedGroupKey('')
      setActiveBatch(null)
      saveActiveBatch(null)
      return
    }
    const batch = {
      bankId: group.bankId,
      bankName: group.bankName || getBankNameById(group.bankId) || '',
      accountHolder: group.accountHolder
    }
    setSelectedGroupKey(`${batch.bankId}|${batch.accountHolder}`)
    setActiveBatch(batch)
    saveActiveBatch(batch)
  }

  useEffect(() => {
    if (!loading) {
      fetchBankSelectGroups()
        .then((groups) => {
          setBankGroups(groups)
          if (groups.length === 1 && !activeBatch) {
            applyBatchSelection(groups[0])
          }
        })
        .catch(() => setBankGroups([]))
    }
  }, [loading, stats.banksTotal, fetchBankSelectGroups])

  useEffect(() => {
    if (activeBatch || loading || state.accounts.length === 0) return
    const recent = [...state.accounts]
      .filter((a) => a.bankId && a.accountHolder)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
    if (recent) {
      applyBatchSelection({
        bankId: recent.bankId,
        bankName: recent.bankName || getBankNameById(recent.bankId),
        accountHolder: recent.accountHolder
      })
    }
  }, [loading, state.accounts, activeBatch])

  useEffect(() => {
    setHolderPassword(state.settings.defaultPassword || 'abc123')
  }, [state.settings.defaultPassword])

  function proxyStatusText() {
    if (!hasProxy) return null
    if (proxyUnlimited) {
      const bound = stats.proxyAccountsBound ?? 0
      return `✓ ${stats.proxiesTotal} gateway xoay · ${bound} account · IP đổi ~30p · không giới hạn`
    }
    return `✓ ${stats.proxiesTotal} gateway · còn ${stats.proxySlotsFree} slot`
  }

  const pendingAccounts = batchAccounts.filter(
    (a) => (a.status === 'pending' || a.status === 'error') && accountHasBank(a)
  )
  const verifyTargets = useMemo(() => {
    const retryable = batchAccounts.filter(canRetryVerify)
    if (selected.size > 0) {
      return retryable.filter((a) => selected.has(a.id))
    }
    return retryable
  }, [batchAccounts, selected])

  const readyForVerify = verifyTargets.length
  const checkBankForAccount = useCallback(async (account) => {
    const proxy = getProxyById(stateRef.current, account.proxyId)
    try {
      const result = await callApi('fetch-bank-accounts', {
        username: account.username,
        password: account.password,
        proxyUrl: proxy?.raw
      })

      const verified = result?.data?.verifiedBankAccounts || []
      const holders = result?.data?.verifiedAccountHolder || []

      if (verified.length > 0) {
        await patchAccount(account.id, {
          status: 'bank_verified',
          usageStatus: 'unused',
          verifiedBankAccounts: verified,
          verifiedAccountHolder: holders,
          lastCheckAt: Date.now(),
          lastError: ''
        })
        return true
      }

      await patchAccount(account.id, {
        verifiedBankAccounts: verified,
        verifiedAccountHolder: holders,
        lastCheckAt: Date.now(),
        lastError: ''
      })
      return false
    } catch (err) {
      await patchAccount(account.id, {
        lastCheckAt: Date.now(),
        lastError: err.message
      })
      return false
    }
  }, [patchAccount])

  const recreateTargets = useMemo(() => {
    const pool = selected.size > 0
      ? batchAccounts.filter((a) => selected.has(a.id))
      : batchAccounts.filter((a) => a.lastError && a.status !== 'bank_verified')
    return pool.filter((a) => a.status !== 'bank_verified')
  }, [batchAccounts, selected])

  async function handleRecreateSelected() {
    const ids = recreateTargets.map((a) => a.id)
    if (ids.length === 0) return

    setRunning(true)
    setProgress({ label: `Đang tạo ${ids.length} username mới (giữ STK)...` })
    try {
      const result = await recreateAccounts(ids)
      const skipped = result.skipped?.length || 0
      setSelected(new Set())
      setProgress({
        label: `Đã tạo lại ${result.created} acc${skipped ? ` · ${skipped} bỏ qua (Bank OK)` : ''} — đăng ký lại ở bước 2`
      })
      if (result.created > 0) setActiveStep(2)
    } catch (err) {
      setProgress({ label: err.message })
    } finally {
      setRunning(false)
    }
  }

  async function handleAddExtraAccounts() {
    const option = extraBankOptions.find((item) => item.key === extraBankKey) || extraBankOptions[0]
    if (!option) {
      setProgress({ label: 'Chọn STK để trùng bank' })
      return
    }

    setRunning(true)
    setProgress({ label: `Đang tạo ${extraCount} acc random trùng STK ${option.accountNo}...` })
    try {
      const result = await createExtraAccounts({
        count: Number(extraCount) || 1,
        password: holderPassword,
        sourceAccountId: option.sourceAccountId,
        bankId: option.bankId,
        bankName: option.bankName,
        accountHolder: option.accountHolder,
        accountNo: option.accountNo,
        bankRecordId: option.bankRecordId
      })
      setProgress({ label: `Đã thêm ${result.created} acc mới · username random · trùng bank ${option.accountNo}` })
      if (result.created > 0) setActiveStep(2)
    } catch (err) {
      setProgress({ label: err.message })
    } finally {
      setRunning(false)
    }
  }

  async function handleCreateFromBank() {
    const group = selectedGroup || effectiveBatch
    if (!group?.accountHolder || !group?.bankId) return

    setRunning(true)
    const stkCount = selectedGroup?.stkCount || batchAccounts.length || '?'
    setProgress({ label: `Đang tạo account từ kho (${group.accountHolder})...` })

    try {
      const result = await createAccountsFromBankHolder({
        accountHolder: group.accountHolder,
        bankId: group.bankId,
        password: holderPassword,
        allowReuse: true
      })
      const skipped = result.skipped?.length || 0
      applyBatchSelection({
        bankId: group.bankId,
        bankName: group.bankName || getBankNameById(group.bankId),
        accountHolder: group.accountHolder
      })
      setProgress({
        label: `Đã tạo ${result.created} account${result.reuseMode ? ' · dùng lại STK đã có' : ''}${skipped ? ` · ${skipped} lỗi/trùng` : ''}`
      })
      const groups = await fetchBankSelectGroups()
      setBankGroups(groups)
      if (result.created > 0) setActiveStep(2)
    } catch (err) {
      setProgress({ label: err.message })
    } finally {
      setRunning(false)
    }
  }

  async function handleBatchRegister() {
    const queue = (selected.size > 0
      ? pendingAccounts.filter((a) => selected.has(a.id))
      : pendingAccounts
    ).slice(0, batchNum)

    if (queue.length === 0 || !proxyOk) return

    setRunning(true)
    setProgress({ current: 0, total: queue.length, label: 'Đang chuẩn bị...' })

    let currentState = stateRef.current
    let ok = 0
    let fail = 0

    for (let i = 0; i < queue.length; i += 1) {
      const account = queue[i]
      const proxy = pickProxy(currentState)
      if (!proxy) {
        setProgress({ current: i, total: queue.length, label: `Dừng — không có gateway (${i}/${queue.length})` })
        break
      }

      const accPassword = account.password || account.holderPassword || holderPassword
      const displayName = account.displayName || buildDisplayName(account.username)

      setProgress({ current: i + 1, total: queue.length, label: `Đăng ký ${account.username}...` })

      try {
        const result = await callApi('register', {
          username: account.username,
          password: accPassword,
          displayName,
          proxyUrl: proxy.raw
        })

        if (!result.success) {
          fail += 1
          await patchAccount(account.id, {
            status: 'error',
            lastError: result.message || 'Register failed'
          })
          continue
        }

        await patchAccount(account.id, {
          password: accPassword,
          displayName,
          proxyId: proxy.id,
          status: 'registered',
          lastError: ''
        })

        ok += 1
        currentState = await refresh()
      } catch (err) {
        fail += 1
        await patchAccount(account.id, { status: 'error', lastError: err.message })
      }
    }

    setProgress({ current: queue.length, total: queue.length, label: `Hoàn tất — ${ok} OK · ${fail} lỗi (có thể chạy lại acc lỗi)` })
    setRunning(false)
    if (ok > 0) setActiveStep(3)
  }

  async function saveBankModal() {
    if (!bankModal) return
    await patchAccount(bankModal.account.id, {
      bankId: bankModal.form.bankId,
      bankName: getBankNameById(bankModal.form.bankId) || '',
      accountHolder: bankModal.form.accountHolder,
      accountNo: bankModal.form.accountNo,
      lastError: ''
    })
    setBankModal(null)
  }

  function openBankModal(account) {
    setBankModal({
      account,
      form: {
        bankId: account.bankId || DEFAULT_BANK_ID,
        accountHolder: account.accountHolder || '',
        accountNo: account.accountNo || ''
      }
    })
  }

  async function verifyOneAccount(account) {
    const proxy = getProxyById(stateRef.current, account.proxyId)
    const result = await callApi('verify-bank-account', {
      username: account.username,
      password: account.password || account.holderPassword,
      proxyUrl: proxy?.raw,
      bankId: account.bankId || DEFAULT_BANK_ID,
      accountHolder: account.accountHolder,
      accountNo: account.accountNo
    })

    if (result?.success === false) {
      const message = result.message || result.data?.message || result.data?.data?.message || 'Verify bank thất bại'
      throw new Error(message)
    }

    await patchAccount(account.id, {
      status: 'bank_pending',
      usageStatus: 'unused',
      lastError: ''
    })
  }

  async function handleVerifySelected() {
    const targets = verifyTargets.filter(canRetryVerify)
    if (targets.length === 0) return

    setRunning(true)
    setProgress({ current: 0, total: targets.length, label: 'Đang gửi verify bank...' })

    let ok = 0
    let fail = 0

    for (let i = 0; i < targets.length; i += 1) {
      const account = targets[i]
      setProgress({ current: i + 1, total: targets.length, label: `Verify: ${account.username}` })

      try {
        await verifyOneAccount(account)
        ok += 1
      } catch (err) {
        fail += 1
        await patchAccount(account.id, { lastError: err.message })
      }
    }

    await refresh()

    setProgress({
      current: targets.length,
      total: targets.length,
      label: `Verify xong — ${ok} gửi được · ${fail} lỗi (bấm Gửi lại hoặc Verify lại từng dòng)`
    })
    setRunning(false)
    if (ok > 0) setActiveStep(4)
  }

  async function handleRetryVerify(account) {
    if (running || !canRetryVerify(account)) return
    setRunning(true)
    setProgress({ label: `Verify lại: ${account.username}` })
    try {
      await verifyOneAccount(account)
      setProgress({ label: `Đã gửi lại verify: ${account.username}` })
    } catch (err) {
      await patchAccount(account.id, { lastError: err.message })
      setProgress({ label: `Verify lỗi: ${err.message}` })
    } finally {
      setRunning(false)
    }
  }

  async function handleManualCheckAll() {
    const pending = batchAccounts.filter((a) => a.status === 'bank_pending')
    if (pending.length === 0) return

    setRunning(true)
    setProgress({ current: 0, total: pending.length, label: 'Đang kiểm tra...' })

    for (let i = 0; i < pending.length; i += 1) {
      setProgress({ current: i + 1, total: pending.length, label: `Kiểm tra: ${pending[i].username}` })
      await checkBankForAccount(pending[i])
    }

    setLastPollAt(Date.now())
    setProgress({ current: pending.length, total: pending.length, label: `Đã kiểm tra ${pending.length} tài khoản` })
    setRunning(false)
  }

  async function handleDeposit(account) {
    const proxy = getProxyById(state, account.proxyId)
    setRunning(true)
    setProgress({ label: `Tạo lệnh nạp: ${account.username}...` })

    try {
      const result = await callApi('create-code-pay', {
        username: account.username,
        password: account.password,
        proxyUrl: proxy?.raw,
        bankAccountId: depositModal?.codePayId || DEFAULT_CODEPAY_ID,
        bankId: depositModal?.codePayId || DEFAULT_CODEPAY_ID,
        amount: Number(depositModal?.amount) || state.settings.depositAmount
      })

      const payload = parseCodePayPayload(result)
      await patchAccount(account.id, {
        depositInfo: payload || result?.data?.data || result?.data,
        lastError: ''
      })
      setDepositModal((prev) => ({ ...prev, result, account }))
    } catch (err) {
      await patchAccount(account.id, { lastError: err.message })
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  function openInspect(account, tab) {
    setInspectModal({ account, tab })
  }

  async function saveWalletSnapshot(accountId, wallet) {
    if (!wallet) return
    await patchAccount(accountId, {
      lastWallet: wallet,
      lastWalletAt: Date.now()
    })
  }

  async function refreshWallet(account) {
    const proxy = getProxyById(stateRef.current, account.proxyId)
    setWalletLoading((prev) => new Set(prev).add(account.id))

    try {
      const result = await inspectAccount(account, proxy?.raw, 'wallet')
      const wallet = extractWalletFromResult(result)
      if (wallet) {
        await saveWalletSnapshot(account.id, wallet)
      }
    } catch (err) {
      await patchAccount(account.id, { lastError: err.message })
    } finally {
      setWalletLoading((prev) => {
        const next = new Set(prev)
        next.delete(account.id)
        return next
      })
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (stepScopedAccounts.length === 0) {
      setSelected(new Set())
      return
    }
    const allStepSelected = stepScopedAccounts.every((acc) => selected.has(acc.id))
    if (allStepSelected) {
      setSelected((prev) => new Set([...prev].filter((id) => !stepScopedIds.has(id))))
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      for (const acc of stepScopedAccounts) next.add(acc.id)
      return next
    })
  }

  const progressPct = progress?.total
    ? Math.round((progress.current / progress.total) * 100)
    : null

  const stepPanel = useMemo(() => {
    const extraPanel = extraBankOptions.length > 0 ? (
      <div className="extra-acc-box">
        <h4>Thêm acc mới</h4>
        <p className="step-desc">
          Acc mãi không verify được → tạo username random, <strong>được trùng STK</strong> đang dùng.
        </p>
        <div className="form-stack">
          <label>
            Chọn bank / STK (cho phép trùng)
            <select
              className="control-select"
              value={extraBankKey}
              onChange={(e) => setExtraBankKey(e.target.value)}
            >
              {extraBankOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {formatBankHolderLabel(opt.bankName, opt.bankId, opt.accountHolder)} · {opt.accountNo}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số acc thêm
            <input
              type="number"
              min="1"
              max="20"
              value={extraCount}
              onChange={(e) => setExtraCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
        <button
          type="button"
          className="btn primary block"
          disabled={running}
          onClick={handleAddExtraAccounts}
        >
          {running ? 'Đang tạo...' : `Thêm ${extraCount} acc random (trùng bank)`}
        </button>
      </div>
    ) : null

    if (activeStep === 1) {
      return (
        <>
          <h3>Chọn bank từ kho</h3>
          <p className="step-desc">
            Chọn chủ khoản trong <strong>Kho ngân hàng</strong>, hệ thống tạo đúng <strong>1 account / 1 STK</strong>.
          </p>
          {bankGroups.length === 0 ? (
            <div className="step-alert warn">
              Chưa có STK trống — thêm bank ở tab Kho ngân hàng trước.
            </div>
          ) : (
            <div className="form-stack">
              <label>
                Bank · Chủ khoản
                <select
                  className="control-select"
                  value={selectedGroupKey}
                  onChange={(e) => {
                    const key = e.target.value
                    if (!key) {
                      applyBatchSelection(null)
                      return
                    }
                    const group = bankGroups.find((g) => `${g.bankId}|${g.accountHolder}` === key)
                    if (group) applyBatchSelection(group)
                  }}
                >
                  <option value="">— Chọn —</option>
                  {bankGroups.map((group) => (
                    <option
                      key={`${group.bankId}|${group.accountHolder}`}
                      value={`${group.bankId}|${group.accountHolder}`}
                    >
                      {formatBankHolderLabel(group.bankName, group.bankId, group.accountHolder)}
                      {' · '}tổng {group.stkCount} STK
                      {group.freeCount ? ` · trống ${group.freeCount}` : ''}
                      {group.usedCount ? ` · đã dùng ${group.usedCount}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mật khẩu account
                <input
                  value={holderPassword}
                  onChange={(e) => setHolderPassword(e.target.value)}
                  placeholder="abc123"
                />
              </label>
            </div>
          )}
          {(selectedGroup || effectiveBatch) && (
            <div className="step-alert ok">
              Sẽ tạo <strong>{selectedGroup?.freeCount || selectedGroup?.stkCount || '…'}</strong> account
              {selectedGroup?.freeCount === 0 && selectedGroup?.stkCount ? (
                <> bằng cách <strong>dùng lại STK đã có</strong></>
              ) : (
                <> (mỗi STK một acc)</>
              )}
              {effectiveBatch && !selectedGroup && batchAccounts.length > 0 && (
                <> · batch hiện có <strong>{batchAccounts.length}</strong> acc</>
              )}
            </div>
          )}
          <button
            type="button"
            className="btn primary block"
            disabled={running || !((selectedGroup || effectiveBatch)?.accountHolder)}
            onClick={handleCreateFromBank}
          >
            {running ? 'Đang tạo...' : `Tạo ${selectedGroup?.stkCount || batchAccounts.length || 0} account`}
          </button>
          {recreateTargets.length > 0 && (
            <button
              type="button"
              className="btn block"
              disabled={running}
              onClick={handleRecreateSelected}
            >
              Tạo acc mới từ {recreateTargets.length} dòng chọn / lỗi (đổi username, giữ STK)
            </button>
          )}
          {extraPanel}
        </>
      )
    }

    if (activeStep === 2) {
      const queueSize = selected.size > 0
        ? pendingAccounts.filter((a) => selected.has(a.id)).length
        : pendingAccounts.length

      return (
        <>
          <h3>Đăng ký Sunwin</h3>
          <p className="step-desc">
            Account đã gắn STK từ kho. Lỗi (tên trùng, API…) ghi ở từng dòng — acc còn lại vẫn chạy tiếp.
          </p>
          <div className={`step-alert ${queueSize > 0 ? 'ok' : 'warn'}`}>
            {queueSize} account chờ đăng ký{effectiveBatch ? ` · ${formatBankHolderLabel(effectiveBatch.bankName, effectiveBatch.bankId, effectiveBatch.accountHolder)}` : ''}
          </div>
          <div className={`step-alert ${!hasProxy ? 'warn' : 'ok'}`}>
            {!hasProxy ? '⚠ Chưa có proxy' : proxyStatusText()}
          </div>
          <button
            type="button"
            className="btn primary block"
            disabled={running || !proxyOk || queueSize === 0}
            onClick={handleBatchRegister}
          >
            {running ? 'Đang đăng ký...' : `Đăng ký ${queueSize} account`}
          </button>
          {recreateTargets.length > 0 && (
            <button
              type="button"
              className="btn block"
              disabled={running}
              onClick={handleRecreateSelected}
            >
              Acc không verify được → tạo username mới ({recreateTargets.length})
            </button>
          )}
          {extraPanel}
        </>
      )
    }

    if (activeStep === 3) {
      return (
        <>
          <h3>Verify bank</h3>
          <p className="step-desc">
            Gửi verify STK đã gắn. Acc lỗi API vẫn nằm trong hàng — bấm Gửi lại hoặc Verify lại từng dòng.
          </p>
          <div className={`step-alert ${readyForVerify > 0 ? 'ok' : 'warn'}`}>
            {readyForVerify} account chờ gửi / gửi lại
            {selected.size > 0 ? ' (theo dòng đã chọn)' : ' (registered + chờ verify)'}
          </div>
          <button
            type="button"
            className="btn primary block"
            disabled={running || readyForVerify === 0}
            onClick={handleVerifySelected}
          >
            {running ? 'Đang gửi...' : `Gửi / gửi lại verify (${readyForVerify})`}
          </button>
          {recreateTargets.length > 0 && (
            <button
              type="button"
              className="btn block"
              disabled={running}
              onClick={handleRecreateSelected}
            >
              Tạo acc mới từ dòng chọn / lỗi ({recreateTargets.length})
            </button>
          )}
          {extraPanel}
        </>
      )
    }

    if (activeStep === 4) {
      return (
        <>
          <h3>Kiểm tra verify</h3>
          <p className="step-desc">Bấm kiểm tra thủ công. Lỗi check chỉ ghi lastError, không xóa acc.</p>
          {lastPollAt && (
            <p className="step-meta">Lần cuối: {new Date(lastPollAt).toLocaleTimeString('vi-VN')}</p>
          )}
          <button
            type="button"
            className="btn primary block"
            disabled={running || batchStats.bankPending === 0}
            onClick={handleManualCheckAll}
          >
            {running ? 'Đang kiểm tra...' : `Kiểm tra ngay (${batchStats.bankPending})`}
          </button>
          {batchAccounts.some(canRetryVerify) && (
            <button
              type="button"
              className="btn block"
              disabled={running || readyForVerify === 0}
              onClick={() => {
                setActiveStep(3)
                handleVerifySelected()
              }}
            >
              Gửi lại verify ({readyForVerify})
            </button>
          )}
          <button type="button" className="btn primary block" onClick={() => setActiveStep(5)}>
            Nạp tiền (không cần bank OK) →
          </button>
          {extraPanel}
        </>
      )
    }

    const depositReady = batchAccounts.filter(canDepositAccount).length

    return (
      <>
        <h3>Nạp tiền</h3>
        <p className="step-desc">
          Tạo lệnh nạp ngay sau khi đăng ký — <strong>không cần chờ bank OK</strong>.
        </p>
        <div className="step-alert ok">
          {depositReady} account có thể nạp trong batch này
        </div>
        {stats.deposited > 0 && (
          <div className="step-alert ok">✓ {stats.deposited} đã có mã nạp</div>
        )}
      </>
    )
  }, [
    activeStep, running, stats, selected, batchStats,
    lastPollAt, readyForVerify, hasProxy, proxyOk, pendingAccounts, bankGroups,
    selectedGroup, effectiveBatch, selectedGroupKey, holderPassword, batchAccounts,
    recreateTargets, extraBankOptions, extraBankKey, extraCount
  ])

  return (
    <div className="page farm-page">
      <header className="farm-header">
        <div>
          <h1>Nuôi tài khoản</h1>
          <p>Chọn kho bank → tạo acc → đăng ký → verify → nạp (nạp không cần bank OK)</p>
        </div>
        <div className="farm-stats">
          <span className="farm-stat"><em>{stats.total}</em> tài khoản</span>
          <span className="farm-stat warn"><em>{stats.bankPending}</em> chờ verify</span>
          <span className="farm-stat ok"><em>{stats.bankVerified}</em> bank OK</span>
          <span className="farm-stat">
            <em>{stats.proxyAccountsBound ?? 0}</em>
            {stats.proxyUnlimited ? ' acc · proxy ∞' : ` · ${stats.proxySlotsFree ?? 0} slot`}
          </span>
        </div>
      </header>

      {(error || loading) && (
        <div className={`panel ${error ? 'warn-box' : 'info-box'}`}>
          {loading ? 'Đang tải dữ liệu từ MongoDB...' : error}
        </div>
      )}

      {progress && (
        <div className="farm-progress">
          <div className="farm-progress-bar">
            {progressPct !== null && (
              <div className="farm-progress-fill" style={{ width: `${progressPct}%` }} />
            )}
          </div>
          <span className="farm-progress-label">{progress.label}</span>
        </div>
      )}

      {effectiveBatch && batchAccounts.length > 0 && (
        <div className="farm-batch-summary">
          <div className="farm-batch-summary-head">
            <strong>Trạng thái batch hiện tại</strong>
            <span className="muted">
              {formatBankHolderLabel(effectiveBatch.bankName, effectiveBatch.bankId, effectiveBatch.accountHolder)}
            </span>
          </div>
          <div className="farm-batch-pills">
            <span className="farm-batch-pill"><em>{batchStats.total}</em> tổng</span>
            {batchStats.pending > 0 && <span className="farm-batch-pill warn"><em>{batchStats.pending}</em> chờ đăng ký</span>}
            {batchStats.error > 0 && <span className="farm-batch-pill danger"><em>{batchStats.error}</em> lỗi</span>}
            {batchStats.registered > 0 && <span className="farm-batch-pill info"><em>{batchStats.registered}</em> chờ verify</span>}
            {batchStats.bankPending > 0 && <span className="farm-batch-pill warn"><em>{batchStats.bankPending}</em> chờ duyệt bank</span>}
            {batchStats.bankVerified > 0 && <span className="farm-batch-pill ok"><em>{batchStats.bankVerified}</em> bank OK</span>}
            {batchStats.deposited > 0 && <span className="farm-batch-pill ok"><em>{batchStats.deposited}</em> đã có mã nạp</span>}
          </div>
        </div>
      )}

      <nav className="workflow-stepper" aria-label="Quy trình">
        {STEPS.map((step) => {
          const count = stepCount(step.id, batchStats)
          const isActive = activeStep === step.id
          const isDone = step.id < activeStep || (step.id === 1 && batchStats.total > 0 && batchStats.registered === 0)

          return (
            <button
              key={step.id}
              type="button"
              className={`workflow-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
              onClick={() => setActiveStep(step.id)}
            >
              <span className="workflow-step-num">{step.id}</span>
              <span className="workflow-step-body">
                <strong>{step.title}</strong>
                <small>{step.desc}{count > 0 ? ` · ${count}` : ''}</small>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="farm-layout">
        <aside className="farm-panel">
          {stepPanel}
        </aside>

        <section className="farm-accounts">
          <div className="farm-accounts-head">
            <h2>Batch hiện tại</h2>
            {effectiveBatch ? (
              <span className="muted">
                {formatBankHolderLabel(effectiveBatch.bankName, effectiveBatch.bankId, effectiveBatch.accountHolder)}
                {' · '}{batchAccounts.length} acc
              </span>
            ) : (
              <span className="muted">{batchAccounts.length} acc (chọn kho ở bước 1)</span>
            )}
          </div>

          {batchAccounts.length === 0 ? (
            <div className="farm-empty">
              <p>Chưa có account trong batch</p>
              <span>Bước 1 — chọn bank từ kho và tạo account</span>
            </div>
          ) : (
            <div className="table-wrap farm-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={stepScopedAccounts.length > 0 && stepScopedAccounts.every((acc) => selected.has(acc.id))}
                        onChange={toggleSelectAll}
                        aria-label="Chọn tất cả theo bước"
                      />
                    </th>
                    <th>Tài khoản</th>
                    <th>Proxy</th>
                    <th>Trạng thái</th>
                    <th>Số dư</th>
                    <th>Ngân hàng</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {batchAccounts.map((acc) => {
                    const proxy = getProxyById(state, acc.proxyId)
                    const rowClassName = [
                      selected.has(acc.id) ? 'selected' : '',
                      isCompletedAccount(acc) ? 'row-done' : '',
                      stepScopedIds.has(acc.id) ? 'row-step-target' : ''
                    ].filter(Boolean).join(' ')
                    return (
                      <tr key={acc.id} className={rowClassName}>
                        <td>
                          <input type="checkbox" checked={selected.has(acc.id)} onChange={() => toggleSelect(acc.id)} />
                        </td>
                        <td>
                          <div className="acc-cell">
                            <strong>{acc.username}</strong>
                            <span className="acc-pass">{acc.password}</span>
                          </div>
                          {acc.lastError && <div className="err-text">{acc.lastError}</div>}
                        </td>
                        <td><code className="proxy-code">{maskProxy(proxy?.raw)}</code></td>
                        <td><StatusBadge status={acc.status} /></td>
                        <WalletCell
                          account={acc}
                          loading={walletLoading.has(acc.id)}
                          onRefresh={() => refreshWallet(acc)}
                        />
                        <td>
                          {accountHasBank(acc) ? (
                            <span className="bank-cell">
                              <strong>{getBankNameById(acc.bankId)}</strong>
                              {acc.accountHolder}<br />
                              <code>{acc.accountNo}</code>
                            </span>
                          ) : (
                            <span className="bank-missing">Chưa có bank</span>
                          )}
                        </td>
                        <td className="actions-cell">
                          <InspectMenu
                            account={acc}
                            onOpenInspect={(tab) => openInspect(acc, tab)}
                          />
                          {(acc.status === 'registered' || acc.status === 'error' || acc.status === 'bank_pending') && (
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => openBankModal(acc)}
                            >
                              Sửa bank
                            </button>
                          )}
                          {canRetryVerify(acc) && (
                            <button
                              type="button"
                              className="btn sm"
                              disabled={running}
                              onClick={() => handleRetryVerify(acc)}
                            >
                              Verify lại
                            </button>
                          )}
                          {canDepositAccount(acc) && (
                            <button
                              type="button"
                              className="btn sm primary"
                              onClick={() => setDepositModal({
                                account: acc,
                                codePayId: DEFAULT_CODEPAY_ID,
                                amount: state.settings.depositAmount,
                                result: acc.depositInfo
                                  ? { data: { data: acc.depositInfo } }
                                  : null
                              })}
                            >
                              Nạp tiền
                            </button>
                          )}
                          <button type="button" className="btn sm ghost" onClick={() => deleteAccount(acc.id)} title="Xóa">×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <BankEditModal
        account={bankModal?.account}
        form={bankModal?.form}
        onChange={(form) => setBankModal((prev) => ({ ...prev, form }))}
        onSave={saveBankModal}
        onClose={() => setBankModal(null)}
      />

      {inspectModal?.account && (
        <AccountInspectModal
          account={inspectModal.account}
          proxyRaw={getProxyById(state, inspectModal.account.proxyId)?.raw}
          initialTab={inspectModal.tab}
          onClose={() => setInspectModal(null)}
          onWalletLoaded={(wallet) => saveWalletSnapshot(inspectModal.account.id, wallet)}
        />
      )}

      {depositModal?.account && (
        <div className="modal-backdrop" onClick={() => setDepositModal(null)}>
          <div className="modal deposit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nạp tiền</h3>
            <p className="modal-sub">{depositModal.account.username}</p>
            <div className="form-stack">
              <label>
                Kênh CodePay
                <BankSelect
                  options={CODEPAY_LIST}
                  value={depositModal.codePayId}
                  onChange={(v) => setDepositModal((p) => ({ ...p, codePayId: v }))}
                />
              </label>
              <label>
                Số tiền (VND)
                <input
                  type="number"
                  value={depositModal.amount}
                  onChange={(e) => setDepositModal((p) => ({ ...p, amount: e.target.value }))}
                />
              </label>
            </div>

            <DepositInfoPanel
              result={depositModal.result}
              depositInfo={depositModal.account.depositInfo}
            />

            <div className="modal-actions">
              <button type="button" className="btn primary" disabled={running} onClick={() => handleDeposit(depositModal.account)}>
                {depositModal.result ? 'Tạo lại mã' : 'Tạo mã nạp'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setDepositModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
