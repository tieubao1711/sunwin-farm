import { ACCOUNT_STATUS } from '../farm/constants'

export function StatusBadge({ status }) {
  const meta = ACCOUNT_STATUS[status] || { label: status, tone: 'gray' }
  return (
    <span className={`status-badge tone-${meta.tone}`}>
      {meta.label}
    </span>
  )
}
