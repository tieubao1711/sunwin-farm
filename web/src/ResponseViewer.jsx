import { useState } from 'react'
import { getBankNameById } from './banks'
import { formatCodePayExpiry, parseCodePayPayload } from './utils/codePay'

function formatValue(value) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `Array(${value.length})`
  if (typeof value === 'object') return `Object(${Object.keys(value).length})`
  return String(value)
}

function JsonNode({ name, value, depth = 0, defaultOpen = true }) {
  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)
  const isExpandable = isObject && (isArray ? value.length > 0 : Object.keys(value).length > 0)
  const [open, setOpen] = useState(defaultOpen && depth < 2)

  if (!isObject) {
    return (
      <div className="json-row" style={{ paddingLeft: depth * 16 }}>
        {name !== null && <span className="json-key">{name}: </span>}
        <span className={`json-value json-${typeof value}`}>{formatValue(value)}</span>
      </div>
    )
  }

  const entries = isArray ? value.map((item, i) => [i, item]) : Object.entries(value)
  const preview = isArray ? `[${value.length}]` : `{${entries.length}}`

  return (
    <div className="json-node">
      <div className="json-row" style={{ paddingLeft: depth * 16 }}>
        {isExpandable ? (
          <button type="button" className="json-toggle" onClick={() => setOpen(!open)} aria-label="toggle">
            {open ? '▼' : '▶'}
          </button>
        ) : (
          <span className="json-toggle placeholder" />
        )}
        {name !== null && <span className="json-key">{name}: </span>}
        {!open && <span className="json-preview">{preview}</span>}
      </div>
      {open && isExpandable && entries.map(([key, child]) => (
        <JsonNode
          key={String(key)}
          name={isArray ? null : key}
          value={child}
          depth={depth + 1}
          defaultOpen={depth < 1}
        />
      ))}
    </div>
  )
}

function getSlipRows(result, type) {
  const block = result?.data?.slipHistory?.[type]
  if (!block) return []
  if (Array.isArray(block)) return block
  if (Array.isArray(block.data)) return block.data
  if (Array.isArray(block.data?.data)) return block.data.data
  return []
}

