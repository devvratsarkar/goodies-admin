import type { StylesConfig } from 'react-select'

type Option = { value: string; label: string }

export const countrySelectStyles: StylesConfig<Option, true> = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    background: 'var(--bg-card)',
    borderColor: state.isFocused ? 'var(--accent)' : 'var(--border)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--accent)' : 'none',
    '&:hover': { borderColor: 'var(--accent)' },
  }),
  menu: (base) => ({
    ...base,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
  }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected
      ? 'var(--accent-muted)'
      : state.isFocused
        ? 'var(--bg-hover)'
        : 'var(--bg-card)',
    color: 'var(--text)',
    cursor: 'pointer',
  }),
  multiValue: (base) => ({
    ...base,
    background: 'var(--accent-muted)',
    border: '1px solid var(--border)',
    borderRadius: 6,
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'var(--text)',
    fontWeight: 500,
    padding: '1px 4px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'var(--text-muted)',
    borderRadius: '0 6px 6px 0',
    ':hover': {
      background: 'var(--danger)',
      color: '#fff',
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--text-dim)',
  }),
  input: (base) => ({
    ...base,
    color: 'var(--text)',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--text)',
  }),
  indicatorSeparator: (base) => ({
    ...base,
    background: 'var(--border)',
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: 'var(--text-muted)',
    ':hover': { color: 'var(--text)' },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'var(--text-muted)',
    ':hover': { color: 'var(--text)' },
  }),
}
