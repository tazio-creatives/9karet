import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import { RequirePermission } from './components/RequirePermission';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsListPage } from './pages/products/ProductsListPage';
import { ProductFormPage } from './pages/products/ProductFormPage';
import { AiImageStudioPage } from './pages/products/AiImageStudioPage';
import { ProductVariantsPage } from './pages/products/ProductVariantsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { OrdersListPage } from './pages/orders/OrdersListPage';
import { OrderDetailPage } from './pages/orders/OrderDetailPage';
import { WorkOrderPrintPage } from './pages/orders/WorkOrderPrintPage';
import { InvoicePrintPage } from './pages/orders/InvoicePrintPage';
import { CustomersListPage } from './pages/customers/CustomersListPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { HomepagePage } from './pages/HomepagePage';
import { ReviewsListPage } from './pages/reviews/ReviewsListPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { BlogListPage } from './pages/blog/BlogListPage';
import { BlogFormPage } from './pages/blog/BlogFormPage';
import { CouponsListPage } from './pages/coupons/CouponsListPage';
import { PricingLayout } from './pages/pricing/PricingLayout';
import { RatesPage } from './pages/pricing/RatesPage';
import { PricingRulesListPage } from './pages/pricing/PricingRulesListPage';
import { RuleFormPage } from './pages/pricing/RuleFormPage';
import { ProductOverridesPage } from './pages/pricing/ProductOverridesPage';
import { PricingAuditPage } from './pages/pricing/PricingAuditPage';
import { AttributesPage } from './pages/AttributesPage';
import { AdminUsersListPage } from './pages/adminUsers/AdminUsersListPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/orders/:id/work-order/print" element={<WorkOrderPrintPage />} />
      <Route path="/orders/:id/invoice/print" element={<InvoicePrintPage />} />
      <Route element={<AdminLayout />}>
        <Route
          path="/"
          element={
            <RequirePermission permission="dashboard">
              <DashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="/products"
          element={
            <RequirePermission permission="products">
              <ProductsListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/products/new"
          element={
            <RequirePermission permission="products">
              <ProductFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/products/:id/edit"
          element={
            <RequirePermission permission="products">
              <ProductFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/products/:id/ai-image-studio"
          element={
            <RequirePermission permission="products">
              <AiImageStudioPage />
            </RequirePermission>
          }
        />
        <Route
          path="/products/:id/variants"
          element={
            <RequirePermission permission="products">
              <ProductVariantsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/categories"
          element={
            <RequirePermission permission="categories">
              <CategoriesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/collections"
          element={
            <RequirePermission permission="collections">
              <CollectionsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/homepage"
          element={
            <RequirePermission permission="homepage">
              <HomepagePage />
            </RequirePermission>
          }
        />
        <Route
          path="/orders"
          element={
            <RequirePermission permission="orders">
              <OrdersListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequirePermission permission="orders">
              <OrderDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/customers"
          element={
            <RequirePermission permission="customers">
              <CustomersListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/customers/:id"
          element={
            <RequirePermission permission="customers">
              <CustomerDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/reviews"
          element={
            <RequirePermission permission="reviews">
              <ReviewsListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/blog"
          element={
            <RequirePermission permission="blog">
              <BlogListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/blog/new"
          element={
            <RequirePermission permission="blog">
              <BlogFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/blog/:id"
          element={
            <RequirePermission permission="blog">
              <BlogFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/messages"
          element={
            <RequirePermission permission="messages">
              <MessagesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/coupons"
          element={
            <RequirePermission permission="coupons">
              <CouponsListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/pricing"
          element={
            <RequirePermission permission="pricing">
              <PricingLayout />
            </RequirePermission>
          }
        >
          <Route index element={<Navigate to="rates" replace />} />
          <Route path="rates" element={<RatesPage />} />
          <Route path="making-charge-rules" element={<PricingRulesListPage ruleType="MAKING_CHARGE" />} />
          <Route path="making-charge-rules/new" element={<RuleFormPage ruleType="MAKING_CHARGE" />} />
          <Route path="making-charge-rules/:ruleId" element={<RuleFormPage ruleType="MAKING_CHARGE" />} />
          <Route path="stone-rules" element={<PricingRulesListPage ruleType="STONE" />} />
          <Route path="stone-rules/new" element={<RuleFormPage ruleType="STONE" />} />
          <Route path="stone-rules/:ruleId" element={<RuleFormPage ruleType="STONE" />} />
          <Route path="overrides" element={<ProductOverridesPage />} />
          <Route path="audit" element={<PricingAuditPage />} />
        </Route>
        <Route
          path="/attributes"
          element={
            <RequirePermission permission="attributes">
              <AttributesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin-users"
          element={
            <RequirePermission superAdminOnly>
              <AdminUsersListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <RequirePermission permission="audit-logs">
              <AuditLogsPage />
            </RequirePermission>
          }
        />
      </Route>
    </Routes>
  );
}
