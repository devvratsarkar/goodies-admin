import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  className?: string
}

export function Modal({ title, onClose, children, wide, className }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal modal-enhanced${wide ? ' modal-wide' : ''}${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
