export type StorePage =
  | "home"
  | "shop"
  | "products"
  | "categories"
  | "category"
  | "global"
  | "page-notices"
  | "articles"
  | "faqs"
  | { page: "product"; slug: string }
  | { page: "category"; slug: string }
  | { page: "article"; slug: string }
  | { page: "blog-category"; slug: string }

export async function revalidateStore(pages: StorePage[] = ["home"]) {
  const storeUrl = import.meta.env.VITE_STORE_URL as string | undefined
  const secret = import.meta.env.VITE_REVALIDATE_SECRET as string | undefined
  if (!storeUrl || !secret) return

  try {
    await fetch(`${storeUrl.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ pages }),
    })
  } catch {
    // The catalog save already succeeded. A down storefront should not fail that save.
  }
}
