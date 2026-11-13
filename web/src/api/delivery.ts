import { apiFetch } from './client';

export interface PincodeCheckResult {
  pincode: string;
  // null = the courier couldn't be reached, so we couldn't verify either way.
  serviceable: boolean | null;
  // From India Post's directory; null when unknown. Used to prefill addresses.
  city: string | null;
  state: string | null;
}

export function checkDeliveryPincode(pincode: string) {
  return apiFetch<PincodeCheckResult>(`/delivery/pincode/${encodeURIComponent(pincode)}`);
}
