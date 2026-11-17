// Auth
export interface LoginPayload {
  email: string
  password: string
}

export interface AdminProfile {
  _id: string
  name?: string
  email: string
  first_name?: string
  last_name?: string
  profile_pic?: string
  phone_number?: string | null
  country?: string | null
  role?: string | { _id?: string; name?: string; id?: number }
  alt_phone?: string | null
  status?: boolean
  createdAt?: string
  updatedAt?: string
  access?: AdminAccess
}

export interface AdminAccess {
  all: boolean
  owner: boolean
  role: { _id: string | null; name: string } | null
  permissions: Partial<Record<string, string[]>>
}

export interface AccessRole {
  _id: string
  name: string
  description?: string
  is_super: boolean
  is_system: boolean
  permissions: Partial<Record<string, string[]>>
  user_count: number
  createdAt?: string
  updatedAt?: string
}

export interface StaffMember {
  _id: string
  id?: number
  name: string
  last_name?: string
  email: string
  phone_number?: string | null
  status: boolean
  role: { _id: string; name: string; is_super: boolean } | null
  createdAt?: string
  updatedAt?: string
}

export interface User {
  _id: string
  email?: string | null
  first_name?: string
  last_name?: string
  phone?: string | null
  profile_pic?: string | null
  status?: string
  kyc_status?: string
  role?: { _id: string; name: string } | string
  created_at?: string
  createdAt?: string
}

export interface CustomerUser {
  _id: string
  id?: number
  name?: string
  last_name?: string
  profile_pic?: string | null
  email?: string
  phone_number?: string | null
  alt_phone?: string | null
  is_verified?: boolean
  status?: string
  country?: string | null
  state?: string | null
  postal_code?: string | null
  role?: { id?: number; name?: string } | string
  joinDate?: string
  purchases?: number
  spend_orders?: number
  total_spend?: number
  aov?: number
  createdAt?: string
  updatedAt?: string
}

// Service Categories
export interface ServiceCategory {
  _id: string
  title: string
  description?: string | null
  status: 'ACTIVE' | 'INACTIVE'
  parent_category?: string | { _id: string; title: string }
  options?: Array<{ label: string; status: string }>
  image?: string
  credit?: string | number
  individual_credit?: string | number
  company_credit?: string | number
  frequency?: string[] | string | null
  is_frequency_visible?: boolean
  is_start_date_visible?: boolean
  is_start_time_visible?: boolean
  is_end_date_visible?: boolean
  is_end_time_visible?: boolean
  is_preferred_time_visible?: boolean
  is_preferred_date_visible?: boolean
  created_at?: string
}

// FAQs
export interface FAQ {
  _id: string
  question: string
  answer: string
  status?: boolean
  created_at?: string
}

export interface Category {
  _id: string
  name: string
  slug: string
  parent_category?: string | { _id: string; name?: string; slug?: string } | null
  is_mega_menu?: boolean
  status?: boolean
  totalProducts?: number
  createdAt?: string
  deletedAt?: string | null
  image?: string | null
  description?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string | null
  og_title?: string | null
  og_description?: string | null
  og_image?: string | null
  twitter_title?: string | null
  twitter_description?: string | null
  twitter_image?: string | null
  json_ld?: string | null
  faqs?: CategoryFaq[]
}

export type CategoryFaq = {
  _id?: string
  question: string
  answer: string
  status?: boolean
}

export type CategoryPayload = {
  name: string
  slug: string
  status: boolean
  parent_category?: string | null
  is_mega_menu?: boolean
  description?: string
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  og_title?: string
  og_description?: string
  twitter_title?: string
  twitter_description?: string
  json_ld?: string
  faqs?: string
  image?: File | string
  og_image?: File | string
  twitter_image?: File | string
}

export interface Brand {
  _id: string
  name: string
  slug: string
  status?: boolean
  createdAt?: string
  deletedAt?: string | null
  product_count?: number
}

