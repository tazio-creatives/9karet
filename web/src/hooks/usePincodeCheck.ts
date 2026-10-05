import { useRef, useState } from 'react';
import { checkDeliveryPincode, type PincodeCheckResult } from '../api/delivery';
import { ApiError } from '../api/client';

// India Post PIN codes are 6 digits and never start with 0.
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export type PincodeCheckState =
  | { status: 'idle' }
  | { status: 'invalid' }
  | { status: 'checking' }
  | { status: 'done'; result: PincodeCheckResult }
  | { status: 'error'; message: string };

// Shared by the PDP delivery checker and the address form. Only the latest
// request's answer is applied, so typing quickly never shows a stale result.
export function usePincodeCheck() {
  const [state, setState] = useState<PincodeCheckState>({ status: 'idle' });
  const latest = useRef(0);

  async function check(pincode: string): Promise<PincodeCheckResult | null> {
    if (!PINCODE_PATTERN.test(pincode)) {
      setState({ status: 'invalid' });
      return null;
    }
    const requestId = ++latest.current;
    setState({ status: 'checking' });
    try {
      const result = await checkDeliveryPincode(pincode);
      // A newer check superseded this one — drop the stale answer entirely.
      if (requestId !== latest.current) return null;
      setState({ status: 'done', result });
      return result;
    } catch (err) {
      if (requestId === latest.current) {
        setState({
          status: 'error',
          message: err instanceof ApiError ? err.message : 'Could not check this pincode. Please try again.',
        });
      }
      return null;
    }
  }

  function reset() {
    latest.current++;
    setState({ status: 'idle' });
  }

  return { state, check, reset };
}
