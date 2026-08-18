import { formatCodePayExpiry, formatDepositAmount, parseCodePayPayload } from '../utils/codePay'

function InfoRow({ label, value, copy = false, mono = false, message = false }) {
  if (!value) return null

  return (
    <div className={`deposit-info-row${message ? ' is-message' : ''}`}>
      <span className="deposit-info-label">{label}</span>
      <div className="deposit-info-value-wrap">
        <span className={[mono ? 'mono' : '', copy ? 'deposit-code' : ''].filter(Boolean).join(' ')}>
          {value}
        </span>
        {copy && (
          <button
            type="button"
            className="btn sm ghost copy-btn"
            onClick={() => navigator.clipboard.writeText(String(value))}
          >
            Copy
          </button>
        )}
      </div>
    </div>
  )
}

export function DepositInfoPanel({ result, depositInfo, title = 'Thông tin chuyển khoản' }) {
  const info = parseCodePayPayload(result) || parseCodePayPayload({ depositInfo })

  if (!info) return null

  const expiryText = formatCodePayExpiry(info.expiresAt)
  const hasTransferInfo = info.bankName || info.accountName || info.bankAccount

  return (
    <div className="deposit-info-panel">
      <h4>{title}</h4>

      {!hasTransferInfo && (
        <p className="muted deposit-info-warn">
          API chưa trả tên bank / STK nhận — kiểm tra tab Test API hoặc thử kênh CodePay khác.
        </p>
      )}

      <div className="deposit-info-grid">
        <InfoRow label="Ngân hàng" value={info.bankName} />
        <InfoRow label="Chủ TK nhận" value={info.accountName} />
        <InfoRow label="Số tiền" value={formatDepositAmount(info.amount)} />
        <InfoRow label="STK nhận" value={info.bankAccount} mono copy />
        <InfoRow label="Nội dung" value={info.codepay} copy mono />
        <InfoRow label="Hết hạn" value={expiryText} />
        <InfoRow label="Message" value={info.content} message />
      </div>

      {info.qrcode && (
        <div className="qr-box">
          <img src={`data:image/png;base64,${info.qrcode}`} alt="QR nạp tiền" />
          <p>Quét QR hoặc chuyển khoản thủ công — ghi đúng <strong>mã nạp</strong> vào nội dung CK</p>
        </div>
      )}
    </div>
  )
}
