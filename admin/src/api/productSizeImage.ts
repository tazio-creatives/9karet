import { apiFetch } from './client';
import type { JewelleryType } from './aiStudio';

export interface ProductSizeMeasurementsInput {
  jewelleryType: JewelleryType;
  unit: 'mm' | 'cm';
  measurements: Record<string, number | string>;
  includedParts: string[];
  excludedParts: string[];
  note: string | null;
}

export interface ProductSizeMeasurements extends ProductSizeMeasurementsInput {
  version: number;
}

export type ProductSizeImageStatus = 'generating' | 'passed' | 'warning' | 'failed' | 'stale';

export interface ProductSizeGeneratedImage {
  status: ProductSizeImageStatus;
  failureReason: string | null;
  measurementVersion: number;
  // Set only when a generation attempt actually finished (pass/warning/
  // fail) — stays put across a later status='stale' flip, so it always
  // reflects when the CURRENTLY shown image was really produced. Null
  // before the first generation attempt has ever completed.
  generatedAt: string | null;
  imageUrl: string | null;
}

export interface ProductSizeMeasurementsResponse {
  measurements: ProductSizeMeasurements | null;
  generatedImage: ProductSizeGeneratedImage | null;
}

export function fetchProductSizeMeasurements(productId: string) {
  return apiFetch<ProductSizeMeasurementsResponse>(`/admin/products/${productId}/size-measurements`);
}

export function saveProductSizeMeasurements(productId: string, input: ProductSizeMeasurementsInput) {
  return apiFetch<ProductSizeMeasurementsResponse>(`/admin/products/${productId}/size-measurements`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function generateProductSizeImage(productId: string, input: ProductSizeMeasurementsInput) {
  return apiFetch<{ status: 'generating' }>(`/admin/products/${productId}/size-measurements/generate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
