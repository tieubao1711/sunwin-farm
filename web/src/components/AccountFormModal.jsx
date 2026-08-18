import { BankSelect } from '../BankSelect'
import { BANK_LIST } from '../banks'

export function AccountFormModal({
  open,
  title,
  form,
  onChange,
  onSubmit,
  onClose,
  submitLabel = 'Lưu'
}) {
  if (!open) return null

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal app-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Chủ khoản
            <input
              value={form.accountHolder}
              onChange={(e) => onChange({ ...form, accountHolder: e.target.value })}
              placeholder="BUI THI LAN"
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              value={form.holderPassword}
              onChange={(e) => onChange({ ...form, holderPassword: e.target.value })}
              placeholder="trangvaden123@"
            />
          </label>
          <label>
            Ngân hàng
            <BankSelect
              options={BANK_LIST}
              value={form.bankId}
              onChange={(v) => onChange({ ...form, bankId: v })}
            />
          </label>
          <div className="form-row">
            <label>
              Username
              <input
                value={form.username}
                onChange={(e) => onChange({ ...form, username: e.target.value })}
                placeholder="lanalllliwmwk22"
                required
              />
            </label>
            <label>
              Số TK bank
              <input
                value={form.accountNo}
                onChange={(e) => onChange({ ...form, accountNo: e.target.value })}
                placeholder="4603133761562"
                required
              />
            </label>
          </div>
          <label>
            Ghi chú
            <input
              value={form.note}
              onChange={(e) => onChange({ ...form, note: e.target.value })}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn primary">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
