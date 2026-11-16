type ConfirmOptions = {
  title?: string
  confirmText?: string
  cancelText?: string
}

export function adminConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)

  const {
    title = 'Please confirm',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
  } = options

  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.background = 'rgba(0, 0, 0, 0.6)'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.padding = '20px'
    overlay.style.zIndex = '2000'

    const modal = document.createElement('div')
    modal.style.width = '100%'
    modal.style.maxWidth = '420px'
    modal.style.borderRadius = '10px'
    modal.style.border = '1px solid var(--border, #2d3d52)'
    modal.style.background = 'var(--bg-card, #1e2a3a)'
    modal.style.color = 'var(--text, #e2e8f0)'
    modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
    modal.style.overflow = 'hidden'

    const header = document.createElement('div')
    header.style.padding = '16px 18px'
    header.style.borderBottom = '1px solid var(--border, #2d3d52)'
    header.style.fontSize = '1rem'
    header.style.fontWeight = '700'
    header.textContent = title

    const body = document.createElement('div')
    body.style.padding = '16px 18px'
    body.style.fontSize = '0.93rem'
    body.style.color = 'var(--text-muted, #94a3b8)'
    body.textContent = message

    const footer = document.createElement('div')
    footer.style.padding = '12px 18px 16px'
    footer.style.display = 'flex'
    footer.style.gap = '10px'
    footer.style.justifyContent = 'flex-end'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.textContent = cancelText
    cancelBtn.style.padding = '8px 14px'
    cancelBtn.style.borderRadius = '6px'
    cancelBtn.style.border = '1px solid var(--border, #2d3d52)'
    cancelBtn.style.background = 'transparent'
    cancelBtn.style.color = 'var(--text, #e2e8f0)'
    cancelBtn.style.cursor = 'pointer'

    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.textContent = confirmText
    confirmBtn.style.padding = '8px 14px'
    confirmBtn.style.borderRadius = '6px'
    confirmBtn.style.border = 'none'
    confirmBtn.style.background = 'var(--accent, #38bdf8)'
    confirmBtn.style.color = '#fff'
    confirmBtn.style.cursor = 'pointer'

    const cleanup = () => {
      document.removeEventListener('keydown', onKeydown)
      overlay.remove()
    }

    const closeWith = (value: boolean) => {
      cleanup()
      resolve(value)
    }

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWith(false)
      if (e.key === 'Enter') closeWith(true)
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeWith(false)
    })
    cancelBtn.addEventListener('click', () => closeWith(false))
    confirmBtn.addEventListener('click', () => closeWith(true))
    document.addEventListener('keydown', onKeydown)

    footer.appendChild(cancelBtn)
    footer.appendChild(confirmBtn)
    modal.appendChild(header)
    modal.appendChild(body)
    modal.appendChild(footer)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    cancelBtn.focus()
  })
}
