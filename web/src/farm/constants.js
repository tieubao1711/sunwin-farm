export const FARM_STORAGE_KEY = 'sunwin-farm-v1'

export const ACCOUNT_STATUS = {
  pending: { label: 'Chưa chạy', tone: 'gray' },
  registered: { label: 'Mới đăng ký', tone: 'blue' },
  bank_pending: { label: 'Chờ verify bank', tone: 'yellow' },
  bank_verified: { label: 'Bank OK', tone: 'green' },
  deposited: { label: 'Đã nạp tiền', tone: 'purple' },
  error: { label: 'Lỗi', tone: 'red' }
}

export const POLL_INTERVAL_MS = 30000

/** 0 = không giới hạn (proxy xoay IP đổi ~30p) */
export const DEFAULT_ROTATING_SLOTS = 0

export function createId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