export interface Color {
  _id: string
  name: string
  code: string
  status?: boolean
}

export interface Size {
  _id: string
  name: string
  slug?: string
  status?: boolean
  totalProducts?: number
  deletedAt?: string | null
}

export type CouponType = 'Percentage' | 'Fixed' | 'Flat' | string

export interface Coupon {
  _id: string
  coupon_code: string
  description?: string
  coupon_type: CouponType
  value: number
  no_coupon?: number
  used_count?: number
  discount_given?: number
  start_date?: string
  expiry_date?: string
  minimum_cart_value?: number
  status?: boolean
  is_auto_apply?: boolean
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

export interface CouponUsageUser {
  _id?: string
  id?: number
  name?: string
  email?: string
}

export interface CouponUsageCoupon {
  _id?: string
  id?: number
  coupon_code?: string
  coupon_type?: CouponType
  value?: number
}

export interface CouponUsageOrder {
  _id?: string
  id?: number
  order_number?: string | number
  total_amount?: number
  currency?: string
}

export interface CouponUsage {
  _id: string
  id?: number
  user_id?: CouponUsageUser | string | null
  coupon_id?: CouponUsageCoupon | string | null
  order_id?: CouponUsageOrder | string | null
  user?: CouponUsageUser | null
  coupon?: CouponUsageCoupon | null
  order?: CouponUsageOrder | null
  coupon_code?: string
  coupon_type?: string
  cart_amount?: number
  discount_amount?: number
  order_total?: number
  currency?: string
  type?: string
  createdAt?: string
  updatedAt?: string
}

export interface CouponUsagePagination {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
}

export type EmailNotificationKey =
  | 'new_order'
  | 'cancel_order_customer'
  | 'cancel_order'
  | 'failed_order_customer'
  | 'failed_order'
  | 'order_on_hold'
  | 'processing_order'
  | 'completed_order'
  | 'refunded_order'
  | 'customer_note'
  | 'reset_password'
  | 'new_account'
  | 'confirm_email_address'
  | string

export interface EmailNotificationSetting {
  _id: string
  id?: number
  key: EmailNotificationKey
  label?: string
  enabled?: boolean
  recipients?: string
  cc_receipients?: string
  subject?: string
  heading?: string
  additional_content?: string
  createdAt?: string
  updatedAt?: string
}

export type ProductType = 'simple' | 'variable' | 'bundle'

export interface Product {
  _id: string
  title: string
  slug: string
  sku?: string
  stock?: number
  weight?: number
  thumbnail?: string
  images?: string[]
  product_type?: ProductType
  colors?: Array<{ name: string; code?: string }>
  sizes?: Array<{ name: string }>
  variants?: Array<{
    sku?: string
    color?: string
    size?: string
    attributes?: Record<string, string>
    stock?: number
    price?: number
    max_price?: number
    weight?: number
    status?: boolean
    is_default?: boolean
    stock_manage?: boolean
    stock_status?: 'in_stock' | 'out_of_stock' | string
  }>
  variant?: {
    sku?: string
    stock?: number
    price?: number
    max_price?: number
  }
  is_variant?: boolean
  categoryId?: string | { _id?: string; name?: string }
  brandId?: string | { _id?: string; name?: string }
  price?: number
  status?: boolean
  most_loved?: boolean
  is_best_seller?: boolean
  is_new_arrival?: boolean
  custom_notes?: string
  description?: string
  short_description?: string
  return?: string
  payment_options?: string
  transition?: string
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string | null
  og_title?: string | null
  og_description?: string | null
  og_image?: string | null
  twitter_title?: string | null
  twitter_description?: string | null
  twitter_image?: string | null
  json_ld?: string | null
  bundle_items?: BundleItemRef[]
  stock_manage?: boolean
  stock_status?: 'in_stock' | 'out_of_stock' | string
  max_selection?: number | null
  max_product_quantity?: number | null
  views_30d?: number
  createdAt?: string
  updatedAt?: string
}

export interface BundleItemRef {
  product_id: string | Product
  variant_sku?: string | null
  variant_key?: string | null
}

export interface EligibleBundleVariant {
  sku?: string
  color?: string
  size?: string
  attributes?: Record<string, string>
  price?: number
  max_price?: number
  weight?: number
  stock?: number
  status?: boolean
  variant_key?: string
}

export interface EligibleBundleProduct {
  _id: string
  title: string
  id?: string
  sku?: string
  thumbnail?: string
  product_type: Exclude<ProductType, 'bundle'>
  weight?: number
  status?: boolean
  selling_price?: number
  max_price?: number
  variants?: EligibleBundleVariant[]
}

export interface EligibleBundleProductsResponse {
  list: EligibleBundleProduct[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface BlogCategory {
  _id: string
  name: string
  slug: string
  status?: boolean
  canonical_url?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string | null
  og_title?: string | null
  og_description?: string | null
  og_type?: 'website' | 'article' | 'product' | 'profile' | '' | null
  og_image?: string | null
  twitter_title?: string | null
  twitter_description?: string | null
  twitter_image?: string | null
  schema?: string
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

export interface ArticleCategoryRef {
  _id: string
  name?: string
  slug?: string
  status?: boolean
}

/** Admin blog / article (create-article, all-article, article/:id) */
export interface Article {
  _id: string
  title: string
  slug: string
  description?: string
  content?: string
  status?: boolean
  tags?: string[]
  category?: string | ArticleCategoryRef | null
  canonical_url?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string | null
  og_title?: string | null
  og_description?: string | null
  og_type?: 'website' | 'article' | 'product' | 'profile' | '' | null
  og_image?: string | null
  twitter_title?: string | null
  twitter_description?: string | null
  twitter_image?: string | null
  schema?: string
  schema_markup?: string
  image?: string
  createdAt?: string
  updatedAt?: string
}

export interface ContactUs {
  _id: string
  id?: number
  first_name?: string
  last_name?: string
  phone_number?: string
  email: string
  message?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Subscriber {
  _id?: string
  id?: number
  email: string
  country?: string
  country_name?: string
  createdAt?: string
  updatedAt?: string
}

export interface ProductReviewProduct {
  _id?: string
  id?: number
  title?: string
  slug?: string
  sku?: string
  thumbnail?: string
  product_type?: string
}

export interface ProductReview {
  _id: string
  id?: number
  rating: number
  text: string
  status: string
  name: string
  email: string
  product_type?: string
  variant_sku?: string | null
  createdAt?: string
  user_id?: { _id?: string; name?: string; email?: string; phone_number?: string } | string | null
  product_id?: ProductReviewProduct | string | null
}

export interface ShippingZone {
  _id: string
  id?: number
  name: string
  country: string[]
  status?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CodMethodList {
  list: CodMethod[]
  pagination?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

export interface CodMethod {
  _id: string
  country_code: string
  country: string
  method?: 'flat' | 'weight'
  flat_cost?: number | null
  base_cost?: number | null
  per_kg?: number | null
  step_kg?: number | null
  skip_kg?: number | null
  is_free?: boolean
  status?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ShippingRate {
  _id: string
  title?: string | null
  method?: 'flat' | 'weight'
  rate?: number | null
  flat_cost?: number | null
  base_cost?: number | null
  per_kg?: number | null
  step_kg?: number | null
  skip_kg?: number | null
  shipping_zone_id?: string | Pick<ShippingZone, '_id' | 'name' | 'country' | 'status'> | null
  currency?: string
  status?: boolean
  is_free_shipping?: boolean
  free_shipping_requires?: 'not_required' | 'minimum_order_amount'
  minimum_order_amount?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface ExchangeRate {
  _id: string
  id?: number
  base?: string
  currency: string
  rate: number
  source?: 'openexchangerates' | 'manual'
  last_synced_at?: string | null
  status?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ExchangeRateListData {
  base?: string
  last_synced_at?: string | null
  rates?: ExchangeRate[]
}

export interface PaymentReportItem {
  transactionId?: string
  userName?: string
  userEmail?: string
  country?: string
  item?: string
  type?: string
  amount?: number
  shipping?: number
  currency?: string
  date?: string
  status?: string
}

export interface PaymentReportResponse {
  totalRevenue?: number
  totalShipping?: number
  payments?: PaymentReportItem[]
  pagination?: {
    totalItems: number
    totalPages: number
    currentPage: number
    itemsPerPage: number
  }
}

export interface DashboardCountryCount {
  country: string
  count: number
}

export interface DashboardMonthCount {
  month: string
  count: number
}

export interface DashboardYearCount {
  year: number
  count: number
}

export interface DashboardMonthAmount {
  month: string
  amount: number
}

export interface DashboardYearAmount {
  year: number
  amount: number
}

export interface DashboardCountryAmount {
  country: string
  amount: number
}

export interface DashboardCharts {
  customers_country_pie_top10?: DashboardCountryCount[]
  orders_graph?: {
    by_month?: DashboardMonthCount[]
    by_year?: DashboardYearCount[]
  }
  revenue?: {
    total_collected?: number
    bar_amount_vs_month?: DashboardMonthAmount[]
    bar_amount_vs_year?: DashboardYearAmount[]
    pie_amount_vs_country_top10?: DashboardCountryAmount[]
  }
  members?: {
    pie_total_members_vs_country_top5?: DashboardCountryCount[]
    bar_new_members_month?: DashboardMonthCount[]
  }
}

export interface DashboardTotals {
  orders: number
  paid_pending: number
  revenue: number
  completed: number
  customers: number
  cancelled: number
  coupon_discount: number
  shipping: number
  subscribers: number
  enquiries: number
}

export interface DashboardMonthPoint {
  year: number
  month: number
  orders: number
  revenue: number
  newMembers: number
}

export interface DashboardCountryPoint {
  code: string
  name: string
  count: number
}

export interface DashboardData {
  totals: DashboardTotals
  months: DashboardMonthPoint[]
  customers_by_country: DashboardCountryPoint[]
  revenue_by_country: Array<{ label: string; amount: number }>
  members_by_country: Array<{ label: string; count: number }>
  this_month: {
    label: string
    points: Array<{ day: string; count: number }>
  }
}

export interface AnalyticsSummary {
  activeUsers: number
  sessions: number
  screenPageViews: number
  eventCount: number
  bounceRate: number
}

export interface AnalyticsReport {
  summary: AnalyticsSummary
  realtime?: { activeUsers: number }
  timeseries: Array<{ date: string; activeUsers: number; sessions: number }>
  channels: Array<{ name: string; value: number }>
  topPages: Array<{ path: string; value: number }>
  countries: Array<{ country: string; value: number }>
}

export interface DashboardMetric {
  value: number
  previous: number | null
  change_percent: number | null
}

export type DashboardPerformanceKey =
  | 'total_sales'
  | 'net_sales'
  | 'orders'
  | 'products_sold'
  | 'variations_sold'
  | 'visitors'
  | 'views'

export interface DashboardPerformance {
  currency: string
  previous_range: { from: string | null; to: string | null } | null
  metrics: Record<DashboardPerformanceKey, DashboardMetric>
}

export interface DashboardLeaderboardRow {
  _id: string | null
  name: string
  items_sold: number
  net_sales: number
}

export interface DashboardLeaderboards {
  currency: string
  top_categories: DashboardLeaderboardRow[]
  top_products: DashboardLeaderboardRow[]
}

export interface DashboardProductRow {
  product_id: string | null
  title: string
  sku: string | null
  items_sold: number
  net_sales: number
  orders: number
  category: { _id: string; name: string } | null
  product_type: string | null
  variations: number
  status: string
  stock_status: string | null
  stock_quantity: number | null
}

export type DashboardProductSort = 'items_sold' | 'net_sales' | 'orders' | 'title'

export interface DashboardProductsReport {
  currency: string
  totals: { products: number; items_sold: number; net_sales: number }
  products: DashboardProductRow[]
  pagination: { totalItems: number; totalPages: number; currentPage: number; itemsPerPage: number }
}

export type DashboardSalesKey =
  | 'gross_sales'
  | 'returns'
  | 'coupons'
  | 'net_sales'
  | 'taxes'
  | 'shipping'
  | 'total_sales'

export interface DashboardSalesSummary {
  currency: string
  previous_range: { from: string | null; to: string | null } | null
  orders: number
  metrics: Record<DashboardSalesKey, DashboardMetric>
}

export interface DashboardRevenueRow {
  date: string
  label?: string
  year?: number
  month?: number | null
  orders: number
  gross_sales: number
  returns: number
  coupons: number
  net_sales: number
  taxes: number
  shipping: number
  total_sales: number
}

export interface DashboardRevenue {
  currency: string
  sort: { sortBy: 'date'; sortOrder: 'asc' | 'desc' }
  totals: Omit<DashboardRevenueRow, 'date'>
  days: DashboardRevenueRow[]
  pagination?: { totalItems: number; totalPages: number; currentPage: number; itemsPerPage: number }
}

export interface OrderCustomer {
  _id?: string | null
  id?: number
  name?: string
  email?: string
  phone_number?: string
}

export interface OrderListItem {
  _id: string
  order_number?: number
  order_code?: string | null
  createdAt?: string
  status?: string
  item_count?: number
  total_amount?: number
  currency?: string
  aed_total?: number
  placed_currency?: string
  placed_exchange_rate?: number
  placed_grand_total?: number 
  payment_status?: string | null
  payment_method?: string | null
  origin?: string | null
  device_type?: string | null
  session_page_views?: number | null
  country?: string | null
  country_name?: string | null
  shipping_address?: { country?: string | null; iso_code?: string | null } | null
  customer?: OrderCustomer | null
  preview_images?: string[]
}

export interface OrdersPagination {
  totalItems: number
  totalPages: number
  currentPage: number
  itemsPerPage: number
}

export interface OrderCustomerOption {
  _id: string
  name: string | null
  email: string | null
  phone_number: string | null
}

export interface OrdersListResponse {
  orders: OrderListItem[]
  pagination: OrdersPagination
  status_counts?: Record<string, number>
}

export interface OrderDetail extends OrderListItem {
  user_id?: string
  subtotal_amount?: number | null
  shipping_amount?: number | null
  fee_amount?: number | null
  cod_amount?: number | null
  discount_amount?: number | null
  coupon_code?: string | null
  coupon_type?: string | null
  customer_note?: string | null
  shipping_address?: Record<string, unknown> | null
  billing_address?: Record<string, unknown> | null
  items?: Array<Record<string, unknown>>
  timeline?: Array<Record<string, unknown>>
  courier_name?: string | null
  tracking_id?: string | null
  customer_history?: {
    total_orders: number
    total_revenue: number
    average_order_value: number
  }
}

export type ProductVariantSummary = {
  sku?: string
  color?: string
  size?: string
  attributes?: Record<string, string>
  stock?: number
  price?: number
  max_price?: number
  weight?: number
  status?: boolean
}

export type OrderItemSummary = {
  _id?: string
  product_id?: {
    _id?: string
    title?: string
    slug?: string
    thumbnail?: string
    images?: string[]
    variants?: ProductVariantSummary[]
    is_variant?: boolean
  } | string
  variant_sku?: string
  selected_color?: string
  selected_size?: string
  product_name?: string
  quantity?: number
  price?: number
  single_price?: number
  total?: number
  cancelled?: boolean
  /** Backend-enriched: the variant SKU the customer selected for this request. */
  requested_variant_sku?: string | null
  /** Backend-enriched: the resolved product variant matching `requested_variant_sku`. */
  matched_variant?: ProductVariantSummary | null
}

export interface OrderCancellationRequest {
  _id: string
  user_id?: { _id?: string; name?: string; email?: string; phone_number?: string | null; id?: number } | string
  order_id?: {
    _id?: string
    order_number?: number
    invoice_number?: string
    total_amount?: number
    shipping_amount?: number
    status?: string
    payment_status?: string
    payment_method?: string
    currency?: string
    createdAt?: string
    transaction_id?: string
    shipping_address_id?: string
  } | string
  admin_id?: { _id?: string; name?: string; email?: string; id?: number } | string | null
  reason?: string
  description?: string
  status?: string
  admin_note?: string
  refund_status?: string
  refund_amount?: number | null
  refund_transaction_id?: string | null
  processed_at?: string | null
  createdAt?: string
  updatedAt?: string
  /** Populated array of OrderItem docs the customer requested to cancel. May be empty for full-order cancellations. */
  order_item_ids?: Array<OrderItemSummary | string>
  /** All order items on the linked order (used as fallback when cancellation targets the full order). */
  order_items?: OrderItemSummary[]
  shipping_address?: Record<string, unknown> | null
  billing_address?: Record<string, unknown> | null
  /** Cancellation/refund-specific timeline (e.g. "Cancellation Requested", "Refunded"). */
  timeline?: Array<{ status?: string; message?: string; at?: string }>
  /** Order status history (separate from cancellation timeline). */
  order_timeline?: Array<{ status?: string; message?: string; createdAt?: string }>
  /** Refund step history. */
  refund_history?: Array<{
    _id?: string
    status?: string
    note?: string
    transaction_id?: string | null
    at?: string
    by?: string | null
  }>
  transactions?: Array<{
    _id?: string
    status?: string
    amount?: number
    currency?: string
    transaction_id?: string
    createdAt?: string
  }>
}

export interface OrderCancellationListResponse {
  requests: OrderCancellationRequest[]
  pagination: {
    totalItems: number
    totalPages: number
    currentPage: number
    itemsPerPage: number
  }
}

// Token Masters
export interface TokenMaster {
  _id: string
  name: string
  credits: number
  bonus_credits?: number
  price: number
  currency?: string
  per_credit_price?: number
  is_most_popular?: boolean
  sort_order?: number
  status: 'ACTIVE' | 'INACTIVE'
  created_at?: string
}

// Testimonial Masters
export interface TestimonialMaster {
  _id: string
  name: string
  designation?: string
  message: string
  rating: number
  status: 'ACTIVE' | 'INACTIVE'
  created_at?: string
}

// Service Document Requirements
export interface ServiceDocumentRequirement {
  _id: string
  service_category: string | { _id: string; title: string; id?: string }
  name: string
  description?: string | null
  allowed_formats?: string | null
  type: 'DOCUMENT' | 'LICENSE'
  is_required: boolean
  status: 'ACTIVE' | 'INACTIVE'
  created_at?: string
  createdAt?: string
  updatedAt?: string
}

// Vendor verification document (per requirement)
export interface VendorVerificationDocument {
  document_id: string
  name: string
  description?: string | null
  type: 'DOCUMENT' | 'LICENSE'
  is_required: boolean
  status: 'Pending' | 'Verified' | 'Rejected' | 'Not uploaded'
  file?: {
    path: string
    file_name?: string
    url: string | null
  } | null
  uploadedAt?: string | null
}

// Vendor with documents (admin)
export interface VendorWithDocuments extends User {
  service?: { _id: string; title: string } | null
  documents: VendorVerificationDocument[]
}

export interface VendorsWithDocumentsResponse {
  list: VendorWithDocuments[]
  total: number
}

export interface VendorDashboardCounts {
  total_pending_kyc: number
  inactive_vendors: number
}

// Service Questions
export type ServiceQuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'

export interface ServiceQuestion {
  _id: string
  label: string
  key: string
  type: ServiceQuestionType
  service_id: string | { _id: string; title?: string }
  step?: number
  order?: number
  is_required?: boolean
  is_multiple?: boolean
  placeholder?: string
  status?: 'ACTIVE' | 'INACTIVE'
  options?: Array<{ label: string; value: string }>
  created_at?: string
  createdAt?: string
}

/** Admin SMTP settings. The password is never returned. */
export interface SmtpSettings {
  host: string
  port: number
  secure: boolean
  username: string
  from_name: string
  from_email: string
  status: boolean
  has_password: boolean
}

export interface SmtpSettingsPayload {
  host: string
  port: number
  secure: boolean
  username: string
  password?: string
  from_name: string
  from_email: string
  status: boolean
}

/** Global site settings (admin get-global / update-global-setting) */
export interface GlobalSettings {
  _id?: string
  platformName?: string
  platformDescription?: string
  email?: string
  phone?: string
  alt_phone?: string
  whatsapp_number?: string
  address?: string
  marketplace_name?: string
  copy_right_text?: string
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  og_title?: string
  og_description?: string
  og_image?: string
  og_tag?: string
  twitter_title?: string
  twitter_description?: string
  twitter_image?: string
  json_ld?: string
  schema_markup?: string
  search_console?: string
  google_analytics_id?: string
  google_tag_manager?: string
  microsoft_clarity?: string
  meta_pixel?: string
  tiktok_pixel?: string
  snap_pixel?: string
  meta_domain_verification?: string
  iphone_app_url?: string
  facebook_link?: string
  instagram_link?: string
  x_link?: string
  /** API field name (spelling preserved for backend compatibility) */
  linkdin_link?: string
  youtube_link?: string
  tiktok_link?: string
  quote_limit?: string | number
  quote_expired?: string | number
  return_policy?: string
  shipping?: string
  payment_options?: string
  membership_price_detail?: string
  tax?: number
  uk_vat?: number
  us_buffer?: number
  us_import_tax?: number
  us_state_tax?: number
  us_state_tax_enabled?: boolean
  ziina_enable?: boolean
  tabby_enable?: boolean
  tamara_enable?: boolean
  default_payment_method?: string
  cod_enable?: boolean
  enable_two_factor_authentication?: boolean
  cod_charge?: number
  eu_buffer?: number
  eu_vat?: number
  logo?: string
  icon_image?: string
  home_page_banner?: string
  home_page_banner_mobile?: string
  header_text_first?: string
  header_text_second?: string
  facebook_logo?: string
  linkdin_logo?: string
  instagram_logo?: string
  x_logo?: string
  created_at?: string
  updated_at?: string
}

export interface MediaAsset {
  _id: string
  id?: string
  alternative_text?: string | null
  title?: string | null
  caption?: string | null
  description?: string | null
  file_url: string
  file_type?: string | null
  file_name?: string | null
  file_size?: number | null
  dimensions?: string | null
  status?: boolean
  deletedAt?: string | null
  createdBy?: string | { _id?: string; name?: string | null; email?: string | null } | null
  createdAt?: string
  updatedAt?: string
}

export interface MediaGalleryPage {
  list: MediaAsset[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Generic API response
/** Breadcrumb highlights for the product, cart, and checkout pages (`/page-notices`). */
export interface PageNotices {
  product_notice?: string
  product_notice_enabled?: boolean
  cart_notice?: string
  cart_notice_enabled?: boolean
  checkout_notice?: string
  checkout_notice_enabled?: boolean
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  message?: string
  token?: string
}
