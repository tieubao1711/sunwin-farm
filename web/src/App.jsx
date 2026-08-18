import { useState } from 'react'
import { ServerStatus } from './components/ServerStatus'
import { EmployeeBar } from './components/EmployeeBar'
import { FarmProvider } from './farm/FarmProvider'
import { AccountList } from './pages/AccountList'
import { AccountFarm } from './pages/AccountFarm'
import { ApiTest } from './pages/ApiTest'
import { ProxyManager } from './pages/ProxyManager'
import { BankInventory } from './pages/BankInventory'
import './App.css'
import './theme.css'

const TABS = [
  { id: 'accounts', label: 'Danh sách account', hint: 'Như Excel — chủ khoản' },
  { id: 'banks', label: 'Kho ngân hàng', hint: 'STK · chủ khoản' },
  { id: 'farm', label: 'Nuôi tài khoản', hint: 'Đăng ký · verify · nạp' },
  { id: 'proxy', label: 'Quản lý Proxy', hint: 'Proxy xoay' },
  { id: 'test', label: 'Test API', hint: 'Dành cho dev' }
]

function AppShell() {
  const [tab, setTab] = useState('accounts')

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Sunwin Tool</strong>
          <span>Nuôi tài khoản</span>
        </div>
        <nav className="nav">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <span className="nav-label">{item.label}</span>
              <span className="nav-hint">{item.hint}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <EmployeeBar />
          <ServerStatus />
        </div>
      </aside>

      <main className="main">
        {tab === 'accounts' && <AccountList />}
        {tab === 'banks' && <BankInventory />}
        {tab === 'farm' && <AccountFarm />}
        {tab === 'proxy' && <ProxyManager />}
        {tab === 'test' && <ApiTest />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <FarmProvider>
      <AppShell />
    </FarmProvider>
  )
}
