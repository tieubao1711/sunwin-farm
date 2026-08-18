import { useCallback, useEffect, useState } from 'react'
import { BankSelect } from '../BankSelect'
import { BankEditModal } from '../components/BankEditModal'
import { DEFAULT_BANK_ID, BANK_LIST, getBankNameById } from '../banks'
import { useFarm } from '../farm/FarmProvider'
import { getEmployeeName } from '../farm/farmApi'

const EMPTY_ADD_FORM = {
  bankId: DEFAULT_BANK_ID,
  accountHolder: '',
  accountNos: ''
}

const STATUS_LABEL = {
  available: { label: 'Chưa dùng', tone: 'ok' },
  reserved: { label: 'Đang giữ', tone: 'warn' },
  used: { label: 'Đã dùng', tone: 'used' }
}

export function BankInventory() {
  const {
    stats,
    loading,
    error,
    refresh,
    fetchBanks,
    fetchBanksGrouped,
    importBanks,
    patchBank,
    deleteBank,
    reserveBank,
    releaseBank,
    fetchActivity
  } = useFarm()

  const [groups, setGroups] = useState([])
  const [banks, setBanks] = useState([])
  const [expanded, setExpanded] = useState(new Set())
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [statusFilter, setStatusFilter] = useState('')
  const [message, setMessage] = useState('')
  const [activity, setActivity] = useState([])
  const [editModal, setEditModal] = useState(null)

  const load = useCallback(async () => {
    const params = statusFilter ? { status: statusFilter } : {}
    const [groupData, bankData, logData] = await Promise.all([
      fetchBanksGrouped(params),
      fetchBanks(params),
      fetchActivity(30)
    ])
    setGroups(groupData)
    setBanks(bankData)
    setActivity(logData)
  }, [fetchBanks, fetchBanksGrouped, fetchActivity, statusFilter])

  useEffect(() => {
    if (!loading) load().catch((err) => setMessage(err.message))
  }, [load, loading])

  function parseAccountNos(text) {
    return String(text || '')
      .split(/\r?\n/)
      .flatMap((line) => line.split(/[,;\t]+/))
      .map((line) => line.trim())
      .filter(Boolean)
  }

  async function handleAddBanks(event) {
    event.preventDefault()
    const holder = addForm.accountHolder.trim().replace(/\s+/g, ' ').toUpperCase()
    const numbers = parseAccountNos(addForm.accountNos)
    const bankName = getBankNameById(addForm.bankId) || ''

    if (!holder) {
      setMessage('Nhập tên chủ khoản')
      return
    }
    if (!numbers.length) {
      setMessage('Nhập ít nhất một số tài khoản')
      return
    }

    const importText = numbers
      .map((accountNo) => `${bankName} | ${holder} | ${accountNo}`)
      .join('\n')

    try {
      const result = await importBanks(importText)
      setAddForm(EMPTY_ADD_FORM)
      setMessage(`Đã thêm ${result.data.created} STK cho ${holder}${result.data.skipped?.length ? ` · ${result.data.skipped.length} trùng/lỗi` : ''}`)
      await refresh()
      await load()
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function handleReserve(bankId) {
    try {
      await reserveBank(bankId)
      await load()
      await refresh()
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function handleRelease(bankId) {
    try {
      await releaseBank(bankId)
      await load()
      await refresh()
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function handleDelete(bankId) {
    try {
      await deleteBank(bankId)
      await load()
      await refresh()
    } catch (err) {
      setMessage(err.message)
    }
  }

  function toggleHolder(holder) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(holder)) next.delete(holder)
      else next.add(holder)
      return next
    })
  }

  function banksForHolder(holder) {
    return banks.filter((bank) => bank.accountHolder === holder)
  }

  const employee = getEmployeeName()

  return (
    <div className="page bank-page">
      <div className="page-head">
        <div>
          <h1>Kho ngân hàng</h1>
          <p>Quản lý theo chủ khoản — 1 chủ có thể có nhiều STK và nhiều acc game</p>
        </div>
        <div className="stat-pills">
          <span className="pill ok">Trống: {stats.bankAvailable}</span>
          <span className="pill warn">Đang giữ: {stats.bankReserved}</span>
          <span className="pill">Đã dùng: {stats.bankUsed}</span>
        </div>
      </div>

      {error && <div className="panel warn-box">{error}</div>}
      {message && <div className="panel info-box">{message}</div>}

      <div className="bank-layout">
        <div className="bank-main">
          <section className="panel bank-add-panel">
            <h2>Thêm STK vào kho</h2>
            <p className="muted">Chọn ngân hàng, nhập chủ khoản, rồi danh sách số TK của chủ đó</p>
            <form className="form-stack bank-add-form" onSubmit={handleAddBanks}>
              <label>
                Ngân hàng
                <BankSelect
                  options={BANK_LIST}
                  value={addForm.bankId}
                  onChange={(v) => setAddForm({ ...addForm, bankId: v })}
                />
              </label>
              <label>
                Chủ khoản
                <input
                  value={addForm.accountHolder}
                  onChange={(e) => setAddForm({ ...addForm, accountHolder: e.target.value })}
                  placeholder="NGUYEN VAN A"
                  required
                />
              </label>
              <label>
                Danh sách số TK
                <textarea
                  className="proxy-textarea"
                  value={addForm.accountNos}
                  onChange={(e) => setAddForm({ ...addForm, accountNos: e.target.value })}
                  placeholder={'4603133761562\n4603133761563\n4603133761564'}
                  rows={6}
                  required
                />
                <span className="field-hint">Mỗi dòng một số TK — cùng ngân hàng và cùng chủ khoản</span>
              </label>
              <div className="row-actions">
                <button type="submit" className="btn primary">
                  Thêm vào kho
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setAddForm(EMPTY_ADD_FORM)}
                >
                  Xóa form
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head-row">
              <h2>Theo chủ khoản ({groups.length})</h2>
              <select className="control-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="available">Chưa dùng</option>
                <option value="reserved">Đang giữ</option>
                <option value="used">Đã dùng</option>
              </select>
            </div>
            {groups.length === 0 ? (
              <p className="muted">Chưa có bank trong kho. Nhập danh sách phía trên.</p>
            ) : (
              <div className="holder-list">
                {groups.map((group) => {
                  const open = expanded.has(group.accountHolder)
                  const rows = banksForHolder(group.accountHolder)

                  return (
                    <div key={group.accountHolder} className="holder-card">
                      <button type="button" className="holder-head" onClick={() => toggleHolder(group.accountHolder)}>
                        <strong>{group.accountHolder}</strong>
                        <span className="holder-stats">
                          {group.total} STK · {group.available} trống · {group.reserved} giữ · {group.used} dùng
                        </span>
                        <span className="holder-toggle">{open ? '▾' : '▸'}</span>
                      </button>

                      {open && (
                        <div className="table-wrap">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Ngân hàng</th>
                                <th>Số TK</th>
                                <th>Acc game</th>
                                <th>Trạng thái</th>
                                <th>Ghi chú</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((bank) => {
                                const meta = STATUS_LABEL[bank.usageStatus] || STATUS_LABEL.available
                                return (
                                  <tr key={bank.id}>
                                    <td>{bank.bankName}</td>
                                    <td><code>{bank.accountNo}</code></td>
                                    <td>
                                      {bank.username ? (
                                        <span className="acc-cell"><strong>{bank.username}</strong></span>
                                      ) : '—'}
                                    </td>
                                    <td>
                                      <span className={`tag ${meta.tone}`}>{meta.label}</span>
                                      {bank.reservedBy && bank.usageStatus === 'reserved' && (
                                        <div className="sub-text">{bank.reservedBy}</div>
                                      )}
                                    </td>
                                    <td>{bank.note || '—'}</td>
                                    <td className="actions-cell">
                                      {bank.usageStatus === 'available' && (
                                        <button type="button" className="btn sm" onClick={() => handleReserve(bank.id)}>Giữ</button>
                                      )}
                                      {bank.usageStatus === 'reserved' && bank.reservedBy === employee && (
                                        <button type="button" className="btn sm ghost" onClick={() => handleRelease(bank.id)}>Trả</button>
                                      )}
                                      <button
                                        type="button"
                                        className="btn sm ghost"
                                        onClick={() => setEditModal({
                                          account: { username: bank.accountHolder },
                                          form: {
                                            bankId: bank.bankId || DEFAULT_BANK_ID,
                                            accountHolder: bank.accountHolder,
                                            accountNo: bank.accountNo,
                                            note: bank.note
                                          },
                                          bankId: bank.id
                                        })}
                                      >
                                        Sửa
                                      </button>
                                      {bank.usageStatus !== 'used' && (
                                        <button type="button" className="btn sm ghost" onClick={() => handleDelete(bank.id)}>×</button>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="bank-side panel">
          <h2>Nhật ký làm việc</h2>
          <p className="muted">Theo dõi ai làm gì — tránh trùng việc giữa nhân viên</p>
          <ul className="activity-list">
            {activity.map((item) => (
              <li key={item.id}>
                <strong>{item.employeeName}</strong>
                <span>{item.action}</span>
                <small>{item.detail}</small>
                <time>{new Date(item.createdAt).toLocaleString('vi-VN')}</time>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {editModal && (
        <BankEditModal
          account={editModal.account}
          form={editModal.form}
          onChange={(form) => setEditModal((prev) => ({ ...prev, form }))}
          onSave={async () => {
            await patchBank(editModal.bankId, {
              accountHolder: editModal.form.accountHolder,
              accountNo: editModal.form.accountNo,
              note: editModal.form.note || ''
            })
            setEditModal(null)
            await load()
          }}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}
