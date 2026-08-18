import { useCallback, useEffect, useState } from 'react'
import { ResponseViewer } from '../ResponseViewer'
import { INSPECT_TABS, inspectAccount } from '../farm/accountInspect'
import { extractWalletFromResult } from '../utils/wallet'

export function AccountInspectModal({ account, proxyRaw, initialTab = 'wallet', onClose, onWalletLoaded }) {
  const [tab, setTab] = useState(initialTab)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [lastRequest, setLastRequest] = useState(null)

  const currentTab = INSPECT_TABS.find((item) => item.id === tab) || INSPECT_TABS[0]

  const fetchTab = useCallback(async (tabId) => {
    if (!account) return

    setLoading(true)
    setError('')
    setPhase('Đang login lại...')

    const started = Date.now()
    const meta = INSPECT_TABS.find((item) => item.id === tabId) || INSPECT_TABS[0]

    try {
      setPhase(`Đang lấy ${meta.label.toLowerCase()}...`)
      const data = await inspectAccount(account, proxyRaw, tabId)
      setResult(data)
      if (tabId === 'wallet' && onWalletLoaded) {
        const wallet = extractWalletFromResult(data)
        if (wallet) onWalletLoaded(wallet)
      }
      setLastRequest({
        label: meta.actionLabel,
        at: Date.now(),
        durationMs: Date.now() - started
      })
    } catch (err) {
      setResult(null)
      setError(err.message || 'Tra cứu thất bại')
      setLastRequest({
        label: meta.actionLabel,
        at: Date.now(),
        durationMs: Date.now() - started
      })
    } finally {
      setLoading(false)
      setPhase('')
    }
  }, [account, proxyRaw, onWalletLoaded])

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab, account?.id])

  useEffect(() => {
    if (!account) return
    setResult(null)
    setError('')
    fetchTab(tab)
  }, [account?.id, tab, fetchTab])

  if (!account) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal inspect-modal" onClick={(event) => event.stopPropagation()}>
        <h3>Tra cứu account</h3>
        <p className="modal-sub inspect-modal-sub">
          <strong>{account.username}</strong>
          {' · '}
          Mỗi lần tra cứu hệ thống <strong>login lại</strong> — token không lưu trên server
        </p>

        <div className="inspect-tabs">
          {INSPECT_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'active' : ''}
              disabled={loading}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="inspect-loading">
            {phase || 'Đang tải...'}
          </div>
        )}

        <div className="inspect-result">
          <ResponseViewer
            action={currentTab.actionLabel}
            result={result}
            error={error}
            lastRequest={lastRequest}
            emptyHint="Chọn tab hoặc bấm Làm mới để tra cứu"
          />
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn primary"
            disabled={loading}
            onClick={() => fetchTab(tab)}
          >
            Làm mới
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}
