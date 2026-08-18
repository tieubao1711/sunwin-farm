import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountFormModal } from '../components/AccountFormModal'
import { WalletCell } from '../components/WalletCell'
import { AccountInspectModal } from '../components/AccountInspectModal'
import { InspectMenu } from '../components/InspectMenu'
import { StatusBadge } from '../components/StatusBadge'
import { DEFAULT_BANK_ID, formatBankHolderLabel, getBankNameById } from '../banks'
import { useFarm } from '../farm/FarmProvider'
import { inspectAccount } from '../farm/accountInspect'
import { buildDisplayName, getProxyById } from '../farm/store'
import { extractWalletFromResult } from '../utils/wallet'

const EMPTY_FORM = {
  accountHolder: '',
  holderPassword: '',
  bankId: DEFAULT_BANK_ID,
  username: '',
  accountNo: '',
  note: ''
}

const PAGE_SIZES = [25, 50, 100]

const FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unused', label: 'Chưa dùng' },
  { value: 'used', label: 'Đã dùng' }
]

const SORT_OPTIONS = [
  { value: 'holder', label: 'Chủ khoản A→Z' },
  { value: 'username', label: 'Username A→Z' },
  { value: 'accountNo', label: 'Số TK' },
  { value: 'status', label: 'Tiến độ' }
]

function rowToForm(row) {
  return {
    accountHolder: row.accountHolder || '',
    holderPassword: row.holderPassword || row.password || '',
    bankId: row.bankId || DEFAULT_BANK_ID,
    username: row.username || '',
    accountNo: row.accountNo || '',
    note: row.note || ''
  }
}

function groupLabel(group) {
  return formatBankHolderLabel(group.bankName, group.bankId, group.accountHolder)
}

function rowBankHolderLabel(row) {
  return formatBankHolderLabel(row.bankName, row.bankId, row.accountHolder)
}

function AccountRowActions({ row, onOpenInspect, onEdit, onDelete }) {
  return (
    <td className="actions-cell">
      <InspectMenu account={row} onOpenInspect={(tab) => onOpenInspect(row, tab)} />
      <button type="button" className="btn sm ghost" onClick={() => onEdit(row)}>Sửa</button>
      <button type="button" className="btn sm ghost" onClick={() => onDelete(row.id)}>×</button>
    </td>
  )
}

function UsedToggle({ row, onToggleUsed }) {
  return (
    <td>
      <button
        type="button"
        className={`check-btn ${row.usageStatus === 'used' ? 'checked' : ''}`}
        onClick={() => onToggleUsed(row)}
      >
        {row.usageStatus === 'used' ? '✓' : ''}
      </button>
    </td>
  )
}

