import { lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';
import { StorefrontLayout } from './layouts/StorefrontLayout';
import { MinimalLayout } from './layouts/MinimalLayout';
import { AccountLayout } from './layouts/AccountLayout';
import { AuthModalProvider, useAuthModal } from './features/auth/AuthModalContext';
import { HomePage } from './pages/HomePage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { PLPPage } from './pages/PLPPage';
import { NewArrivalsPage } from './pages/NewArrivalsPage';
import { AllJewelleryPage } from './pages/AllJewelleryPage';
import { RetailPartnerPage } from './pages/RetailPartnerPage';
import { CollectionPage } from './pages/CollectionPage';
import { PDPPage } from './pages/PDPPage';

// Only the four public SSR route types (Home/PLP/Collection/PDP, plan §1a)
// are ever rendered server-side via renderToString — everything below
// always hits the CSR-only shell path (see web/server/index.js's
// classifyRoute + entry-server.tsx's render()/renderShellHead() split), so
// lazy-loading it can never strand renderToString on an unresolved chunk.
// Splitting it out of the main bundle is what actually shrinks the JS the
// four SSR page types have to parse before they're interactive.
const CartPage = lazy(() => import('./pages/CartPage').then((m) => ({ default: m.CartPage })));
const WishlistPage = lazy(() => import('./pages/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() =>
  import('./pages/OrderConfirmationPage').then((m) => ({ default: m.OrderConfirmationPage })),
);
const MyOrdersPage = lazy(() => import('./pages/account/MyOrdersPage').then((m) => ({ default: m.MyOrdersPage })));
const OrderDetailPage = lazy(() =>
  import('./pages/account/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })),
);
const AccountAddressesPage = lazy(() =>
  import('./pages/account/AccountAddressesPage').then((m) => ({ default: m.AccountAddressesPage })),
);
const AccountProfilePage = lazy(() =>
  import('./pages/account/AccountProfilePage').then((m) => ({ default: m.AccountProfilePage })),
);
const ShippingPolicyPage = lazy(() =>
  import('./pages/policies/ShippingPolicyPage').then((m) => ({ default: m.ShippingPolicyPage })),
);
const RefundPolicyPage = lazy(() =>
  import('./pages/policies/RefundPolicyPage').then((m) => ({ default: m.RefundPolicyPage })),
);
const OurStoryPage = lazy(() => import('./pages/OurStoryPage').then((m) => ({ default: m.OurStoryPage })));
const BlogListPage = lazy(() => import('./pages/blog/BlogListPage').then((m) => ({ default: m.BlogListPage })));
const BlogPostPage = lazy(() => import('./pages/blog/BlogPostPage').then((m) => ({ default: m.BlogPostPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const WhyBoxDiamondsPage = lazy(() =>
  import('./pages/WhyBoxDiamondsPage').then((m) => ({ default: m.WhyBoxDiamondsPage })),
);
const SustainabilityPage = lazy(() =>
  import('./pages/SustainabilityPage').then((m) => ({ default: m.SustainabilityPage })),
);
const CareGuidePage = lazy(() => import('./pages/CareGuidePage').then((m) => ({ default: m.CareGuidePage })));
const PrivacyPolicyPage = lazy(() =>
  import('./pages/policies/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })),
);
const TermsPage = lazy(() => import('./pages/policies/TermsPage').then((m) => ({ default: m.TermsPage })));

// Login is a modal (AuthModal), not a page — a stray /login link (an old
// bookmark, a shared URL) just opens that same modal over the homepage
// instead of 404ing via the catch-all route.
function LoginRedirect() {
  const navigate = useNavigate();
  const { openLoginModal } = useAuthModal();
  useEffect(() => {
    openLoginModal();
    navigate('/', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function App() {
  return (
    <AuthModalProvider>
      <ScrollToTop />
      <Routes>
        <Route element={<StorefrontLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/checkout" element={<CheckoutPage />} />

          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="orders" element={<MyOrdersPage />} />
            <Route path="orders/:orderId" element={<OrderDetailPage />} />
            <Route path="addresses" element={<AccountAddressesPage />} />
            <Route path="profile" element={<AccountProfilePage />} />
          </Route>

          <Route path="/collections/:collectionSlug" element={<CollectionPage />} />
          <Route path="/new-arrivals" element={<NewArrivalsPage />} />
          <Route path="/jewellery" element={<AllJewelleryPage />} />
          <Route path="/retail-partner" element={<RetailPartnerPage />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          {/* Same combined Return and Refund Policy page under its other name. */}
          <Route path="/return-policy" element={<RefundPolicyPage />} />
          {/* The standalone Cancellation Policy was retired — its terms live in
              the Return and Refund Policy's "Cancellation Before Dispatch"
              section; old links land there instead of a dead page. */}
          <Route path="/cancellation-policy" element={<Navigate to="/refund-policy#cancellation" replace />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          {/* Not built yet — a real page here still needs an explicit route
              (even just this placeholder), or the single-segment path falls
              through to /:categorySlug below and renders a confusing
              "category not found" instead of "coming soon". */}
          <Route path="/contact" element={<ContactPage />} />
          {/* FAQs / Size Guide / Careers / Press were removed from the site —
              old links go home instead of falling through to /:categorySlug. */}
          <Route path="/faqs" element={<Navigate to="/" replace />} />
          <Route path="/size-guide" element={<Navigate to="/" replace />} />
          <Route path="/care-guide" element={<CareGuidePage />} />
          <Route path="/our-story" element={<OurStoryPage />} />
          <Route path="/why-box-diamonds" element={<WhyBoxDiamondsPage />} />
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/careers" element={<Navigate to="/" replace />} />
          <Route path="/press" element={<Navigate to="/" replace />} />
          <Route path="/sustainability" element={<SustainabilityPage />} />
          <Route path="/:categorySlug" element={<PLPPage />} />
          <Route path="/:categorySlug/:productSlug" element={<PDPPage />} />
          <Route path="*" element={<PlaceholderPage title="Coming Soon" />} />
        </Route>

        <Route element={<MinimalLayout />}>
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        </Route>
      </Routes>
    </AuthModalProvider>
  );
}