function formatCell(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') return Number(value).toLocaleString('vi-VN')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function WalletPanel({ wallet, error }) {
  if (error) {
    return (
      <div className="response-alert error">
        <strong>Không lấy được số dư</strong>
        <p>{error}</p>
      </div>
    )
  }

  if (!wallet) return <p className="muted">Chưa có dữ liệu ví</p>

  return (
    <div className="wallet-panel">
      <div className="highlight-grid">
        {wallet.gold != null && (
          <div className="highlight-card tone-accent">
            <span className="highlight-label">Gold</span>
            <span className="highlight-value">{Number(wallet.gold).toLocaleString('vi-VN')}</span>
          </div>
        )}
        {wallet.chip != null && (
          <div className="highlight-card">
            <span className="highlight-label">Chip</span>
            <span className="highlight-value">{Number(wallet.chip).toLocaleString('vi-VN')}</span>
          </div>
        )}
        {wallet.vip != null && (
          <div className="highlight-card">
            <span className="highlight-label">VIP</span>
            <span className="highlight-value">{wallet.vip}</span>
          </div>
        )}
        {wallet.safe != null && (
          <div className="highlight-card">
            <span className="highlight-label">Safe</span>
            <span className="highlight-value">{Number(wallet.safe).toLocaleString('vi-VN')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SlipHistoryPanel({ rows, title }) {
  if (!rows.length) {
    return (
      <div className="slip-history-panel">
        <h3>{title}</h3>
        <p className="muted">Không có bản ghi</p>
      </div>
    )
  }

  const preferredKeys = ['createdAt', 'createTime', 'time', 'amount', 'money', 'status', 'state', 'code', 'id', 'bankName', 'note', 'message']
  const keys = preferredKeys.filter((key) => rows.some((row) => row?.[key] != null))
  const extraKeys = Object.keys(rows[0] || {}).filter((key) => !keys.includes(key) && !key.startsWith('_'))
  const columns = [...keys, ...extraKeys].slice(0, 8)

  return (
    <div className="slip-history-panel">
      <h3>{title} ({rows.length})</h3>
      <div className="verified-table-wrap">
        <table className="verified-table">
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || row._id || index}>
                {columns.map((key) => (
                  <td key={key}>{formatCell(row[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function getVerifiedBankData(result) {
  if (!result?.data) return null
  if (result.data.verifiedBankAccounts || result.data.verifiedAccountHolder) {
    return result.data
  }
  return null
}

function VerifiedBankPanel({ data }) {
  const holders = data?.verifiedAccountHolder || []
  const accounts = data?.verifiedBankAccounts || []

  return (
    <div className="verified-bank-panel">
      <div className="verified-section">
        <h3>Chủ tài khoản đã xác minh</h3>
        {holders.length === 0 ? (
          <p className="muted">Chưa có</p>
        ) : (
          <ul className="verified-holder-list">
            {holders.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="verified-section">
        <h3>Ngân hàng đã liên kết</h3>
        {accounts.length === 0 ? (
          <p className="muted">Chưa có tài khoản ngân hàng đã xác minh</p>
        ) : (
          <div className="verified-table-wrap">
            <table className="verified-table">
              <thead>
                <tr>
                  <th>Ngân hàng</th>
                  <th>Chủ TK</th>
                  <th>Số TK</th>
                  <th>Bank ID</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc, index) => (
                  <tr key={`${acc.bankId}-${acc.accountNo}-${index}`}>
                    <td>{acc.bankName || getBankNameById(acc.bankId) || '—'}</td>
                    <td>{acc.accountHolder || '—'}</td>
                    <td><code>{acc.accountNo || '—'}</code></td>
                    <td><code className="bank-id">{acc.bankId}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function extractHighlights(action, result, error) {
  if (error) {
    return [{ label: 'Lỗi', value: error, tone: 'error' }]
  }
  if (!result) return []

  const verifiedData = getVerifiedBankData(result)
  if (verifiedData) {
    const items = []
    const ok = result.success === true
    items.push({ label: 'Trạng thái', value: ok ? 'Thành công' : 'Thất bại', tone: ok ? 'success' : 'error' })
    items.push({ label: 'Chủ TK', value: `${(verifiedData.verifiedAccountHolder || []).length} tên` })
    items.push({ label: 'TK ngân hàng', value: `${(verifiedData.verifiedBankAccounts || []).length} tài khoản` })
    if (action) items.unshift({ label: 'Action', value: action })
    return items
  }

  const items = []
  const ok = result.success === true || result.data?.status === 0 || result.ok === true
  items.push({ label: 'Trạng thái', value: ok ? 'Thành công' : 'Thất bại', tone: ok ? 'success' : 'error' })

  const profile = result.account?.profile || result.data?.profile || result.data?.data?.info
  if (profile?.username || profile?.displayName) {
    items.push({ label: 'User', value: profile.displayName || profile.username })
  }

  if (result.account?.accessToken) {
    items.push({ label: 'Access Token', value: `${result.account.accessToken.slice(0, 24)}...`, tone: 'accent' })
  }

  if (result.deviceId) {
    items.push({ label: 'Device ID', value: result.deviceId })
  }

  const registerMessage = result.message || result.data?.data?.message
  if (registerMessage && typeof registerMessage === 'string') {
    items.push({ label: 'Message', value: registerMessage })
  }

  const wallet = result.data?.walletInfo?.wallet || result.data?.wallet
  if (wallet) {
    if (wallet.gold != null) items.push({ label: 'Gold', value: Number(wallet.gold).toLocaleString('vi-VN') })
    if (wallet.chip != null) items.push({ label: 'Chip', value: Number(wallet.chip).toLocaleString('vi-VN') })
  }

  const codepay = parseCodePayPayload(result)
  if (codepay?.codepay) {
    items.push({ label: 'Mã nạp', value: codepay.codepay, tone: 'accent' })
    const expiry = formatCodePayExpiry(codepay.expiresAt)
    if (expiry) items.push({ label: 'Hết hạn', value: expiry })
    if (codepay.amount != null) items.push({ label: 'Số tiền', value: `${Number(codepay.amount).toLocaleString('vi-VN')} VND` })
    if (codepay.bankName) items.push({ label: 'Ngân hàng', value: codepay.bankName })
    if (codepay.accountName) items.push({ label: 'Chủ TK', value: codepay.accountName })
    if (codepay.bankAccount) items.push({ label: 'STK nhận', value: codepay.bankAccount })
    if (codepay.content) items.push({ label: 'Ghi chú', value: codepay.content })
  }

  const message = result.data?.data?.message || result.data?.message || result.message
  if (message && typeof message === 'string') {
    items.push({ label: 'Message', value: message })
  }

  const bankName = result.bankName
  if (bankName) items.push({ label: 'Bank', value: bankName })

  const tx = result.data?.transactions?.data
  if (Array.isArray(tx)) items.push({ label: 'Giao dịch', value: `${tx.length} bản ghi` })

  const deposit = result.data?.slipHistory?.deposit?.data
  if (Array.isArray(deposit)) items.push({ label: 'Lịch sử nạp', value: `${deposit.length} bản ghi` })

  const withdraw = result.data?.slipHistory?.withdraw?.data
  if (Array.isArray(withdraw)) items.push({ label: 'Lịch sử rút', value: `${withdraw.length} bản ghi` })

  if (action) items.unshift({ label: 'Action', value: action })

  return items
}

function getQrBase64(result) {
  return parseCodePayPayload(result)?.qrcode || null
}

export function ResponseViewer({ action, result, error, lastRequest, onClear, emptyHint }) {
  const [tab, setTab] = useState('summary')
  const highlights = extractHighlights(action, result, error)
  const verifiedData = getVerifiedBankData(result)
  const qrBase64 = getQrBase64(result)
  const wallet = result?.data?.walletInfo?.wallet || result?.data?.wallet
  const walletError = result?.data?.walletInfo?.error || result?.data?.error
  const depositRows = getSlipRows(result, 'deposit')
  const withdrawRows = getSlipRows(result, 'withdraw')
  const hasData = Boolean(result || error)

  if (!hasData) {
    return <p className="muted">{emptyHint || 'Chưa có kết quả. Nhập account và bấm Gọi API.'}</p>
  }

  const jsonText = JSON.stringify(result || { error }, null, 2)

  return (
    <div className="response-viewer">
      <div className="response-toolbar">
        <div className="response-tabs">
          <button type="button" className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
            Tóm tắt
          </button>
          <button type="button" className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}>
            JSON
          </button>
        </div>
        <div className="response-actions">
          <button type="button" onClick={() => navigator.clipboard.writeText(jsonText)}>Copy JSON</button>
          {onClear && (
            <button type="button" className="ghost" onClick={onClear}>Xóa response</button>
          )}
        </div>
      </div>

      {lastRequest && (
        <div className="response-meta">
          <span className="meta-chip">{lastRequest.label}</span>
          <span className="meta-time">{new Date(lastRequest.at).toLocaleString('vi-VN')}</span>
          {lastRequest.durationMs != null && (
            <span className="meta-time">{lastRequest.durationMs}ms</span>
          )}
        </div>
      )}

      {error && (
        <div className="response-alert error">
          <strong>Lỗi</strong>
          <p>{error}</p>
        </div>
      )}

      {tab === 'summary' && (
        <div className="response-summary">
          {wallet && <WalletPanel wallet={wallet} error={walletError} />}

          {verifiedData && <VerifiedBankPanel data={verifiedData} />}

          {depositRows.length > 0 && (
            <SlipHistoryPanel rows={depositRows} title="Lịch sử nạp" />
          )}

          {withdrawRows.length > 0 && (
            <SlipHistoryPanel rows={withdrawRows} title="Lịch sử rút" />
          )}

          {!verifiedData && !wallet && highlights.length > 0 && (
            <div className="highlight-grid">
              {highlights.map((item) => (
                <div key={`${item.label}-${item.value}`} className={`highlight-card tone-${item.tone || 'default'}`}>
                  <span className="highlight-label">{item.label}</span>
                  <span className="highlight-value">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {(verifiedData || wallet) && highlights.length > 0 && (
            <div className="highlight-grid compact">
              {highlights.map((item) => (
                <div key={`${item.label}-${item.value}`} className={`highlight-card tone-${item.tone || 'default'}`}>
                  <span className="highlight-label">{item.label}</span>
                  <span className="highlight-value">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {qrBase64 && (
            <div className="qr-box">
              <img src={`data:image/png;base64,${qrBase64}`} alt="CodePay QR" />
              <p>Quét QR để chuyển khoản nạp tiền</p>
            </div>
          )}
        </div>
      )}

      {tab === 'json' && result && (
        <div className="json-panel">
          <JsonNode name={null} value={result} defaultOpen />
        </div>
      )}

      {tab === 'json' && !result && error && (
        <pre className="json-raw error">{error}</pre>
      )}
    </div>
  )
}