function PaginationBar({ page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }) {
  if (totalItems === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  function pageNumbers() {
    const pages = []
    const maxButtons = 7
    let start = Math.max(1, page - 3)
    let end = Math.min(totalPages, start + maxButtons - 1)
    start = Math.max(1, end - maxButtons + 1)

    for (let i = start; i <= end; i += 1) pages.push(i)
    return pages
  }

  return (
    <div className="pagination-bar">
      <div className="pagination-meta">
        <span className="muted">{from}–{to} / {totalItems}</span>
        <label className="page-size-select">
          <span className="muted">Hiển thị</span>
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="pagination-controls">
        <button type="button" className="btn sm ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Trước
        </button>
        {pageNumbers().map((num) => (
          <button
            key={num}
            type="button"
            className={`btn sm ${num === page ? 'primary' : 'ghost'}`}
            onClick={() => onPageChange(num)}
          >
            {num}
          </button>
        ))}
        <button type="button" className="btn sm ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Sau
        </button>
      </div>
    </div>
  )
}

export function AccountList() {
  const { state, stats, loading, error, createAccount, patchAccount, deleteAccount } = useFarm()
  const [groups, setGroups] = useState([])
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('accountListView') || 'group')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('holder')
  const [expanded, setExpanded] = useState(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [inspectModal, setInspectModal] = useState(null)
  const [walletLoading, setWalletLoading] = useState(() => new Set())
  const [selected, setSelected] = useState(() => new Set())

  function openInspect(account, tab) {
    setInspectModal({ account, tab })
  }

  function patchRowWallet(accountId, wallet) {
    const at = Date.now()
    setGroups((prev) => prev.map((group) => ({
      ...group,
      rows: group.rows.map((row) => (
        row.id === accountId
          ? { ...row, lastWallet: wallet, lastWalletAt: at }
          : row
      ))
    })))
  }

  async function saveWalletSnapshot(accountId, wallet) {
    if (!wallet) return
    await patchAccount(accountId, {
      lastWallet: wallet,
      lastWalletAt: Date.now()
    })
    patchRowWallet(accountId, wallet)
  }

  async function refreshWallet(account) {
    const proxy = getProxyById(state, account.proxyId)
    setWalletLoading((prev) => new Set(prev).add(account.id))

    try {
      const result = await inspectAccount(account, proxy?.raw, 'wallet')
      const wallet = extractWalletFromResult(result)
      if (wallet) await saveWalletSnapshot(account.id, wallet)
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

  const load = useCallback(async () => {
    const res = await fetch('/api/farm/accounts/grouped', {
      headers: { 'Content-Type': 'application/json' }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    setGroups(data.data)
  }, [])

  useEffect(() => {
    if (!loading) load().catch((err) => setMessage(err.message))
  }, [load, loading, stats.total])

  useEffect(() => {
    sessionStorage.setItem('accountListView', viewMode)
  }, [viewMode])

  useEffect(() => {
    setPage(1)
  }, [search, filter, viewMode, pageSize, sortBy])

  const searchLower = search.trim().toLowerCase()

  function compareRows(a, b, key) {
    if (key === 'holder') {
      const left = a.groupLabel || rowBankHolderLabel(a)
      const right = b.groupLabel || rowBankHolderLabel(b)
      return left.localeCompare(right)
    }
    if (key === 'status') return (a.status || '').localeCompare(b.status || '')
    if (key === 'username') return (a.username || '').localeCompare(b.username || '')
    if (key === 'accountNo') return (a.accountNo || '').localeCompare(b.accountNo || '')
    return rowBankHolderLabel(a).localeCompare(rowBankHolderLabel(b))
  }

  function sortRows(rows) {
    return [...rows].sort((a, b) => compareRows(a, b, sortBy))
  }

  const visibleGroups = useMemo(() => {
    const mapped = groups
      .map((group) => {
        const holderMatch = !searchLower
          || group.accountHolder.toLowerCase().includes(searchLower)
          || groupLabel(group).toLowerCase().includes(searchLower)
        const rows = group.rows.filter((row) => {
          if (filter === 'unused' && row.usageStatus !== 'unused') return false
          if (filter === 'used' && row.usageStatus !== 'used') return false
          if (!searchLower || holderMatch) return true
          return (
            row.username.toLowerCase().includes(searchLower)
            || row.accountNo.includes(searchLower)
            || rowBankHolderLabel(row).toLowerCase().includes(searchLower)
          )
        })
        return { ...group, rows: sortRows(rows) }
      })
      .filter((group) => group.rows.length > 0)

    if (sortBy === 'holder') {
      return [...mapped].sort((a, b) => groupLabel(a).localeCompare(groupLabel(b)))
    }
    if (sortBy === 'username' || sortBy === 'accountNo' || sortBy === 'status') {
      return [...mapped].sort((a, b) => compareRows(a.rows[0], b.rows[0], sortBy))
    }
    return mapped
  }, [groups, filter, searchLower, sortBy])

  const flatRows = useMemo(() => {
    const rows = visibleGroups.flatMap((group) => group.rows.map((row) => ({
      ...row,
      groupLabel: groupLabel(group),
      groupPassword: group.holderPassword || ''
    })))
    return sortRows(rows)
  }, [visibleGroups, sortBy])

  const totalPages = Math.max(1, Math.ceil(flatRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = flatRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  function toggleGroup(holder) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(holder)) next.delete(holder)
      else next.add(holder)
      return next
    })
  }

  function expandAll() {
    setExpanded(new Set(visibleGroups.map((g) => g.accountHolder)))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  async function handleAdd() {
    try {
      await createAccount({
        accountHolder: form.accountHolder.trim().toUpperCase(),
        holderPassword: form.holderPassword,
        password: form.holderPassword,
        bankId: form.bankId,
        bankName: getBankNameById(form.bankId) || '',
        username: form.username.trim().toLowerCase(),
        displayName: buildDisplayName(form.username.trim().toLowerCase()),
        accountNo: form.accountNo.trim(),
        note: form.note,
        status: 'pending',
        usageStatus: 'unused'
      })
      setShowAdd(false)
      setForm(EMPTY_FORM)
      setMessage('Đã thêm tài khoản')
      await load()
    } catch (err) {
      setMessage(err.message)
    }
  }

  function openAddForHolder(group) {
    setForm({
      ...EMPTY_FORM,
      accountHolder: group.accountHolder,
      holderPassword: group.holderPassword || '',
      bankId: group.bankId || DEFAULT_BANK_ID
    })
    setShowAdd(true)
  }

  function openEdit(row) {
    setEditId(row.id)
    setEditForm(rowToForm(row))
  }

  async function saveEdit() {
    if (!editId) return
    try {
      await patchAccount(editId, {
        accountHolder: editForm.accountHolder.trim().toUpperCase(),
        holderPassword: editForm.holderPassword,
        password: editForm.holderPassword,
        bankId: editForm.bankId,
        bankName: getBankNameById(editForm.bankId) || '',
        username: editForm.username.trim().toLowerCase(),
        accountNo: editForm.accountNo.trim(),
        note: editForm.note || ''
      })
      setEditId(null)
      setMessage('Đã cập nhật')
      await load()
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function toggleUsed(row) {
    await patchAccount(row.id, {
      usageStatus: row.usageStatus === 'used' ? 'unused' : 'used'
    })
    await load()
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkUsage(status) {
    const ids = [...selected]
    if (ids.length === 0) return
    for (const id of ids) {
      await patchAccount(id, { usageStatus: status })
    }
    setSelected(new Set())
    setMessage(status === 'unused' ? `Đã bỏ tick ${ids.length} acc` : `Đã đánh dấu ${ids.length} acc đã dùng`)
    await load()
  }

  async function handleDelete(id) {
    await deleteAccount(id)
    await load()
  }

  const holderCount = visibleGroups.length
  const accountCount = flatRows.length

  return (
    <div className="page">
      <div className="page-toolbar">
        <div>
          <h1>Danh sách account</h1>
          <p className="muted">Nhóm theo chủ khoản — {groups.length} chủ · {stats.total} account</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn primary" onClick={() => { setForm(EMPTY_FORM); setShowAdd(true) }}>
            + Thêm tài khoản
          </button>
        </div>
      </div>

      <section className="account-controls panel">
        <div className="account-controls-head">
          <div className="account-controls-stats">
            <span className="mini-stat"><strong>{holderCount}</strong> chủ</span>
            <span className="mini-stat"><strong>{accountCount}</strong> account</span>
            <span className="mini-stat ok">Chưa dùng <strong>{stats.accountUnused ?? 0}</strong></span>
            <span className="mini-stat warn">Đã dùng <strong>{stats.accountUsed ?? 0}</strong></span>
            {selected.size > 0 && (
              <span className="mini-stat">{selected.size} đang chọn</span>
            )}
          </div>
          <div className="account-controls-quick">
            {viewMode === 'group' && (
              <>
                <button type="button" className="btn sm" onClick={expandAll}>Mở tất cả</button>
                <button type="button" className="btn sm ghost" onClick={collapseAll}>Thu gọn</button>
              </>
            )}
            {selected.size > 0 && (
              <>
                <button type="button" className="btn sm ghost" onClick={() => bulkUsage('unused')}>
                  Bỏ tick đã dùng ({selected.size})
                </button>
                <button type="button" className="btn sm" onClick={() => bulkUsage('used')}>
                  Đánh dấu đã dùng ({selected.size})
                </button>
                <button type="button" className="btn sm ghost" onClick={() => setSelected(new Set())}>
                  Bỏ chọn
                </button>
              </>
            )}
          </div>
        </div>

        <div className="account-controls-search">
          <input
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm chủ khoản, username, STK, ngân hàng..."
          />
        </div>

        <div className="account-controls-body">
          <div className="control-group">
            <span className="control-label">Trạng thái</span>
            <div className="filter-pills">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`filter-pill ${filter === option.value ? 'active' : ''}`}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <span className="control-label">Chế độ xem</span>
            <div className="view-toggle" role="tablist" aria-label="Chế độ hiển thị">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'group'}
                className={viewMode === 'group' ? 'active' : ''}
                onClick={() => setViewMode('group')}
              >
                Theo nhóm
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'table'}
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => setViewMode('table')}
              >
                Bảng phẳng
              </button>
            </div>
          </div>

          <div className="control-group">
            <span className="control-label">Sắp xếp</span>
            <select className="control-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-info">{message}</div>}

      {accountCount === 0 ? (
        <div className="empty-state">
          <p>{groups.length === 0 ? 'Chưa có tài khoản' : 'Không có kết quả phù hợp'}</p>
          {groups.length === 0 && (
            <button type="button" className="btn primary" onClick={() => setShowAdd(true)}>Thêm tài khoản</button>
          )}
        </div>
      ) : viewMode === 'group' ? (
        visibleGroups.map((group) => {
          const isOpen = expanded.has(group.accountHolder)
          return (
            <section key={group.accountHolder} className="holder-card">
              <button type="button" className="holder-card-head holder-toggle" onClick={() => toggleGroup(group.accountHolder)}>
                <div className="holder-title">
                  <span className="chevron">{isOpen ? '▾' : '▸'}</span>
                  <div>
                    <h2>{groupLabel(group)}</h2>
                    <span className="holder-meta">MK: {group.holderPassword || '—'}</span>
                  </div>
                </div>
                <div className="holder-card-actions" onClick={(e) => e.stopPropagation()}>
                  <span className="holder-count-badge">{group.total} acc · {group.unused} trống</span>
                  <button type="button" className="btn sm" onClick={() => openAddForHolder(group)}>+ Thêm</button>
                </div>
              </button>

              {isOpen && (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={group.rows.length > 0 && group.rows.every((row) => selected.has(row.id))}
                            onChange={() => {
                              setSelected((prev) => {
                                const next = new Set(prev)
                                const allOn = group.rows.every((row) => next.has(row.id))
                                group.rows.forEach((row) => {
                                  if (allOn) next.delete(row.id)
                                  else next.add(row.id)
                                })
                                return next
                              })
                            }}
                            aria-label="Chọn nhóm"
                          />
                        </th>
                        <th>Username</th>
                        <th>Số TK</th>
                        <th>Số dư</th>
                        <th>Đã dùng</th>
                        <th>Tiến độ</th>
                        <th>Ghi chú</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id} className={row.usageStatus === 'used' ? 'is-used' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.has(row.id)}
                              onChange={() => toggleSelect(row.id)}
                            />
                          </td>
                          <td><span className="mono">{row.username}</span></td>
                          <td><span className="mono">{row.accountNo}</span></td>
                          <WalletCell
                            account={row}
                            loading={walletLoading.has(row.id)}
                            onRefresh={() => refreshWallet(row)}
                          />
                          <UsedToggle row={row} onToggleUsed={toggleUsed} />
                          <td><StatusBadge status={row.status} /></td>
                          <td className="muted">{row.note || '—'}</td>
                          <AccountRowActions row={row} onOpenInspect={openInspect} onEdit={openEdit} onDelete={handleDelete} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })
      ) : (
        <section className="panel flat-table-panel">
          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            totalItems={flatRows.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={pagedRows.length > 0 && pagedRows.every((row) => selected.has(row.id))}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          const allOn = pagedRows.every((row) => next.has(row.id))
                          pagedRows.forEach((row) => {
                            if (allOn) next.delete(row.id)
                            else next.add(row.id)
                          })
                          return next
                        })
                      }}
                      aria-label="Chọn trang"
                    />
                  </th>
                  <th>Ngân hàng · Chủ khoản</th>
                  <th>Username</th>
                  <th>Số TK</th>
                  <th>Số dư</th>
                  <th>MK</th>
                  <th>Đã dùng</th>
                  <th>Tiến độ</th>
                  <th>Ghi chú</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id} className={row.usageStatus === 'used' ? 'is-used' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                      />
                    </td>
                    <td>{row.groupLabel}</td>
                    <td><span className="mono">{row.username}</span></td>
                    <td><span className="mono">{row.accountNo}</span></td>
                    <WalletCell
                      account={row}
                      loading={walletLoading.has(row.id)}
                      onRefresh={() => refreshWallet(row)}
                    />
                    <td className="muted mono">{row.groupPassword || '—'}</td>
                    <UsedToggle row={row} onToggleUsed={toggleUsed} />
                    <td><StatusBadge status={row.status} /></td>
                    <td className="muted">{row.note || '—'}</td>
                    <AccountRowActions row={row} onOpenInspect={openInspect} onEdit={openEdit} onDelete={handleDelete} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            totalItems={flatRows.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>
      )}

      <AccountFormModal
        open={showAdd}
        title="Thêm tài khoản"
        form={form}
        onChange={setForm}
        onSubmit={handleAdd}
        onClose={() => setShowAdd(false)}
        submitLabel="Thêm"
      />

      <AccountFormModal
        open={Boolean(editId)}
        title="Sửa tài khoản"
        form={editForm}
        onChange={setEditForm}
        onSubmit={saveEdit}
        onClose={() => setEditId(null)}
        submitLabel="Lưu"
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
    </div>
  )
}
