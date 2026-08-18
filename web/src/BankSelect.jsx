export function BankSelect({ value, onChange, options, required = true, className = '' }) {
  return (
    <select
      className={`bank-select ${className}`.trim()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      {options.map((bank) => (
        <option key={bank.id} value={bank.id}>
          {bank.name}
        </option>
      ))}
    </select>
  )
}
