import { BankSelect } from '../BankSelect'
import { BANK_LIST } from '../banks'

export function BankEditModal({ account, form, onChange, onSave, onClose }) {
  if (!account) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal bank-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Thông tin ngân hàng</h3>
        <p className="modal-sub">{account.username}</p>
        <div className="form-stack">
          <label>
            Ngân hàng
            <BankSelect
              options={BANK_LIST}
              value={form.bankId}
              onChange={(v) => onChange({ ...form, bankId: v })}
            />
          </label>
          <label>
            Chủ tài khoản
            <input
              value={form.accountHolder}
              onChange={(e) => onChange({ ...form, accountHolder: e.target.value })}
              placeholder="NGUYEN VAN A"
            />
          </label>
          <label>
            Số tài khoản
            <input
              value={form.accountNo}
              onChange={(e) => onChange({ ...form, accountNo: e.target.value })}
              placeholder="1234567890"
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onSave}>Lưu</button>
          <button type="button" className="btn ghost" onClick={onClose}>Hủy</button>
        </div>
      </div>
    </div>
  )
}
