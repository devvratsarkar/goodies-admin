import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function FormField({ label, htmlFor, hint, error, required, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor} className="form-field-label">
        {label}
        {required && <span className="form-field-required">*</span>}
      </label>
      {hint && <span className="form-field-hint">{hint}</span>}
      {children}
      {error && <span className="form-field-error">{error}</span>}
    </div>
  )
}
