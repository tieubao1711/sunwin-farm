import { useCallback, useEffect, useRef, useState } from 'react'

const STATUS_LABELS = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối WS...',
  connected: 'Đã kết nối',
  'logging-in': 'Đang login...',
  disconnected: 'Đã ngắt',
  error: 'Lỗi'
}

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/live`
}

function previewPayload(payload) {
  if (!payload) return '—'
  if (typeof payload === 'string') return payload.slice(0, 120)
  if (payload.As) {
    return `gold=${payload.As.gold}, chip=${payload.As.chip}`
  }
  try {
    const text = JSON.stringify(payload)
    return text.length > 120 ? `${text.slice(0, 120)}...` : text
  } catch {
    return String(payload)
  }
}

export function useWsMonitor({ credentials, onPersist, initialState = {} }) {
  const wsRef = useRef(null)
  const [status, setStatus] = useState(initialState.wsStatus || 'idle')
  const [profile, setProfile] = useState(initialState.wsProfile || null)
  const [wallet, setWallet] = useState(initialState.wsWallet || null)
  const [messages, setMessages] = useState(initialState.wsMessages || [])
  const [error, setError] = useState(initialState.wsError || '')
  const [connectedAt, setConnectedAt] = useState(initialState.wsConnectedAt || null)
  const [lastMessageAt, setLastMessageAt] = useState(
    initialState.wsMessages?.[0]?.at || null
  )

  const persist = useCallback((patch) => {
    if (onPersist) onPersist(patch)
  }, [onPersist])

  const pushMessage = useCallback((entry) => {
    setMessages((prev) => {
      const next = [entry, ...prev].slice(0, 100)
      persist({ wsMessages: next })
      return next
    })
    setLastMessageAt(entry.at || Date.now())
  }, [persist])

  const disconnect = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'disconnect' }))
      ws.close()
    }
    wsRef.current = null
    setStatus('disconnected')
    persist({ wsStatus: 'disconnected' })
  }, [persist])

  const connect = useCallback(() => {
    if (!credentials?.username || !credentials?.password) {
      setError('Nhập username/password trước khi kết nối WS')
      return
    }

    disconnect()
    setError('')
    setStatus('logging-in')
    persist({ wsStatus: 'logging-in' })

    const ws = new WebSocket(getWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'connect',
        username: credentials.username,
        password: credentials.password,
        proxyUrl: credentials.proxyUrl || ''
      }))
    }

    ws.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }

      if (data.type === 'status') {
        setStatus(data.status)
        persist({ wsStatus: data.status })
        if (data.status === 'connected') {
          setConnectedAt(data.at || Date.now())
          persist({ wsConnectedAt: data.at || Date.now() })
        }
      }

      if (data.type === 'login') {
        setProfile(data.profile || null)
        persist({ wsProfile: data.profile || null })
      }

      if (data.type === 'wallet') {
        setWallet(data.wallet || null)
        persist({ wsWallet: data.wallet || null })
      }

      if (data.type === 'message' && data.entry) {
        pushMessage(data.entry)
      }

      if (data.type === 'error') {
        setError(data.message || 'WebSocket error')
        setStatus('error')
        persist({ wsStatus: 'error', wsError: data.message || 'WebSocket error' })
      }
    }

    ws.onclose = () => {
      if (wsRef.current === ws) {
        setStatus((prev) => (prev === 'error' ? prev : 'disconnected'))
        wsRef.current = null
      }
    }

    ws.onerror = () => {
      setError('Không thể kết nối WebSocket bridge')
      setStatus('error')
    }
  }, [credentials, disconnect, persist, pushMessage])

  const clearLog = useCallback(() => {
    setMessages([])
    persist({ wsMessages: [] })
  }, [persist])

  useEffect(() => () => disconnect(), [disconnect])

  return {
    status,
    statusLabel: STATUS_LABELS[status] || status,
    profile,
    wallet,
    messages,
    error,
    connectedAt,
    lastMessageAt,
    connect,
    disconnect,
    clearLog,
    previewPayload
  }
}

export { STATUS_LABELS }
