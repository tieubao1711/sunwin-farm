import { formatWalletShort } from '../utils/wallet'

export function WalletCell({ account, loading = false, onRefresh }) {
  const label = formatWalletShort(account?.lastWallet)
  const checkedAt = account?.lastWalletAt
    ? new Date(account.lastWalletAt).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    : null

  return (
    <td className="wallet-cell">
      <div className="wallet-cell-main">
        {loading ? (
          <span className="muted">Đang lấy...</span>
        ) : label ? (
          <strong className="wallet-balance">{label}</strong>
        ) : (
          <span className="muted">—</span>
        )}
        {onRefresh && (
          <button
            type="button"
            className="btn sm ghost wallet-refresh-btn"
            disabled={loading}
            title="Lấy số dư"
            onClick={onRefresh}
          >
            ↻
          </button>
        )}
      </div>
      {checkedAt && !loading && (
        <span className="wallet-checked-at">{checkedAt}</span>
      )}
    </td>
  )
}
