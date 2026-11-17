import type {
  LoginPayload,
  AdminProfile,
  CustomerUser,
  ServiceCategory,
  FAQ,
  Category,
  CategoryPayload,
  Brand,
  Color,
  Size,
  Coupon,
  CouponUsage,
  CouponUsagePagination,
  EmailNotificationSetting,
  Product,
  EligibleBundleProductsResponse,
  TokenMaster,
  TestimonialMaster,
  ServiceDocumentRequirement,
  VendorsWithDocumentsResponse,
  VendorDashboardCounts,
  ServiceQuestion,
  GlobalSettings,
  SmtpSettings,
  SmtpSettingsPayload,
  PageNotices,
  ContactUs,
  ProductReview,
  AdminAccess,
  AccessRole,
  StaffMember,
  Article,
  BlogCategory,
  Subscriber,
  ShippingRate,
  CodMethod,
  CodMethodList,
  ShippingZone,
  ExchangeRate,
  ExchangeRateListData,
  PaymentReportResponse,
  DashboardData,
  AnalyticsReport,
  DashboardLeaderboards,
  DashboardPerformance,
  DashboardProductSort,
  DashboardProductsReport,
  DashboardRevenue,
  DashboardSalesSummary,
  OrdersListResponse,
  OrderCustomerOption,
  OrderDetail,
  OrderCancellationListResponse,
  OrderCancellationRequest,
  MediaAsset,
  MediaGalleryPage,
  ApiResponse,
} from '../types/api'
import { api, apiBaseUrl } from './client'

function userApiUrl(path: string) {
  const adminBase = apiBaseUrl.replace(/\/$/, '')
  const origin = adminBase.replace(/\/api\/admin$/i, '')
  return `${origin}/api/user/${path.replace(/^\//, '')}`
}

const formData = (body: Record<string, unknown>) => {
  const fd = new FormData()
  Object.entries(body).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (v instanceof File) fd.append(k, v)
    else if (Array.isArray(v)) {
      // Send arrays as repeated keys so backend receives a real string[]
      v.forEach((item) => {
        if (item === undefined || item === null) return
        fd.append(k, String(item))
      })
    }
    else fd.append(k, String(v))
  })
  return fd
}

