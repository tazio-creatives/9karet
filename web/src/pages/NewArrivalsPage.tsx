import { ProductListing } from '../features/plp/ProductListing';

export function NewArrivalsPage() {
  return (
    <ProductListing
      heading="New Arrivals"
      description="The latest additions to 9KARET — certified, live-priced jewellery."
      breadcrumbs={[{ label: 'New Arrivals' }]}
      canonicalPath="/new-arrivals"
    />
  );
}
