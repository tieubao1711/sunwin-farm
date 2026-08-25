import { useMemo, useState } from 'react'
import { DEFAULT_ROTATING_SLOTS } from '../farm/constants'
import { useFarm } from '../farm/FarmProvider'
import { countProxyUsage, isProxyUnlimited, maskProxy } from '../farm/store'

export function ProxyManager() {
  const { state, stats, importProxies, deleteProxy, patchProxy, setSettings, refresh } = useFarm()
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [savingDefault, setSavingDefault] = useState(false)

  const usageMap = useMemo(() => {
    const map = new Map()
    state.proxies.forEach((proxy) => {
      map.set(proxy.id, countProxyUsage(state, proxy.id))
    })
    return map
  }, [state])

  const hasLegacyCap = state.proxies.some((p) => !isProxyUnlimited(p) && (p.maxSlots ?? 0) > 0)
  const defaultProxyId = state.settings?.defaultProxyId || null
  const defaultProxy = state.proxies.find((proxy) => proxy.id === defaultProxyId) || null

  async function handleImport() {
    try {
      const count = await importProxies(text)
      setText('')
      setMessage(`Đã thêm ${count} gateway xoay`)
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function removeAllCaps() {
    try {
      for (const proxy of state.proxies) {
        if (!isProxyUnlimited(proxy)) {
          await patchProxy(proxy.id, { maxSlots: 0 })
        }
      }
      await refresh()
      setMessage('Đã bỏ giới hạn slot — proxy xoay không giới hạn account')
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function setDefaultProxy(proxyId) {
    setSavingDefault(true)
    try {
      await setSettings({ defaultProxyId: proxyId || null })
      setMessage(proxyId ? 'Đã đặt gateway mặc định' : 'Đã bỏ gateway mặc định')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setSavingDefault(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Quản lý Proxy</h1>
          <p>Gateway xoay — IP đổi ~30 phút, 1 gateway phục vụ không giới hạn account</p>
        </div>
        <div className="stat-pills">
          <span className="pill">{stats.proxiesTotal} gateway</span>
          <span className="pill ok">{stats.proxyAccountsBound ?? 0} account đang dùng</span>
          {defaultProxy ? (
            <span className="pill ok">Mặc định: {maskProxy(defaultProxy.raw)}</span>
          ) : (
            <span className="pill">Chưa chọn mặc định</span>
          )}
          {stats.proxyUnlimited ? (
            <span className="pill ok">Không giới hạn</span>
          ) : (
            <span className="pill">Còn {stats.proxySlotsFree ?? 0} slot</span>
          )}
        </div>
      </div>

      <section className="panel info-box">
        Mỗi dòng là 1 <strong>gateway xoay</strong> (vd: DataImpulse). Gateway tự đổi IP khoảng{' '}
        <strong>30 phút</strong> — nhiều account có thể dùng chung 1 gateway, mỗi lần gọi API ra IP khác nhau.
        {' '}Chọn <strong>1 gateway mặc định</strong> để đăng ký mới ưu tiên dùng gateway đó (khi gateway hết tiền thì đổi mặc định sang gateway khác).
      </section>

      {hasLegacyCap && (
        <section className="panel warn-box">
          Một số gateway đang bị giới hạn slot cũ (vd: 200).
          {' '}
          <button type="button" className="btn sm primary" onClick={removeAllCaps}>
            Bỏ giới hạn — dùng không giới hạn
          </button>
        </section>
      )}

      <section className="panel">
        <h2>Thêm gateway xoay</h2>
        <p className="muted">Mỗi dòng 1 gateway — định dạng: user:pass@host:port</p>
        <textarea
          className="proxy-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'615ec4dce0eb1e0b638e__nocr.vn:8975de743c3be814@gw.dataimpulse.com:823'}
          rows={4}
        />
        <div className="row-actions">
          <button type="button" className="btn primary" onClick={handleImport}>
            Thêm gateway
          </button>
          {message && <span className="hint-msg">{message}</span>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head-row">
          <h2>Danh sách gateway ({state.proxies.length})</h2>
          {defaultProxyId && (
            <button
              type="button"
              className="btn ghost sm"
              disabled={savingDefault}
              onClick={() => setDefaultProxy(null)}
            >
              Bỏ mặc định
            </button>
          )}
        </div>
        {state.proxies.length === 0 ? (
          <p className="muted">Chưa có proxy. Dán gateway xoay phía trên.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mặc định</th>
                  <th>Gateway</th>
                  <th>Loại</th>
                  <th>Account đang dùng</th>
                  <th>Giới hạn slot</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.proxies.map((proxy) => {
                  const usage = usageMap.get(proxy.id) || 0
                  const unlimited = isProxyUnlimited(proxy)
                  const max = proxy.maxSlots ?? DEFAULT_ROTATING_SLOTS
                  const pct = !unlimited && max > 0 ? Math.round((usage / max) * 100) : 0
                  const isDefault = defaultProxyId === proxy.id

                  return (
                    <tr key={proxy.id} className={isDefault ? 'selected' : ''}>
                      <td>
                        <label className="default-proxy-radio">
                          <input
                            type="radio"
                            name="default-proxy"
                            checked={isDefault}
                            disabled={savingDefault}
                            onChange={() => setDefaultProxy(proxy.id)}
                          />
                          <span>{isDefault ? 'Đang dùng' : 'Chọn'}</span>
                        </label>
                      </td>
                      <td><code>{maskProxy(proxy.raw)}</code></td>
                      <td><span className="tag ok">Xoay · 30p</span></td>
                      <td>
                        <span className={!unlimited && usage >= max ? 'tag warn' : 'tag ok'}>
                          {usage}{unlimited ? '' : ` / ${max}`}
                        </span>
                        {!unlimited && max > 0 && (
                          <div className="proxy-usage-bar">
                            <div className="proxy-usage-fill" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="slot-field">
                          <input
                            type="number"
                            className="slot-input"
                            min={0}
                            max="99999"
                            value={max}
                            title="0 = không giới hạn"
                            onChange={async (e) => {
                              try {
                                const value = Math.max(0, Number(e.target.value) || 0)
                                await patchProxy(proxy.id, { maxSlots: value })
                              } catch (err) {
                                setMessage(err.message)
                              }
                            }}
                          />
                          <span className="muted slot-hint">
                            {unlimited ? 'Không giới hạn' : 'account tối đa'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn ghost sm"
                          disabled={usage > 0}
                          onClick={async () => {
                            try {
                              await deleteProxy(proxy.id)
                            } catch (err) {
                              setMessage(err.message)
                            }
                          }}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
