import { useEffect, useRef, useState } from 'react'
import { canInspectAccount, INSPECT_TABS } from '../farm/accountInspect'

export function InspectMenu({ account, onOpenInspect, disabled = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handleClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  if (!canInspectAccount(account)) return null

  function pickTab(tabId) {
    setOpen(false)
    onOpenInspect(tabId)
  }

  return (
    <div className={`inspect-menu ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="btn sm inspect-menu-btn"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        Tra cứu ▾
      </button>

      {open && (
        <div className="inspect-dropdown" role="menu">
          {INSPECT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="inspect-dropdown-item"
              role="menuitem"
              onClick={() => pickTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
