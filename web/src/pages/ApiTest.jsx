import { useEffect, useState } from 'react'
import { callApi, checkHealth } from '../api'
import { DEFAULT_BANK_ID, DEFAULT_CODEPAY_ID, BANK_LIST, CODEPAY_LIST } from '../banks'
import { BankSelect } from '../BankSelect'
import { ResponseViewer } from '../ResponseViewer'
import { WsMonitor } from '../WsMonitor'
import { clearSession, DEFAULT_FORM, loadSession, saveSession } from '../storage'

const ACTIONS = [
  { id: 'login', label: 'Login', endpoint: 'login' },
  { id: 'register', label: 'Register', endpoint: 'register' },
  { id: 'full-info', label: 'Full Info', endpoint: 'full-info' },
  { id: 'wallet', label: 'Wallet (WS)', endpoint: 'wallet' },
  { id: 'bet-history', label: 'Bet History', endpoint: 'bet-history' },
  { id: 'deposit-history', label: 'Deposit History', endpoint: 'deposit-history' },
  { id: 'withdraw-history', label: 'Withdraw History', endpoint: 'withdraw-history' },
  { id: 'verify-bank-account', label: 'Verify Bank', endpoint: 'verify-bank-account' },
  { id: 'fetch-bank-accounts', label: 'Bank Accounts', endpoint: 'fetch-bank-accounts' },
  { id: 'create-code-pay', label: 'Nạp CodePay', endpoint: 'create-code-pay' },
  { id: 'change-password', label: 'Change Password', endpoint: 'change-password' }
]

function buildDefaultForm() {
  return {
    ...DEFAULT_FORM,
    bankId: DEFAULT_BANK_ID,
    codePayId: DEFAULT_CODEPAY_ID
  }
}

