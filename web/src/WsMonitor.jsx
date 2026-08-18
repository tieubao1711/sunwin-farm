import { useWsMonitor } from './useWsMonitor'

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('vi-VN')
}

function formatNumber(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('vi-VN')
}

export function WsMonitor({ credentials, savedState, onPersist }) {
  const {
    status,
    statusLabel,
    profile,
    wallet,
    messages,
    error,
    connectedAt,
    lastMessageAt,
    connect,
    disconnect,
    clearLog,
    previewPayload
  } = useWsMonitor({
    credentials,
    onPersist,
    initialState: savedState
  })

  const isLive = status === 'connected'
  const isBusy = status === 'connecting' || status === 'logging-in'

  return (
    <section className="panel ws-monitor">
      <div className="ws-head">
        <div>
          <h2>WebSocket Live</h2>
          <p>Theo dõi realtime wallet và message stream từ lobby</p>
        </div>
        <div className={`ws-status-pill tone-${status}`}>
          <span className="ws-dot" />
          {statusLabel}
        </div>
      </div>

      <div className="ws-toolbar">
        <button type="button" className="ws-btn primary" onClick={connect} disabled={isBusy || isLive}>
          {isBusy ? 'Đang kết nối...' : 'Kết nối WS'}
        </button>
        <button type="button" className="ws-btn" onClick={disconnect} disabled={!isLive && status !== 'error'}>
          Ngắt kết nối
        </button>
        <button type="button" className="ws-btn ghost" onClick={clearLog}>
          Xóa log
        </button>
      </div>

      <div className="ws-meta-row">
        <span>User: <strong>{profile?.displayName || profile?.username || credentials?.username || '—'}</strong></span>
        <span>Kết nối lúc: <strong>{formatTime(connectedAt)}</strong></span>
        <span>Message cuối: <strong>{formatTime(lastMessageAt)}</strong></span>
        <span>Tổng log: <strong>{messages.length}</strong></span>
      </div>

      {error && (
        <div className="response-alert error ws-error">
          <strong>WS Error</strong>
          <p>{error}</p>
        </div>
      )}

      {wallet && (
        <div className="ws-wallet-grid">
          <div className="ws-wallet-card">
            <span>Gold</span>
            <strong>{formatNumber(wallet.gold)}</strong>
          </div>
          <div className="ws-wallet-card">
            <span>Chip</span>
            <strong>{formatNumber(wallet.chip)}</strong>
          </div>
          <div className="ws-wallet-card">
            <span>VIP</span>
            <strong>{formatNumber(wallet.vip)}</strong>
          </div>
          <div className="ws-wallet-card">
            <span>Safe</span>
            <strong>{formatNumber(wallet.safe)}</strong>
          </div>
        </div>
      )}

      <div className="ws-log">
        <div className="ws-log-head">
          <h3>Message stream</h3>
          <span className="muted">cmd 0=ping, 1=init, 5=wallet</span>
        </div>

        {messages.length === 0 ? (
          <p className="muted ws-empty">Chưa có message. Bấm "Kết nối WS" để bắt đầu stream.</p>
        ) : (
          <div className="ws-log-table-wrap">
            <table className="ws-log-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>CMD</th>
                  <th>Loại</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((item, index) => (
                  <tr key={`${item.at}-${index}`}>
                    <td>{formatTime(item.at)}</td>
                    <td><code>{item.cmd ?? '—'}</code></td>
                    <td><span className="cmd-chip">{item.cmdLabel || 'unknown'}</span></td>
                    <td className="payload-cell">{previewPayload(item.payload)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
