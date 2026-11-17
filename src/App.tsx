import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout/Layout'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { VerifyOtp } from './pages/VerifyOtp'
import { ResetPassword } from './pages/ResetPassword'
import { Dashboard } from './pages/dashboard/Dashboard'
import { Analytics } from './pages/analytics/Analytics'
import { Categories } from './pages/Categories'
import { CategoryFormPage } from './pages/CategoryFormPage'
import { Brands } from './pages/Brands'
import { Products } from './pages/Products'
import { ProductFormPage } from './pages/ProductFormPage'
import { ProductDetails } from './pages/ProductDetails'
import { FAQs } from './pages/FAQs'
import { Profile } from './pages/Profile'
import { ContactEnquiries } from './pages/ContactEnquiries'
import { Subscribers } from './pages/Subscribers'
import { Customers } from './pages/Customers'
import { Orders } from './pages/Orders'
import { OrderDetails } from './pages/OrderDetails'
import { OrderCancellation } from './pages/OrderCancellation'
import { OrderCancellationDetails } from './pages/OrderCancellationDetails'
import { ShippingRates } from './pages/ShippingRates'
import { ExchangeRates } from './pages/ExchangeRates'
import { GlobalSettings } from './pages/GlobalSettings'
import { PageNotices } from './pages/page-notices/PageNotices'
import { PaymentSettings } from './pages/payment-settings/PaymentSettings'
import { SmtpSettings } from './pages/payment-settings/SmtpSettings'
import { EmailSettings } from './pages/EmailSettings'
import { BlogCategories } from './pages/BlogCategories'
import { Articles } from './pages/Articles'
import { ArticleFormPage } from './pages/ArticleFormPage'
import { Colors } from './pages/Colors'
import { Sizes } from './pages/Sizes'
import { Coupons } from './pages/Coupons'
import { CouponUsagePage } from './pages/CouponUsage'
import { PaymentReport } from './pages/PaymentReport'
import { MediaLibrary } from './pages/media/MediaLibrary'
import { Reviews } from './pages/Reviews'
import { Roles } from './pages/Roles'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="categories" element={<Categories />} />
        <Route path="categories/trash" element={<Categories trash />} />
        <Route path="categories/new" element={<CategoryFormPage />} />
        <Route path="categories/:id/edit" element={<CategoryFormPage />} />
        <Route path="brands" element={<Brands />} />
        <Route path="brands/trash" element={<Brands trash />} />
        <Route path="products" element={<Products />} />
        <Route path="products/trash" element={<Products trash />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id/edit" element={<ProductFormPage />} />
        <Route path="products/:id" element={<ProductDetails />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="faqs" element={<FAQs />} />
        <Route path="blog-categories" element={<BlogCategories />} />
        <Route path="blog-categories/trash" element={<BlogCategories trash />} />
        <Route path="articles" element={<Articles />} />
        <Route path="articles/new" element={<ArticleFormPage />} />
        <Route path="articles/:id/edit" element={<ArticleFormPage />} />
        <Route path="media" element={<MediaLibrary />} />
        <Route path="colors" element={<Colors />} />
        <Route path="sizes" element={<Sizes />} />
        <Route path="sizes/trash" element={<Sizes trash />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="coupons/trash" element={<Coupons trash />} />
        <Route path="coupon-usage" element={<CouponUsagePage />} />
        <Route path="payment-report" element={<PaymentReport />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetails />} />
        <Route path="shipping-rates" element={<ShippingRates />} />
        <Route path="exchange-rates" element={<ExchangeRates />} />
        <Route path="order-cancellations" element={<OrderCancellation />} />
        <Route path="order-cancellations/:id" element={<OrderCancellationDetails />} />
        <Route path="contact-enquiries" element={<ContactEnquiries />} />
        <Route path="customers" element={<Customers />} />
        <Route path="subscribers" element={<Subscribers />} />
        <Route path="profile" element={<Profile />} />
        <Route path="global-settings" element={<GlobalSettings />} />
        <Route path="page-notices" element={<PageNotices />} />
        <Route path="payment-settings" element={<PaymentSettings />} />
        <Route path="smtp-settings" element={<SmtpSettings />} />
        <Route path="email-settings" element={<EmailSettings />} />
        <Route path="roles" element={<Roles />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