// Auth
export const authApi = {
  login: (data: LoginPayload) =>
    api.post<ApiResponse<{ two_factor: boolean; email: string }>>('/login', data),
  verifyLogin: (data: { email: string; code: string }) =>
    api.post<ApiResponse<{ token: string; admin: AdminProfile }>>('/verify-login', data),
  resendLoginCode: (data: { email: string }) =>
    api.post<ApiResponse<{ two_factor: boolean; email: string }>>('/resend-login-code', data),
  getProfile: () => api.get<ApiResponse<AdminProfile>>('/get-profile'),
  updateProfile: (data: FormData) =>
    api.post<ApiResponse<AdminProfile>>('/update-profile', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  changePassword: (data: { old_password: string; new_password: string }) =>
    api.put('/change-password', data),
  forgotPassword: (data: { email: string }) =>
    api.post('/forgot-password', data),
  verifyOtp: (data: { email: string; code: string; type: 'forgot' }) =>
    api.post('/verify', data),
  resetPassword: (
    data: { password: string; confirm_password: string },
    token: string,
  ) =>
    api.post('/new-password', data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  getRoleOptions: () => api.get<ApiResponse<{ _id: string; name: string }[]>>('/api/admin/get-all-role-options'),
  getAllUsers: () => api.get<ApiResponse<CustomerUser[] | { users?: CustomerUser[] }>>('/get-all-users'),
  exportUsers: () =>
    api.get('/export-user', {
      responseType: 'blob',
    }),
  getAllVendorsWithDocuments: () =>
    api.get<ApiResponse<VendorsWithDocumentsResponse>>('/api/admin/vendors-with-documents'),
}

export const customersApi = {
  getAll: (params?: { fromDate?: string; toDate?: string }) =>
    api.get<ApiResponse<CustomerUser[] | { data?: CustomerUser[] }>>('/get-all-users', {
      params: {
        page: 1,
        limit: 500,
        ...(params?.fromDate ? { fromDate: params.fromDate } : {}),
        ...(params?.toDate ? { toDate: params.toDate } : {}),
      },
    }),
  create: (data: FormData | {
    name: string
    email: string
    phone_number?: string
    country?: string
    postal_code?: string
    password: string
    password_confirmation?: string
    status: boolean
  }) =>
    data instanceof FormData
      ? api.post<ApiResponse<CustomerUser>>('/customers', data)
      : api.post<ApiResponse<CustomerUser>>('/customers', data),
  update: (
    id: string,
    data: FormData | {
      name?: string
      email?: string
      phone_number?: string
      country?: string
      postal_code?: string
      password?: string
      password_confirmation?: string
      status?: boolean
    },
  ) => api.put<ApiResponse<CustomerUser>>(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  sendPasswordReset: (id: string) => api.post<ApiResponse<unknown>>(`/customers/${id}/password-reset`),
}

// Vendors (KYC, documents)
export const vendorsApi = {
  getDashboardCounts: () =>
    api.get<ApiResponse<VendorDashboardCounts>>('/api/admin/vendor-dashboard-counts'),
  updateDocumentStatus: (vendorId: string, documentId: string, status: 'Pending' | 'Verified' | 'Rejected') =>
    api.put<ApiResponse<{ document: unknown }>>(`/api/admin/vendors/${vendorId}/documents/${documentId}/status`, {
      status,
    }),
  updateKycStatus: (vendorId: string, kyc_status: 'ACTIVE' | 'PENDING' | 'REJECTED') =>
    api.put<ApiResponse<{ vendor: unknown }>>(`/api/admin/vendors/${vendorId}/kyc-status`, { kyc_status }),
}

// Service Categories
export const serviceCategoriesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) => {
    const search = new URLSearchParams()
    if (params?.page != null) search.set('page', String(params.page))
    if (params?.limit != null) search.set('limit', String(params.limit))
    if (params?.search) search.set('search', params.search)
    const qs = search.toString()
    return api.get<ApiResponse<ServiceCategory[]>>(
      `/api/admin/service-categories${qs ? `?${qs}` : ''}`
    )
  },
  getById: (id: string) => api.get<ApiResponse<ServiceCategory>>(`/api/admin/service-categories/${id}`),
  create: (data: Partial<ServiceCategory> & { image?: File }) =>
    api.post<ApiResponse<ServiceCategory>>('/api/admin/service-categories', formData(data as Record<string, unknown>)),
  update: (id: string, data: Partial<ServiceCategory> & { image?: File }) =>
    api.put<ApiResponse<ServiceCategory>>(`/api/admin/service-categories/${id}`, formData({ ...data } as Record<string, unknown>)),
  delete: (id: string) => api.delete(`/api/admin/service-categories/${id}`),
  restore: (id: string) => api.put(`/api/admin/service-categories/${id}/restore`),
}

// FAQs
export const faqsApi = {
  getAll: () => api.get<ApiResponse<FAQ[]>>('/faqs'),
  getById: (id: string) => api.get<ApiResponse<FAQ>>(`/faqs/${id}`),
  create: (data: Pick<FAQ, 'question' | 'answer'>) => api.post<ApiResponse<FAQ>>('/faqs', data),
  update: (id: string, data: Pick<FAQ, 'question' | 'answer'>) => api.put<ApiResponse<FAQ>>(`/faqs/${id}`, data),
  delete: (id: string) => api.delete(`/faqs/${id}`),
  restore: (id: string) => api.put(`/faqs/${id}/restore`),
}

export const categoriesApi = {
  getAll: () => api.get<ApiResponse<Category[]>>('/categories'),
  getAllCategories: (params?: { search?: string; status?: 'active' | 'inactive' }) =>
    api.get<ApiResponse<Category[]>>('/all-categories', {
      params: {
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
    }),
  getTrash: (params?: { search?: string }) =>
    api.get<ApiResponse<Category[] | { list?: Category[] }>>('/categories/trash', {
      params: params?.search ? { search: params.search } : undefined,
    }),
  restore: (id: string) => api.patch<ApiResponse<Category>>(`/categories/${id}/restore`),
  getById: (id: string) => api.get<ApiResponse<Category>>(`/categories/${id}`),
  create: (data: CategoryPayload) =>
    api.post<ApiResponse<Category>>('/categories', formData(data as Record<string, unknown>)),
  update: (id: string, data: Partial<CategoryPayload>) =>
    api.put<ApiResponse<Category>>(`/categories/${id}`, formData(data as Record<string, unknown>)),
  delete: (id: string) => api.delete(`/categories/${id}`),
}

export const brandsApi = {
  getAll: (params?: { search?: string; status?: 'active' | 'inactive' }) =>
    api.get<ApiResponse<Brand[]>>('/brands', {
      params: {
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
    }),
  getById: (id: string) => api.get<ApiResponse<Brand>>(`/brands/${id}`),
  create: (data: Pick<Brand, 'name' | 'slug'> & { status: boolean }) =>
    api.post<ApiResponse<Brand>>('/brands', data),
  update: (id: string, data: Partial<Pick<Brand, 'name' | 'slug'> & { status: boolean }>) =>
    api.put<ApiResponse<Brand>>(`/brands/${id}`, data),
  delete: (id: string) => api.delete(`/brands/${id}`),
  getTrash: (params?: { search?: string }) =>
    api.get<ApiResponse<Brand[]>>('/brands/trash', {
      params: params?.search ? { search: params.search } : undefined,
    }),
  restore: (id: string) => api.patch<ApiResponse<Brand>>(`/brands/${id}/restore`),
}

export const colorsApi = {
  getAll: () => api.get<ApiResponse<Color[]>>('/colors'),
  getById: (id: string) => api.get<ApiResponse<Color>>(`/colors/${id}`),
  create: (data: Pick<Color, 'name' | 'code'> & { status: boolean }) =>
    api.post<ApiResponse<Color>>('/colors', data),
  update: (id: string, data: Pick<Color, 'name' | 'code'> & { status: boolean }) =>
    api.put<ApiResponse<Color>>(`/colors/${id}`, data),
  delete: (id: string) => api.delete(`/colors/${id}`),
}

export const sizesApi = {
  getAll: (params?: { search?: string; status?: 'active' | 'inactive' }) =>
    api.get<ApiResponse<Size[]>>('/sizes', {
      params: {
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
    }),
  getActive: () => api.get<ApiResponse<Size[]>>(userApiUrl('sizes')),
  getById: (id: string) => api.get<ApiResponse<Size>>(`/sizes/${id}`),
  create: (data: Pick<Size, 'name' | 'slug'> & { status: boolean }) =>
    api.post<ApiResponse<Size>>('/sizes', data),
  update: (id: string, data: Partial<Pick<Size, 'name' | 'slug'> & { status: boolean }>) =>
    api.put<ApiResponse<Size>>(`/sizes/${id}`, data),
  delete: (id: string) => api.delete(`/sizes/${id}`),
  getTrash: (params?: { search?: string }) =>
    api.get<ApiResponse<Size[]>>('/sizes/trash', {
      params: params?.search ? { search: params.search } : undefined,
    }),
  restore: (id: string) => api.patch<ApiResponse<Size>>(`/sizes/${id}/restore`),
}

export const couponsApi = {
  getAll: (params?: {
    search?: string
    status?: 'active' | 'inactive'
    type?: string
    fromDate?: string
    toDate?: string
  }) =>
    api.get<ApiResponse<Coupon[]>>('/all-coupons', {
      params: {
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.type ? { type: params.type } : {}),
        ...(params?.fromDate ? { fromDate: params.fromDate } : {}),
        ...(params?.toDate ? { toDate: params.toDate } : {}),
      },
    }),
  getById: (id: string) => api.get<ApiResponse<Coupon>>(`/coupon/${id}`),
  create: (data: {
    coupon_code: string
    description: string
    coupon_type: string
    value: number
    no_coupon: number
    start_date: string
    expiry_date: string
    minimum_cart_value: number
    status: boolean
    is_auto_apply: boolean
  }) => api.post<ApiResponse<Coupon>>('/coupon/create', data),
  update: (
    id: string,
    data: {
      coupon_code?: string
      description?: string
      coupon_type?: string
      value?: number
      no_coupon?: number
      start_date?: string
      expiry_date?: string
      minimum_cart_value?: number
      status?: boolean
      is_auto_apply?: boolean
    },
  ) => api.put<ApiResponse<Coupon>>(`/update-coupon/${id}`, data),
  updateStatus: (id: string, status: boolean) =>
    api.put<ApiResponse<Coupon>>(`/update-coupon-status/${id}`, { status }),
  delete: (id: string) => api.put(`/soft-delete-coupon/${id}`),
  getTrash: (params?: { search?: string }) =>
    api.get<ApiResponse<Coupon[]>>('/soft-deleted-coupon', {
      params: params?.search ? { search: params.search } : undefined,
    }),
  restore: (id: string) => api.put<ApiResponse<Coupon>>(`/restore-coupon/${id}`),
  getUsage: (params?: {
    page?: number
    limit?: number
    search?: string
    type?: string
    fromDate?: string
    toDate?: string
    couponId?: string
  }) => {
    const search = new URLSearchParams()
    if (params?.page != null) search.set('page', String(params.page))
    if (params?.limit != null) search.set('limit', String(params.limit))
    if (params?.search) search.set('search', params.search)
    if (params?.type) search.set('type', params.type)
    if (params?.fromDate) search.set('fromDate', params.fromDate)
    if (params?.toDate) search.set('toDate', params.toDate)
    if (params?.couponId) search.set('couponId', params.couponId)
    const qs = search.toString()
    return api.get<ApiResponse<{ data?: CouponUsage[]; pagination?: CouponUsagePagination }>>(
      `/get-coupon-usage${qs ? `?${qs}` : ''}`,
    )
  },
  exportUsage: (params?: {
    search?: string
    type?: string
    fromDate?: string
    toDate?: string
    couponId?: string
  }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set('search', params.search)
    if (params?.type) search.set('type', params.type)
    if (params?.fromDate) search.set('fromDate', params.fromDate)
    if (params?.toDate) search.set('toDate', params.toDate)
    if (params?.couponId) search.set('couponId', params.couponId)
    const qs = search.toString()
    return api.get(`/get-coupon-usage/export${qs ? `?${qs}` : ''}`, {
      responseType: 'blob',
    })
  },
}

export const blogCategoriesApi = {
  getAll: (params?: { search?: string; status?: 'active' | 'inactive' }) =>
    api.get<ApiResponse<BlogCategory[]>>('/blog-categories', {
      params: {
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
    }),
  getById: (id: string) => api.get<ApiResponse<BlogCategory>>(`/blog-categories/${id}`),
  create: (data: FormData) =>
    api.post<ApiResponse<BlogCategory>>('/blog-categories', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, data: FormData) =>
    api.put<ApiResponse<BlogCategory>>(`/blog-categories/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: string) => api.delete(`/blog-categories/${id}`),
  getTrash: (params?: { search?: string }) =>
    api.get<ApiResponse<BlogCategory[]>>('/blog-categories/trash', {
      params: params?.search ? { search: params.search } : undefined,
    }),
  restore: (id: string) => api.patch<ApiResponse<BlogCategory>>(`/blog-categories/${id}/restore`),
}

export const articlesApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string; search?: string; category?: string }) => {
    const search = new URLSearchParams()
    if (params?.page != null) search.set('page', String(params.page))
    if (params?.limit != null) search.set('limit', String(params.limit))
    if (params?.status !== undefined && params.status !== '' && params.status !== 'all') {
      search.set('status', params.status)
    }
    if (params?.search) search.set('search', params.search)
    if (params?.category) search.set('category', params.category)
    const qs = search.toString()
    return api.get<ApiResponse<unknown>>(`/all-article${qs ? `?${qs}` : ''}`)
  },
  getById: (id: string) => api.get<ApiResponse<Article>>(`/article/${id}`),
  create: (data: FormData) =>
    api.post<ApiResponse<Article>>('/create-article', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, data: FormData) =>
    api.put<ApiResponse<Article>>(`/article/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: string) => api.delete(`/article/${id}`),
}

type ProductListParams = {
  page?: number
  limit?: number
  search?: string
  status?: string
  transition?: string
  categoryId?: string
  brandId?: string
  size?: string
  product_type?: string
  stock_status?: string
  min_price?: number
  max_price?: number
  visibility?: string
}

function productFilterParams(params?: ProductListParams, includePaging = true) {
  return {
    ...(includePaging ? { page: params?.page ?? 1, limit: params?.limit ?? 10 } : {}),
    ...(params?.visibility ? { visibility: params.visibility } : {}),
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.status ? { status: params.status } : {}),
    ...(params?.transition ? { transition: params.transition } : {}),
    ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params?.brandId ? { brandId: params.brandId } : {}),
    ...(params?.size ? { size: params.size } : {}),
    ...(params?.product_type ? { product_type: params.product_type } : {}),
    ...(params?.stock_status ? { stock_status: params.stock_status } : {}),
    ...(params?.min_price != null ? { min_price: params.min_price } : {}),
    ...(params?.max_price != null ? { max_price: params.max_price } : {}),
  }
}

export const productsApi = {
  getAll: (params?: ProductListParams) =>
    api.get<ApiResponse<Product[] | {
      list?: Product[]
      visibility_counts?: Partial<Record<'all' | 'publish' | 'draft' | 'pending' | 'trash', number>>
      pagination?: { page: number; limit: number; total: number; totalPages: number }
    }>>('/all-products', {
      params: productFilterParams(params),
    }),
  exportCsv: (params?: Omit<ProductListParams, 'page' | 'limit'>) =>
    api.get<Blob>('/products/export-csv', {
      params: productFilterParams(params, false),
      responseType: 'blob',
    }),
  getById: (id: string) => api.get<ApiResponse<Product>>(`/products/${id}`),
  getEligibleForBundle: (params?: {
    search?: string
    min_price?: number | string
    max_price?: number | string
    product_type?: 'simple' | 'variable'
    exclude?: string[]
    page?: number
    limit?: number
  }) => {
    const search = new URLSearchParams()
    if (params?.search) search.set('search', params.search)
    if (params?.min_price !== undefined && params.min_price !== '') {
      search.set('min_price', String(params.min_price))
    }
    if (params?.max_price !== undefined && params.max_price !== '') {
      search.set('max_price', String(params.max_price))
    }
    if (params?.product_type) search.set('product_type', params.product_type)
    if (params?.exclude?.length) search.set('exclude', params.exclude.join(','))
    if (params?.page != null) search.set('page', String(params.page))
    if (params?.limit != null) search.set('limit', String(params.limit))
    const qs = search.toString()
    return api.get<ApiResponse<EligibleBundleProductsResponse>>(
      `/products/eligible-for-bundle${qs ? `?${qs}` : ''}`,
    )
  },
  create: (data: unknown) =>
    api.post<ApiResponse<Product>>('/products', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, data: unknown) =>
    api.put<ApiResponse<Product>>(`/products/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateInventory: (id: string, data: unknown) => api.patch(`/products/${id}/inventory`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  restore: (id: string) => api.patch(`/products/${id}/restore`),
}

export const contactUsApi = {
  getAll: () =>
    api
      .get<ApiResponse<ContactUs[]>>('/all-contact-us')
      .catch(() => api.get<ApiResponse<ContactUs[]>>('/api/admin/all-contact-us')),
}

export const accessApi = {
  me: () => api.get<ApiResponse<AdminAccess>>('/access/me'),
  roles: () => api.get<ApiResponse<AccessRole[]>>('/access/roles'),
  createRole: (data: { name: string; description?: string; permissions?: AccessRole['permissions'] }) =>
    api.post<ApiResponse<AccessRole>>('/access/roles', data),
  updateRole: (id: string, data: { name?: string; description?: string; permissions?: AccessRole['permissions'] }) =>
    api.put<ApiResponse<AccessRole>>(`/access/roles/${id}`, data),
  deleteRole: (id: string) => api.delete<ApiResponse<unknown>>(`/access/roles/${id}`),
  staff: () => api.get<ApiResponse<StaffMember[]>>('/access/staff'),
  createStaff: (data: { name: string; last_name?: string; email: string; password: string; role_id: string; phone_number?: string }) =>
    api.post<ApiResponse<StaffMember>>('/access/staff', data),
  updateStaff: (
    id: string,
    data: Partial<{ name: string; last_name: string; email: string; password: string; role_id: string; status: boolean; phone_number: string }>,
  ) => api.put<ApiResponse<StaffMember>>(`/access/staff/${id}`, data),
  deleteStaff: (id: string) => api.delete<ApiResponse<unknown>>(`/access/staff/${id}`),
}

export const reviewsApi = {
  getAll: (params?: { search?: string; status?: string }) =>
    api.get<ApiResponse<{ totalReviews: number; reviews: ProductReview[] }>>('/get-all-reviews', {
      params: {
        search: params?.search || undefined,
        status: params?.status || undefined,
      },
    }),
  approve: (id: string) => api.put<ApiResponse<unknown>>(`/review/accept-review/${id}`),
  reject: (id: string) => api.put<ApiResponse<unknown>>(`/review/reject-review/${id}`),
}

export const subscribersApi = {
  getAll: () =>
    api
      .get<ApiResponse<Subscriber[]>>('/all-subscriber')
      .catch(() => api.get<ApiResponse<Subscriber[]>>('/api/admin/all-subscriber')),
}

export const ordersApi = {
  getAll: (params?: {
    status?: string
    country?: string | string[]
    search?: string
    customerId?: string
    fromDate?: string
    toDate?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) => {
    const countryValue = params?.country
      ? Array.isArray(params.country)
        ? params.country.join(',')
        : params.country
      : undefined
    return api.get<ApiResponse<OrdersListResponse>>('/orders', {
      params: {
        status: params?.status || undefined,
        country: countryValue,
        country_code: countryValue,
        search: params?.search || undefined,
        customerId: params?.customerId || undefined,
        fromDate: params?.fromDate || undefined,
        toDate: params?.toDate || undefined,
        page: params?.page,
        limit: params?.limit,
        sortBy: params?.sortBy || undefined,
        sortOrder: params?.sortOrder || undefined,
      },
    })
  },
  searchCustomers: (params: { search?: string; id?: string }) =>
    api.get<ApiResponse<{ customers: OrderCustomerOption[] }>>('/orders/customers/search', { params }),
  getById: (id: string) => api.get<ApiResponse<OrderDetail>>(`/orders/${id}`),
  downloadInvoice: (id: string) =>
    api.get<Blob>(`/orders/${id}/invoice`, { responseType: 'blob' }),
  downloadPackingSlip: (id: string) =>
    api.get<Blob>(`/orders/${id}/packing-slip`, { responseType: 'blob' }),
  downloadOrderSlip: (id: string) =>
    api.get<Blob>(`/orders/${id}/slip`, { responseType: 'blob' }),
  bulkUpdateStatus: (ids: string[], status: string) =>
    api.post<ApiResponse<{ updated: number; skipped: { id: string; reason: string }[] }>>('/orders/bulk/status', {
      ids,
      status,
    }),
  bulkExportCsv: (ids: string[]) =>
    api.post<Blob>('/orders/bulk/export-csv', { ids }, { responseType: 'blob' }),
  bulkInvoices: (ids: string[]) =>
    api.post<Blob>('/orders/bulk/invoices', { ids }, { responseType: 'blob' }),
  bulkPackingSlips: (ids: string[]) =>
    api.post<Blob>('/orders/bulk/packing-slips', { ids }, { responseType: 'blob' }),
  bulkOrderSlips: (ids: string[]) =>
    api.post<Blob>('/orders/bulk/slips', { ids }, { responseType: 'blob' }),
  updateStatus: (
    id: string,
    data: {
      status: string
      message?: string
      courier_name?: string
      tracking_id?: string
      payment_status?: string
      send_email?: string
    },
  ) => api.put<ApiResponse<OrderDetail>>(`/orders/${id}/status`, data),
  exportExcel: () =>
    api.get('/orders/export-excel', {
      responseType: 'blob',
    }),
}

export const orderCancellationApi = {
  getAll: (params?: {
    status?: string
    refund_status?: string
    search?: string
    page?: number
    limit?: number
    fromDate?: string
    toDate?: string
  }) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.refund_status) search.set('refund_status', params.refund_status)
    if (params?.search) search.set('search', params.search)
    if (params?.fromDate) search.set('fromDate', params.fromDate)
    if (params?.toDate) search.set('toDate', params.toDate)
    if (params?.page != null) search.set('page', String(params.page))
    if (params?.limit != null) search.set('limit', String(params.limit))
    const qs = search.toString()
    return api.get<ApiResponse<OrderCancellationListResponse>>(
      `/order-cancellations${qs ? `?${qs}` : ''}`,
    )
  },
  getById: (id: string) =>
    api.get<ApiResponse<OrderCancellationRequest>>(`/order-cancellations/${id}`),
  updateStatus: (
    id: string,
    data: {
      status: 'approved' | 'rejected'
      admin_note?: string
    },
  ) => api.put<ApiResponse<OrderCancellationRequest>>(`/order-cancellations/${id}/status`, data),
  updateRefund: (
    id: string,
    data: {
      refund_status: string
      refund_amount?: number
      refund_transaction_id?: string
      admin_note?: string
    },
  ) => api.put<ApiResponse<OrderCancellationRequest>>(`/order-cancellations/${id}/refund`, data),
}

export const shippingZonesApi = {
  getAll: () => api.get<ApiResponse<ShippingZone[]>>('/shipping-zones'),
  getById: (id: string) => api.get<ApiResponse<ShippingZone>>(`/shipping-zones/${id}`),
  create: (data: { name: string; country: string[]; status: boolean }) =>
    api.post<ApiResponse<ShippingZone>>('/shipping-zones', data),
  update: (id: string, data: { name?: string; country?: string[]; status?: boolean }) =>
    api.put<ApiResponse<ShippingZone>>(`/shipping-zones/${id}`, data),
  delete: (id: string) => api.delete(`/shipping-zones/${id}`),
}

export type ShippingRatePayload = {
  title: string
  method: 'flat' | 'weight'
  shipping_zone_id: string
  flat_cost?: number
  base_cost?: number
  per_kg?: number
  step_kg?: number
  skip_kg?: number
  currency: string
  status: boolean
  is_free_shipping: boolean
  free_shipping_requires?: 'not_required' | 'minimum_order_amount'
  minimum_order_amount?: number
}

export type CodMethodPayload = {
  country: string
  country_code: string
  method: 'flat' | 'weight'
  flat_cost?: number
  base_cost?: number
  per_kg?: number
  step_kg?: number
  skip_kg?: number
  is_free: boolean
  status: boolean
}

export const codMethodsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) => {
    const search = new URLSearchParams()
    if (params?.page != null) search.set('page', String(params.page))
    if (params?.limit != null) search.set('limit', String(params.limit))
    if (params?.search) search.set('search', params.search)
    const qs = search.toString()
    return api.get<ApiResponse<CodMethodList>>(`/cod-methods${qs ? `?${qs}` : ''}`)
  },
  getById: (id: string) => api.get<ApiResponse<CodMethod>>(`/cod-methods/${id}`),
  create: (data: CodMethodPayload) => api.post<ApiResponse<CodMethod>>('/cod-methods', data),
  update: (id: string, data: CodMethodPayload) => api.put<ApiResponse<CodMethod>>(`/cod-methods/${id}`, data),
  delete: (id: string) => api.delete(`/cod-methods/${id}`),
}

export const shippingRatesApi = {
  getAll: () => api.get<ApiResponse<ShippingRate[]>>('/shipping-rates'),
  getById: (id: string) => api.get<ApiResponse<ShippingRate>>(`/shipping-rates/${id}`),
  create: (data: ShippingRatePayload) => api.post<ApiResponse<ShippingRate>>('/shipping-rates', data),
  update: (id: string, data: ShippingRatePayload) =>
    api.put<ApiResponse<ShippingRate>>(`/shipping-rates/${id}`, data),
  delete: (id: string) => api.delete(`/shipping-rates/${id}`),
}

export const emailNotificationsApi = {
  getAll: () => api.get<ApiResponse<EmailNotificationSetting[]>>('/email-notifications'),
  getByKey: (key: string) =>
    api.get<ApiResponse<EmailNotificationSetting>>(`/email-notifications/${key}`),
  update: (
    key: string,
    data: {
      enabled?: boolean
      recipients?: string
      cc_receipients?: string
      subject?: string
      heading?: string
      additional_content?: string
    },
  ) => api.put<ApiResponse<EmailNotificationSetting>>(`/email-notifications/${key}`, data),
}

export const exchangeRatesApi = {
  getAll: () => api.get<ApiResponse<ExchangeRateListData>>('/exchange-rates'),
  getById: (id: string) => api.get<ApiResponse<ExchangeRate>>(`/exchange-rates/${id}`),
  create: (data: { currency: string; rate: number; status?: boolean }) =>
    api.post<ApiResponse<ExchangeRate>>('/exchange-rates', data),
  update: (id: string, data: { currency?: string; rate?: number; status?: boolean }) =>
    api.put<ApiResponse<ExchangeRate>>(`/exchange-rates/${id}`, data),
  sync: (force = false) =>
    api.post<ApiResponse<ExchangeRateListData>>('/exchange-rates/sync', { force }),
}

export const reportsApi = {
  getPaymentReport: (params?: {
    fromDate?: string
    toDate?: string
    country?: string | string[]
    search?: string
    page?: number
    limit?: number
  }) => {
    const search = new URLSearchParams()
    if (params?.fromDate) search.set('fromDate', params.fromDate)
    if (params?.toDate) search.set('toDate', params.toDate)
    if (params?.country) {
      const countryValue = Array.isArray(params.country) ? params.country.join(',') : params.country
      search.set('country', countryValue)
      search.set('country_code', countryValue)
    }
    if (params?.search) search.set('search', params.search)
    if (params?.page) search.set('page', String(params.page))
    if (params?.limit) search.set('limit', String(params.limit))
    const qs = search.toString()
    return api.get<ApiResponse<PaymentReportResponse>>(`/payment-report${qs ? `?${qs}` : ''}`)
  },
  exportPaymentReport: (params?: { fromDate?: string; toDate?: string; country?: string | string[]; search?: string }) => {
    const search = new URLSearchParams()
    if (params?.fromDate) search.set('fromDate', params.fromDate)
    if (params?.toDate) search.set('toDate', params.toDate)
    if (params?.country) {
      const countryValue = Array.isArray(params.country) ? params.country.join(',') : params.country
      search.set('country', countryValue)
      search.set('country_code', countryValue)
    }
    if (params?.search) search.set('search', params.search)
    const qs = search.toString()
    return api.get(`/payment-report/export${qs ? `?${qs}` : ''}`, {
      responseType: 'blob',
    })
  },
}

export const dashboardApi = {
  getData: (params?: { fromDate?: string; toDate?: string; group?: 'month' | 'yearly' }) => {
    const search = new URLSearchParams()
    if (params?.fromDate) search.set('fromDate', params.fromDate)
    if (params?.toDate) search.set('toDate', params.toDate)
    search.set('period', params?.group === 'yearly' ? 'yearly' : 'month')
    const qs = search.toString()
    return api.get<ApiResponse<DashboardData>>(`/dashboard-data?${qs}`)
  },
  getPerformance: (params?: DashboardRangeParams) =>
    api.get<ApiResponse<DashboardPerformance>>('/dashboard/performance', { params: rangeParams(params) }),
  getLeaderboards: (params?: DashboardRangeParams & { limit?: number }) =>
    api.get<ApiResponse<DashboardLeaderboards>>('/dashboard/leaderboards', {
      params: { ...rangeParams(params), limit: params?.limit },
    }),
  getProducts: (params?: DashboardProductsParams) =>
    api.get<ApiResponse<DashboardProductsReport>>('/dashboard/products', { params: productsParams(params) }),
  exportProducts: (params?: DashboardProductsParams) =>
    api.get('/dashboard/products/export', { params: productsParams(params), responseType: 'blob' }),
  getSalesSummary: (params?: DashboardRangeParams) =>
    api.get<ApiResponse<DashboardSalesSummary>>('/dashboard/sales-summary', { params: rangeParams(params) }),
  getRevenue: (params?: DashboardRevenueParams) =>
    api.get<ApiResponse<DashboardRevenue>>('/dashboard/revenue', { params: revenueParams(params) }),
  exportRevenue: (params?: DashboardRevenueParams) =>
    api.get('/dashboard/revenue/export', { params: revenueParams(params, false), responseType: 'blob' }),
}

export const analyticsApi = {
  getReport: (params: { fromDate: string; toDate: string }) =>
    api.get<ApiResponse<AnalyticsReport>>('/analytics', { params }),
}

type DashboardRangeParams = { fromDate?: string; toDate?: string }

type DashboardProductsParams = DashboardRangeParams & {
  search?: string
  sortBy?: DashboardProductSort
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

type DashboardRevenueParams = DashboardRangeParams & {
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
  group?: 'month' | 'yearly'
}

function revenueParams(params?: DashboardRevenueParams, includePaging = true) {
  return {
    ...rangeParams(params),
    sortOrder: params?.sortOrder,
    ...(includePaging ? { page: params?.page, limit: params?.limit } : {}),
    period: params?.group === 'yearly' ? 'yearly' : 'month',
  }
}

function rangeParams(params?: DashboardRangeParams) {
  return params?.fromDate && params?.toDate ? { fromDate: params.fromDate, toDate: params.toDate } : {}
}

function productsParams(params?: DashboardProductsParams) {
  return {
    ...rangeParams(params),
    search: params?.search?.trim() || undefined,
    sortBy: params?.sortBy,
    sortOrder: params?.sortOrder,
    page: params?.page,
    limit: params?.limit,
  }
}

// Token Masters
export const tokenMastersApi = {
  getAll: () => api.get<ApiResponse<TokenMaster[]>>('/api/admin/token-masters'),
  getById: (id: string) => api.get<ApiResponse<TokenMaster>>(`/api/admin/token-masters/${id}`),
  create: (data: Partial<TokenMaster>) =>
    api.post<ApiResponse<TokenMaster>>('/api/admin/token-masters', data),
  update: (id: string, data: Partial<TokenMaster>) =>
    api.put<ApiResponse<TokenMaster>>(`/api/admin/token-masters/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/token-masters/${id}`),
  restore: (id: string) => api.put(`/api/admin/token-masters/${id}/restore`),
}

// Testimonial Masters
export const testimonialMastersApi = {
  getAll: () => api.get<ApiResponse<TestimonialMaster[]>>('/api/admin/testimonial-masters'),
  getById: (id: string) => api.get<ApiResponse<TestimonialMaster>>(`/api/admin/testimonial-masters/${id}`),
  create: (data: Partial<TestimonialMaster>) =>
    api.post<ApiResponse<TestimonialMaster>>('/api/admin/testimonial-masters', data),
  update: (id: string, data: Partial<TestimonialMaster>) =>
    api.put<ApiResponse<TestimonialMaster>>(`/api/admin/testimonial-masters/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/testimonial-masters/${id}`),
  restore: (id: string) => api.put(`/api/admin/testimonial-masters/${id}/restore`),
}

// Service Document Requirements
export const documentRequirementsApi = {
  getAll: () => api.get<ApiResponse<ServiceDocumentRequirement[]>>('/api/admin/service-document-requirements'),
  getDeleted: () =>
    api.get<ApiResponse<ServiceDocumentRequirement[]>>(
      '/api/admin/service-document-requirements/deleted'
    ),
  permanentDelete: (id: string) =>
    api.delete(`/api/admin/service-document-requirements/${id}/permanent`),
  getById: (id: string) =>
    api.get<ApiResponse<ServiceDocumentRequirement>>(`/api/admin/service-document-requirements/${id}`),
  create: (data: Partial<ServiceDocumentRequirement>) =>
    api.post<ApiResponse<ServiceDocumentRequirement>>('/api/admin/service-document-requirements', data),
  update: (id: string, data: Partial<ServiceDocumentRequirement>) =>
    api.put<ApiResponse<ServiceDocumentRequirement>>(`/api/admin/service-document-requirements/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/service-document-requirements/${id}`),
  restore: (id: string) => api.put(`/api/admin/service-document-requirements/${id}/restore`),
}

// Service Questions
export const questionsApi = {
  create: (data: Partial<ServiceQuestion> & { service_id: string }) =>
    api.post<ApiResponse<ServiceQuestion>>('/api/admin/questions', data),
  getAll: (params: { service_id: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams()
    search.set('service_id', params.service_id)
    if (params.page != null) search.set('page', String(params.page))
    if (params.limit != null) search.set('limit', String(params.limit))
    const qs = search.toString()
    return api.get<ApiResponse<{ list?: ServiceQuestion[]; pagination?: { total?: number; page?: number; limit?: number } }>>(
      `/api/admin/questions?${qs}`
    )
  },
  getById: (id: string) =>
    api.get<ApiResponse<ServiceQuestion>>(`/api/admin/questions/${id}`),
  update: (id: string, data: Partial<ServiceQuestion>) =>
    api.put<ApiResponse<ServiceQuestion>>(`/api/admin/questions/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/questions/${id}`),
  restore: (id: string) => api.put(`/api/admin/questions/${id}/restore`),
}

export const mediaApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<ApiResponse<MediaGalleryPage>>('/media-gallery', {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        search: params?.search ?? '',
        status: params?.status ?? 'all',
      },
    }),
  getById: (id: string) => api.get<ApiResponse<MediaAsset>>(`/get-media/${id}`),
  add: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return api.post<ApiResponse<MediaAsset>>('/media-gallery', body)
  },
  update: (
    id: string,
    data: {
      file?: File
      alternative_text?: string
      title?: string
      caption?: string
      description?: string
      status?: boolean
    },
  ) => {
    const body = new FormData()
    if (data.file) body.append('file', data.file)
    body.append('alternative_text', data.alternative_text ?? '')
    body.append('title', data.title ?? '')
    body.append('caption', data.caption ?? '')
    body.append('description', data.description ?? '')
    body.append('status', data.status === false ? 'false' : 'true')
    return api.put<ApiResponse<MediaAsset>>(`/media-gallery/${id}`, body)
  },
  delete: (id: string) => api.delete<ApiResponse<unknown>>(`/media-gallery/${id}`),
}

export const smtpSettingsApi = {
  get: () => api.get<ApiResponse<SmtpSettings>>('/smtp-settings'),
  update: (data: SmtpSettingsPayload) => api.put<ApiResponse<SmtpSettings>>('/smtp-settings', data),
}

// Global site settings (JSON or multipart when files are attached)
export const pageNoticesApi = {
  get: () => api.get<ApiResponse<PageNotices>>('/page-notices'),
  update: (data: PageNotices) => api.post<ApiResponse<PageNotices>>('/page-notices', data),
}

export const globalSettingsApi = {
  get: () => api.get<ApiResponse<GlobalSettings>>('/get-global'),
  update: (data: Record<string, unknown> | FormData) =>
    data instanceof FormData
      ? api.post<ApiResponse<GlobalSettings>>('/update-global-setting', data)
      : api.post<ApiResponse<GlobalSettings>>('/update-global-setting', data),
}
