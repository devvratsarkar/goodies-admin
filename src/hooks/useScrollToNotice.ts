import { useEffect, useRef } from 'react'

/** Scroll a top-of-page notice into view. `revision` retriggers the scroll when the same message is shown again. */
export function useScrollToNotice(message: string, revision = 0) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!message) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [message, revision])

  return ref
}
