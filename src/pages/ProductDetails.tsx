import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { productsApi } from '../api/endpoints'
import { getProfileImageUrl } from '../api/client'
import { hydrateBundleItems } from '../components/products/BundleItemsPicker'
import type { Product, ProductType } from '../types/api'

const TYPE_LABEL: Record<ProductType, string> = {
  simple: 'Single product',
  variable: 'Variable',
  bundle: 'Bundle',
}

const ARABIC = /[\u0600-\u06FF]/

function resolveProductType(product: Product): ProductType {
  if (product.product_type === 'simple' || product.product_type === 'variable' || product.product_type === 'bundle') {
    return product.product_type
  }
  if (Array.isArray(product.bundle_items) && product.bundle_items.length > 0) return 'bundle'
  if (product.is_variant || (product.variants?.length ?? 0) > 0) return 'variable'
  return 'simple'
}

function refName(value: Product['categoryId']): string {
  if (!value || typeof value === 'string') return ''
  return value.name || ''
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function money(value: number | null): string {
  if (value === null) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function rangeLabel(values: Array<number | null>, suffix = ''): string {
  const nums = values.filter((value): value is number => value !== null)
  if (!nums.length) return ''
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const text = min === max ? money(min) : `${money(min)} – ${money(max)}`
  return suffix ? `${text} ${suffix}` : text
}

function Value({ v }: { v: string | number | null | undefined }) {
  if (v === null || v === undefined || v === '') {
    return <span className="product-detail__empty">Not set</span>
  }
  const text = String(v)
  return <span dir={ARABIC.test(text) ? 'rtl' : undefined}>{text}</span>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="product-detail__field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Row({ label, v }: { label: string; v: string | number | null | undefined }) {
  return (
    <div className="product-detail__row">
      <dt>{label}</dt>
      <dd>
        <Value v={v} />
      </dd>
    </div>
  )
}

function Pill({ tone = 'slate', children }: { tone?: 'green' | 'red' | 'slate'; children: ReactNode }) {
  return <span className={`product-detail__pill product-detail__pill--${tone}`}>{children}</span>
}

function Card({
  title,
  action,
  children,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="product-detail__card">
      {title && (
        <header className="product-detail__card-head">
          <h2>{title}</h2>
          {action}
        </header>
      )}
      <div className="product-detail__card-body">{children}</div>
    </section>
  )
}

export function ProductDetails() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const [showSchema, setShowSchema] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setActive(0)
    setShowSchema(false)
    productsApi
      .getById(id)
      .then((res) => {
        const body = res.data as { data?: unknown }
        setProduct((body.data ?? res.data) as Product)
      })
      .catch(() => setError('Failed to load product details'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page-loading">Loading...</div>

  const storeOrigin = (import.meta.env.VITE_STORE_URL as string | undefined)?.replace(/\/$/, '') || ''
  const productPath = product?.slug ? `/product/${product.slug}` : ''
  const storeUrl = storeOrigin && productPath ? `${storeOrigin}${productPath}` : productPath

  return (
    <div className="product-detail">
      {error && (
        <div className="product-detail__main">
          <div className="alert alert-error">{error}</div>
        </div>
      )}

      {!error && product && (
        <ProductDetailBody
          product={product}
          storeUrl={storeUrl}
          productPath={productPath}
          active={active}
          setActive={setActive}
          copied={copied}
          setCopied={setCopied}
          showSchema={showSchema}
          setShowSchema={setShowSchema}
        />
      )}
    </div>
  )
}

function ProductDetailBody({
  product,
  storeUrl,
  productPath,
  active,
  setActive,
  copied,
  setCopied,
  showSchema,
  setShowSchema,
}: {
  product: Product
  storeUrl: string
  productPath: string
  active: number
  setActive: (index: number) => void
  copied: boolean
  setCopied: (value: boolean) => void
  showSchema: boolean
  setShowSchema: (value: boolean | ((current: boolean) => boolean)) => void
}) {
  const productType = resolveProductType(product)
  const bundleItems = productType === 'bundle' ? hydrateBundleItems(product.bundle_items) : []
  const badges = [
    product.most_loved ? 'Most loved' : '',
    product.is_best_seller ? 'Best seller' : '',
    product.is_new_arrival ? 'New arrival' : '',
  ].filter(Boolean)
  const gallery = [...(product.thumbnail ? [product.thumbnail] : []), ...(product.images ?? [])]
  const imageIndex = gallery.length ? Math.min(active, gallery.length - 1) : 0
  const live = Boolean(product.status) && (product.transition || 'publish') === 'publish'
  const variants = product.variants ?? []

  const simpleQty = num(product.variant?.stock ?? product.stock)
  const simplePrice = num(product.variant?.price ?? product.price)
  const simpleMax = num(product.variant?.max_price)
  const simpleWeight = num(product.weight)
  const simpleSku = product.variant?.sku || product.sku || ''

  const knownStocks = variants.map((variant) => num(variant.stock)).filter((value): value is number => value !== null)
  const variantQty = knownStocks.length ? knownStocks.reduce((sum, value) => sum + value, 0) : null
  const qty = productType === 'variable' ? variantQty : simpleQty
  const out = qty !== null && qty <= 0

  const priceLabel =
    productType === 'variable'
      ? rangeLabel(variants.map((variant) => num(variant.price)))
      : money(simplePrice)
  const maxLabel =
    productType === 'variable'
      ? rangeLabel(variants.map((variant) => num(variant.max_price)), 'AED')
      : simpleMax === null
        ? ''
        : `${money(simpleMax)} AED`
  const variantWeights = variants.map((variant) => num(variant.weight))
  const weightLabel =
    productType === 'variable'
      ? rangeLabel(variantWeights.some((value) => value !== null) ? variantWeights : [simpleWeight], 'kg')
      : simpleWeight === null
        ? ''
        : `${money(simpleWeight)} kg`

  const seoChecks: Array<[string, boolean]> = [
    ['Meta title', Boolean(product.meta_title)],
    ['Meta description', Boolean(product.meta_description)],
    ['OG description', Boolean(product.og_description)],
    ['Twitter description', Boolean(product.twitter_description)],
    ['Product description', Boolean(product.description)],
    ['Social images', Boolean(product.og_image && product.twitter_image)],
  ]
  const done = seoChecks.filter(([, ok]) => ok).length
  const schemaText = product.json_ld || ''
  let schemaPretty = schemaText
  try {
    if (schemaText) schemaPretty = JSON.stringify(JSON.parse(schemaText), null, 2)
  } catch {
    schemaPretty = schemaText
  }
  const localhostImage = schemaText.includes('localhost')

  const copySchema = async () => {
    try {
      await navigator.clipboard.writeText(schemaText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const ogImage = getProfileImageUrl(product.og_image) || getProfileImageUrl(gallery[0])
  const twitterImage = getProfileImageUrl(product.twitter_image) || getProfileImageUrl(gallery[0])

  return (
    <main className="product-detail__main">
      <section className="product-detail__card">
        <div className="product-detail__hero">
          <div>
            <div className="product-detail__stage">
              {gallery.length > 0 ? (
                <img src={getProfileImageUrl(gallery[imageIndex])} alt={product.title || ''} />
              ) : (
                <div className="product-detail__stage-empty">No image</div>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="product-detail__thumbs">
                {gallery.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    aria-label={`Show image ${index + 1}`}
                    className={index === imageIndex ? 'is-active' : ''}
                    onClick={() => setActive(index)}
                  >
                    <img src={getProfileImageUrl(src)} alt="" />
                  </button>
                ))}
              </div>
            )}
            <p className="product-detail__hint">
              {product.thumbnail ? 'First image is the thumbnail.' : 'No thumbnail is set.'}
            </p>
          </div>

          <div className="product-detail__identity">
            <div className="product-detail__pills">
              <Pill tone={live ? 'green' : 'slate'}>
                <span className={`product-detail__dot ${live ? 'is-live' : ''}`} />
                {live ? 'Live on store' : `${product.status ? 'Active' : 'Inactive'}, ${product.transition || 'draft'}`}
              </Pill>
              {product.stock_manage === false ? (
                <Pill tone={product.stock_status === 'out_of_stock' ? 'red' : 'green'}>
                  {product.stock_status === 'out_of_stock' ? 'Out of stock' : 'In stock'}
                </Pill>
              ) : (
                qty !== null && <Pill tone={out ? 'red' : 'green'}>{out ? 'Out of stock' : `${qty} in stock`}</Pill>
              )}
              <Pill>{TYPE_LABEL[productType]}</Pill>
            </div>

            <h1 dir="auto">{product.title || 'Untitled product'}</h1>
            {product.short_description && (
              <p className="product-detail__subtitle" dir="auto">
                {product.short_description}
              </p>
            )}

            <dl className="product-detail__facts">
              <Field label="Category">
                <Value v={refName(product.categoryId)} />
              </Field>
              <Field label="Brand">
                <Value v={refName(product.brandId)} />
              </Field>
              <Field label="Badges">
                <Value v={badges.join(', ')} />
              </Field>
            </dl>

            <div className="product-detail__url">
              <div>Store URL</div>
              <div dir="auto" title={storeUrl || productPath}>
                {productPath || 'Not set'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="product-detail__columns">
        <div className="product-detail__stack">
          {out && live && product.stock_manage !== false && productType !== 'bundle' && (
            <div className="product-detail__warn">
              <span aria-hidden>⚠</span>
              <p>
                This product is published but has no stock, so customers can't buy it. Update the quantity or hide it
                from the store.
              </p>
            </div>
          )}

          <Card title="Description">
            <dl className="product-detail__rows">
              <Row label="Description" v={product.description} />
              <Row label="Custom notes" v={product.custom_notes} />
            </dl>
            {!product.description && (
              <p className="product-detail__note">
                Add a short description so customers know what's inside and how it tastes.
              </p>
            )}
          </Card>

          {productType === 'variable' && (
            <Card title="Sizes and variants">
              <p className="product-detail__lead">
                Sizes: {(product.sizes ?? []).map((size) => size.name).filter(Boolean).join(', ') || 'Not set'}
              </p>
              {variants.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>SKU</th>
                        <th>Stock</th>
                        <th>Stock status</th>
                        <th>MRP</th>
                        <th>Selling price</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((variant, index) => (
                        <tr key={`${variant.sku}-${variant.size}-${index}`}>
                          <td>{variant.size || '—'}</td>
                          <td>{variant.sku || '—'}</td>
                          <td>{variant.stock_manage === false ? 'Not tracked' : (variant.stock ?? '—')}</td>
                          <td>
                            {variant.stock_manage === false
                              ? '—'
                              : variant.stock_status === 'out_of_stock'
                                ? 'Out of stock'
                                : 'In stock'}
                          </td>
                          <td>{money(num(variant.max_price)) || '—'}</td>
                          <td>{money(num(variant.price)) || '—'}</td>
                          <td>{num(variant.weight) === null ? '—' : `${money(num(variant.weight))} kg`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="product-detail__note">No variants yet.</p>
              )}
            </Card>
          )}

          {productType === 'bundle' && (
            <Card title="Bundle">
              <p className="product-detail__lead">
                Max selection: {product.max_selection ?? 'Not set'} · Max single product quantity: {product.max_product_quantity ?? 'Not set'}
              </p>
              {bundleItems.length === 0 ? (
                <p className="product-detail__note">No products in this bundle.</p>
              ) : (
                <div className="product-detail__bundle">
                  {bundleItems.map((item, index) => (
                    <div key={`${item.product_id}-${item.variant_key || 'simple'}`} className="product-detail__bundle-item">
                      <strong>#{index + 1}</strong>
                      {item.thumbnail ? (
                        <img src={getProfileImageUrl(item.thumbnail)} alt="" />
                      ) : (
                        <span className="product-detail__bundle-empty" />
                      )}
                      <div>
                        <div className="product-detail__bundle-title">{item.title}</div>
                        <div className="product-detail__note">
                          {item.product_type}
                          {item.sku ? ` · ${item.sku}` : ''}
                          {item.variant_label ? ` · ${item.variant_label}` : ''}
                          {item.missing ? ' · unavailable' : ''}
                          {item.missing_variant ? ' · selected variant is no longer available' : ''}
                        </div>
                        <div>
                          {item.max_price > item.selling_price ? `MRP ${money(num(item.max_price))} AED · ` : ''}
                          Selling price {money(num(item.selling_price)) || '—'} AED
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card title="SEO and sharing" action={<span className="product-detail__meta">{done} of {seoChecks.length} complete</span>}>
            <div className="product-detail__meter">
              <div
                className={done === seoChecks.length ? 'is-done' : ''}
                style={{ width: `${(done / seoChecks.length) * 100}%` }}
              />
            </div>
            <ul className="product-detail__checks">
              {seoChecks.map(([label, ok]) => (
                <li key={label}>
                  <span className={ok ? 'is-ok' : ''} aria-hidden>
                    {ok ? '✓' : ''}
                  </span>
                  <span className={ok ? '' : 'is-missing'}>
                    {label}
                    {!ok && ' is missing'}
                  </span>
                </li>
              ))}
            </ul>

            <div className="product-detail__block">
              <h3>How it appears in Google</h3>
              <div className="product-detail__google">
                <div className="product-detail__google-url">{storeUrl || 'Store URL is not configured'}</div>
                <div className="product-detail__google-title" dir="auto">
                  {product.meta_title || product.title || 'Untitled product'}
                </div>
                <div dir="auto">
                  {product.meta_description || (
                    <span className="product-detail__empty">No meta description. Google will pick text from the page.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="product-detail__social">
              <SocialCard
                label="Open Graph (Facebook, WhatsApp)"
                image={ogImage}
                title={product.og_title || product.meta_title || product.title}
                description={product.og_description}
              />
              <SocialCard
                label="Twitter card"
                image={twitterImage}
                title={product.twitter_title || product.meta_title || product.title}
                description={product.twitter_description}
              />
            </div>

            <div className="product-detail__schema">
              {schemaText ? (
                <>
                  <div className="product-detail__schema-bar">
                    <button type="button" aria-expanded={showSchema} onClick={() => setShowSchema((open) => !open)}>
                      {showSchema ? 'Hide structured data' : 'Show structured data (JSON-LD)'}
                    </button>
                    {showSchema && (
                      <button type="button" className="product-detail__copy" onClick={copySchema}>
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  {localhostImage && (
                    <p className="product-detail__schema-warn">
                      The image URL points to localhost. Search engines can't load it, so use your public image URL.
                    </p>
                  )}
                  {showSchema && <pre>{schemaPretty}</pre>}
                </>
              ) : (
                <p className="product-detail__lead">Structured data is not set.</p>
              )}
            </div>
          </Card>
        </div>

        <aside className="product-detail__aside">
          <Card title="Pricing">
            <div className="product-detail__price">
              <span>{priceLabel || '—'}</span>
              {priceLabel && <small>AED</small>}
            </div>
            <p className="product-detail__note">Selling price. MRP is the original price, shown when it is higher.</p>
            <dl className="product-detail__side-rows">
              <div>
                <dt>MRP</dt>
                <dd>{maxLabel || 'Not set'}</dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{weightLabel || 'Not set'}</dd>
              </div>
              {productType === 'bundle' && (
                <>
                  <div>
                    <dt>Max selection</dt>
                    <dd>{product.max_selection ?? 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>Max single product quantity</dt>
                    <dd>{product.max_product_quantity ?? 'Not set'}</dd>
                  </div>
                </>
              )}
            </dl>
          </Card>

          <Card title="Inventory">
            {qty !== null && (
              <div className="product-detail__qty">
                <span>Quantity</span>
                <strong className={out ? 'is-out' : ''}>{qty}</strong>
              </div>
            )}
            {productType === 'bundle' && (
              <div className="product-detail__qty">
                <span>Items in bundle</span>
                <strong>{bundleItems.length}</strong>
              </div>
            )}
            <div className="product-detail__sku">
              <span>SKU</span>
              <code>{productType === 'variable' ? simpleSku || 'Per size' : simpleSku || 'Not set'}</code>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  )
}

function SocialCard({
  label,
  image,
  title,
  description,
}: {
  label: string
  image?: string
  title?: string | null
  description?: string | null
}) {
  return (
    <div>
      <h3>{label}</h3>
      <div className="product-detail__share">
        {image ? <img src={image} alt="" /> : <div className="product-detail__share-empty">No image</div>}
        <div>
          <div dir="auto">{title || 'Untitled product'}</div>
          <p dir="auto">{description || 'No description'}</p>
        </div>
      </div>
    </div>
  )
}
