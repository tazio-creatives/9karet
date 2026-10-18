import { ProductListing } from '../features/plp/ProductListing';

// Every published product, with the usual filters — the destination of the
// homepage "Shop by Price" cards (/jewellery?priceMin=…&priceMax=…); the
// active price band shows as a filter chip.
export function AllJewelleryPage() {
  return (
    <ProductListing
      heading="All Jewellery"
      seoDescription="Shop all 9K gold jewellery at 9KARET — rings, earrings, pendants, bracelets and more, in BIS hallmarked 9K gold set with genuine gemstones."
      breadcrumbs={[{ label: 'All Jewellery' }]}
      canonicalPath="/jewellery"
    />
  );
}
