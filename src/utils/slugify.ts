/**
 * Convert a free-form name/title into a URL-safe slug.
 *
 * Examples:
 *   "Hello World!"        -> "hello-world"
 *   "  Multiple   Spaces" -> "multiple-spaces"
 *   "Café & Crème"        -> "cafe-creme"
 *   "Foo--Bar__Baz"       -> "foo-bar-baz"
 */
export function slugify(input: string, options?: { trim?: boolean }): string {
  if (!input) return ''
  const trimEdges = options?.trim !== false
  let value = input
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (trimEdges) value = value.trim()
  value = value.replace(/[^a-z0-9\s-]/g, '').replace(/[\s_-]+/g, '-')
  return trimEdges ? value.replace(/^-+|-+$/g, '') : value.replace(/^-+/g, '')
}
