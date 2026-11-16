import { ImageSourceField } from '../media/ImageSourceField'
import { FormField } from '../ui/FormField'

export type SearchSocialValues = {
  meta_title: string
  meta_description: string
  meta_keywords: string
  og_title: string
  og_description: string
  twitter_title: string
  twitter_description: string
  json_ld: string
}

type SearchSocialKey = keyof SearchSocialValues

export function SearchAndSocialCard({
  values,
  onChange,
  isEdit,
  ogImageFile,
  twitterImageFile,
  ogImageUrl = '',
  twitterImageUrl = '',
  existingOgImage,
  existingTwitterImage,
  fallbackOgImage,
  fallbackTwitterImage,
  onOgImageChange,
  onTwitterImageChange,
  onOgImageUrlChange,
  onTwitterImageUrlChange,
  onExistingOgImageChange,
  onExistingTwitterImageChange,
}: {
  values: SearchSocialValues
  onChange: (key: SearchSocialKey, value: string) => void
  isEdit: boolean
  ogImageFile: File | null
  twitterImageFile: File | null
  ogImageUrl?: string
  twitterImageUrl?: string
  existingOgImage: string
  existingTwitterImage: string
  fallbackOgImage?: string
  fallbackTwitterImage?: string
  onOgImageChange: (file: File | null) => void
  onTwitterImageChange: (file: File | null) => void
  onOgImageUrlChange?: (url: string) => void
  onTwitterImageUrlChange?: (url: string) => void
  onExistingOgImageChange?: (value: string) => void
  onExistingTwitterImageChange?: (value: string) => void
}) {
  const imageHint = isEdit
    ? 'Leave empty to keep the current image'
    : 'Uses the product thumbnail unless you choose another image'

  return (
    <section className="social-card">
      <div className="social-card__head">
        <h2 className="social-card__heading">Search and social</h2>
        <p className="social-card__lead">
          {isEdit
            ? 'Optional. Used for search results and link previews.'
            : 'Filled from the product title, description, price, and thumbnail. Edit a field to keep your own text.'}
        </p>
      </div>

      <div className="social-card__section">
        <h3 className="social-card__title">SEO</h3>
        <p className="social-card__hint">Title, description, and keywords shown in search results.</p>
        <div className="form-row">
          <FormField label="Meta title">
            <input
              className="input"
              value={values.meta_title}
              onChange={(e) => onChange('meta_title', e.target.value)}
            />
          </FormField>
          <FormField label="Meta description">
            <textarea
              className="textarea"
              rows={2}
              value={values.meta_description}
              onChange={(e) => onChange('meta_description', e.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Meta keywords" hint="Separate keywords with commas.">
          <input
            className="input"
            value={values.meta_keywords}
            placeholder="gifts, chocolates, hampers"
            onChange={(e) => onChange('meta_keywords', e.target.value)}
          />
        </FormField>
      </div>

      <div className="social-card__section">
        <h3 className="social-card__title">Open Graph</h3>
        <p className="social-card__hint">Used when a link is shared.</p>
        <div className="form-row">
          <FormField label="OG title">
            <input
              className="input"
              value={values.og_title}
              onChange={(e) => onChange('og_title', e.target.value)}
            />
          </FormField>
          <FormField label="OG description">
            <textarea
              className="textarea"
              rows={2}
              value={values.og_description}
              onChange={(e) => onChange('og_description', e.target.value)}
            />
          </FormField>
        </div>
        <ImageSourceField
          label="OG image"
          hint={imageHint}
          file={ogImageFile}
          url={ogImageUrl}
          existing={existingOgImage}
          fallbackSrc={fallbackOgImage}
          onFileChange={onOgImageChange}
          onUrlChange={onOgImageUrlChange}
          onExistingChange={onExistingOgImageChange}
        />
      </div>

      <div className="social-card__section">
        <h3 className="social-card__title">Twitter</h3>
        <p className="social-card__hint">Used for Twitter and X link cards.</p>
        <div className="form-row">
          <FormField label="Twitter title">
            <input
              className="input"
              value={values.twitter_title}
              onChange={(e) => onChange('twitter_title', e.target.value)}
            />
          </FormField>
          <FormField label="Twitter description">
            <textarea
              className="textarea"
              rows={2}
              value={values.twitter_description}
              onChange={(e) => onChange('twitter_description', e.target.value)}
            />
          </FormField>
        </div>
        <ImageSourceField
          label="Twitter image"
          hint={imageHint}
          file={twitterImageFile}
          url={twitterImageUrl}
          existing={existingTwitterImage}
          fallbackSrc={fallbackTwitterImage}
          onFileChange={onTwitterImageChange}
          onUrlChange={onTwitterImageUrlChange}
          onExistingChange={onExistingTwitterImageChange}
        />
      </div>

      <div className="social-card__section">
        <h3 className="social-card__title">JSON-LD</h3>
        <p className="social-card__hint">Structured data for search engines.</p>
        <FormField label="JSON-LD">
          <textarea
            className="textarea"
            rows={4}
            value={values.json_ld}
            placeholder={'{"@context":"https://schema.org","@type":"Product"}'}
            onChange={(e) => onChange('json_ld', e.target.value)}
          />
        </FormField>
      </div>
    </section>
  )
}
