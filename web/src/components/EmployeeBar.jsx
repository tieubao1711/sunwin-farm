import { useEffect, useState } from 'react'
import { getEmployeeName, setEmployeeName, fetchEmployees } from '../farm/farmApi'

export function EmployeeBar() {
  const [name, setName] = useState(() => getEmployeeName())
  const [known, setKnown] = useState([])

  useEffect(() => {
    fetchEmployees().then(setKnown).catch(() => {})
  }, [name])

  function save(next) {
    setName(next)
    setEmployeeName(next)
  }

  return (
    <div className="employee-bar">
      <label>
        <span>Nhân viên</span>
        <input
          list="employee-list"
          value={name}
          onChange={(e) => save(e.target.value)}
          placeholder="Nhập tên của bạn"
        />
        <datalist id="employee-list">
          {known.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </label>
      {!name && <small className="employee-warn">Chọn tên để ghi nhận thao tác</small>}
    </div>
  )
}
