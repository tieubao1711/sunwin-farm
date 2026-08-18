import { useEffect, useState } from 'react'
import { checkHealth } from '../api'

export function ServerStatus() {
  const [serverOk, setServerOk] = useState(null)
  const [version, setVersion] = useState('')
  const [mongoOk, setMongoOk] = useState(null)

  useEffect(() => {
    checkHealth()
      .then((data) => {
        setServerOk(Boolean(data.ok))
        setVersion(data.version || '')
        setMongoOk(Boolean(data.mongodb))
      })
      .catch(() => setServerOk(false))
  }, [])

  const allOk = serverOk && mongoOk

  return (
    <div className={`status ${allOk ? 'ok' : 'bad'}`}>
      API: {serverOk === null ? '...' : serverOk ? `v${version}` : 'offline'}
      {serverOk && (
        <span> · MongoDB: {mongoOk ? 'OK' : 'lỗi'}</span>
      )}
    </div>
  )
}
