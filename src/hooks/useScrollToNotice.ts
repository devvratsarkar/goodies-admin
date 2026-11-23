import { useEffect, useRef } from 'react'

/** Scroll so an error or success notice is visible under a sticky form bar. */
export function useScrollToNotice(message: string, revision = 0) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!message) return
    const el = ref.current
    if (!el) return

    const scroller = (el.closest('.modal-body') ?? el.closest('.content-area')) as HTMLElement | null
    if (!scroller) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const bar = el.closest('.product-form-page')?.querySelector('.product-form-bar') as HTMLElement | null
    const barGap = bar ? parseFloat(getComputedStyle(bar).marginBottom) || 0 : 0
    const cover = bar ? bar.offsetHeight + barGap : 0
    const top =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      cover -
      8
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [message, revision])

  return ref
}
