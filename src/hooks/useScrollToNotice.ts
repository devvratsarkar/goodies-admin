import { useEffect, useRef } from 'react'

function scrollableParent(node: HTMLElement | null) {
  let current = node?.parentElement ?? null
  while (current) {
    const style = getComputedStyle(current)
    const scrolls = /(auto|scroll)/.test(`${style.overflow} ${style.overflowY}`)
    if (scrolls && current.scrollHeight > current.clientHeight + 1) return current
    current = current.parentElement
  }
  return null
}

/** Scroll a notice into view. `revision` retriggers the scroll when the same message is shown again. */
export function useScrollToNotice(message: string, revision = 0) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!message) return
    const el = ref.current
    if (!el) return
    const scroller = scrollableParent(el)
    if (scroller) {
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      scroller.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' })
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [message, revision])

  return ref
}
