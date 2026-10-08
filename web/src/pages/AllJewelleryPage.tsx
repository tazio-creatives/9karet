import { ProductListing } from '../features/plp/ProductListing';

// Every published product, with the usual filters — the destination of the
// homepage "Shop by Price" cards (/jewellery?priceMin=…&priceMax=…); the
// active price band shows as a filter chip.
export function AllJewelleryPage() {
  return (
    <ProductListing
      heading="All Jewellery"
      seoDescription="Shop all certified diamond and gold jewellery at BOX DIAMONDS — rings, earrings, pendants, bangles and more, in BIS hallmarked gold."
      breadcrumbs={[{ label: 'All Jewellery' }]}
      canonicalPath="/jewellery"
    />
  );
}