export function ApiTest() {
  const saved = loadSession()

  const [form, setForm] = useState(() => ({
    ...buildDefaultForm(),
    ...(saved?.form || {})
  }))
  const [action, setAction] = useState(saved?.action || 'full-info')
  const [loading, setLoading] = useState(false)
  const [serverOk, setServerOk] = useState(null)
  const [serverInfo, setServerInfo] = useState(null)
  const [result, setResult] = useState(saved?.result ?? null)
  const [error, setError] = useState(saved?.error || '')
  const [lastRequest, setLastRequest] = useState(saved?.lastRequest || null)
  const [wsState, setWsState] = useState(saved?.wsState || {})

  useEffect(() => {
    checkHealth()
      .then((data) => {
        setServerOk(Boolean(data.ok))
        setServerInfo(data)
      })
      .catch(() => setServerOk(false))
  }, [])

  useEffect(() => {
    saveSession({ form, action, result, error, lastRequest, wsState })
  }, [form, action, result, error, lastRequest, wsState])

  const serverOutdated = serverOk && !serverInfo?.routes?.includes('POST /api/register')
  const currentAction = ACTIONS.find((item) => item.id === action)

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleClearSession() {
    clearSession()
    setForm(buildDefaultForm())
    setAction('full-info')
    setResult(null)
    setError('')
    setLastRequest(null)
    setWsState({})
  }

  function handleWsPersist(patch) {
    setWsState((prev) => ({ ...prev, ...patch }))
  }

  function handleClearResponse() {
    setResult(null)
    setError('')
    setLastRequest(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const startedAt = Date.now()

    try {
      const payload = {
        username: form.username,
        password: form.password,
        proxyUrl: form.proxyUrl || undefined,
        limit: Number(form.limit) || 5
      }

      if (action === 'change-password') payload.newPassword = form.newPassword
      if (action === 'register') payload.displayName = form.displayName
      if (action === 'verify-bank-account') {
        payload.bankId = form.bankId
        payload.accountHolder = form.accountHolder
        payload.accountNo = form.accountNo
      }
      if (action === 'create-code-pay') {
        payload.bankAccountId = form.codePayId
        payload.amount = Number(form.amount)
        payload.bankId = form.codePayId
      }

      const data = await callApi(currentAction.endpoint, payload)
      setError('')
      setResult(data)
      setLastRequest({
        label: currentAction.label,
        endpoint: currentAction.endpoint,
        at: startedAt,
        durationMs: Date.now() - startedAt
      })
    } catch (err) {
      setError(err.message)
      setLastRequest({
        label: currentAction.label,
        endpoint: currentAction.endpoint,
        at: startedAt,
        durationMs: Date.now() - startedAt
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Test API</h1>
          <p>Dành cho dev — thử từng endpoint riêng lẻ</p>
        </div>
        <div className="header-actions">
          <button type="button" className="ghost-btn" onClick={handleClearSession}>
            Xóa dữ liệu test
          </button>
          <div className={`status ${serverOk && !serverOutdated ? 'ok' : 'bad'}`}>
            API: {serverOk === null ? '...' : serverOutdated ? 'cần restart' : serverOk ? `v${serverInfo?.version}` : 'offline'}
          </div>
        </div>
      </div>

      {serverOutdated && (
        <div className="panel warn-box">
          API server cũ. Chạy lại: <code>npm run dev</code>
        </div>
      )}

      <form className="panel" onSubmit={handleSubmit}>
        <section className="section">
          <h2>API Action</h2>
          <div className="actions">
            {ACTIONS.map((item) => (
              <button key={item.id} type="button" className={action === item.id ? 'active' : ''} onClick={() => setAction(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {action === 'register' ? (
          <section className="section">
            <h2>Đăng ký tài khoản</h2>
            <p className="muted section-hint">Username, mật khẩu và tên hiển thị dùng để tạo tài khoản mới trên Sunwin.</p>
            <div className="grid">
              <label>
                Username
                <input value={form.username} onChange={(e) => updateField('username', e.target.value)} required placeholder="vd: sw01" />
              </label>
              <label>
                Password
                <input type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} required />
              </label>
              <label>
                Display Name
                <input value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)} required placeholder="Tên hiển thị trong game" />
              </label>
              <label className="full">
                Proxy xoay
                <input value={form.proxyUrl} onChange={(e) => updateField('proxyUrl', e.target.value)} placeholder="user:pass@host:port" />
              </label>
            </div>
          </section>
        ) : (
          <section className="section">
            <h2>Tài khoản</h2>
            <div className="grid">
              <label>
                Username
                <input value={form.username} onChange={(e) => updateField('username', e.target.value)} required />
              </label>
              <label>
                Password
                <input type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} required />
              </label>
              <label className="full">
                Proxy xoay
                <input value={form.proxyUrl} onChange={(e) => updateField('proxyUrl', e.target.value)} placeholder="user:pass@host:port" />
              </label>
              <label>
                Limit
                <input type="number" min="1" max="50" value={form.limit} onChange={(e) => updateField('limit', e.target.value)} />
              </label>
            </div>

            {action === 'change-password' && (
              <label className="full">
                New Password
                <input type="password" value={form.newPassword} onChange={(e) => updateField('newPassword', e.target.value)} required />
              </label>
            )}

            {action === 'verify-bank-account' && (
              <div className="grid extra-fields">
                <label className="full">
                  Ngân hàng
                  <BankSelect options={BANK_LIST} value={form.bankId} onChange={(v) => updateField('bankId', v)} />
                </label>
                <label>
                  Chủ tài khoản
                  <input value={form.accountHolder} onChange={(e) => updateField('accountHolder', e.target.value)} required />
                </label>
                <label>
                  Số tài khoản
                  <input value={form.accountNo} onChange={(e) => updateField('accountNo', e.target.value)} required />
                </label>
              </div>
            )}

            {action === 'create-code-pay' && (
              <div className="grid extra-fields">
                <label className="full">
                  Kênh CodePay
                  <BankSelect options={CODEPAY_LIST} value={form.codePayId} onChange={(v) => updateField('codePayId', v)} />
                </label>
                <label>
                  Số tiền (VND)
                  <input type="number" min="10000" step="1000" value={form.amount} onChange={(e) => updateField('amount', e.target.value)} required />
                </label>
              </div>
            )}
          </section>
        )}

        <button type="submit" className="submit" disabled={loading || !serverOk || serverOutdated}>
          {loading ? 'Đang gọi API...' : 'Gọi API'}
        </button>
      </form>

      <WsMonitor
        credentials={{ username: form.username, password: form.password, proxyUrl: form.proxyUrl }}
        savedState={wsState}
        onPersist={handleWsPersist}
      />

      <section className="panel result">
        <h2>Response</h2>
        <ResponseViewer
          action={currentAction?.label}
          result={result}
          error={error}
          lastRequest={lastRequest}
          onClear={handleClearResponse}
        />
      </section>
    </div>
  )
}
