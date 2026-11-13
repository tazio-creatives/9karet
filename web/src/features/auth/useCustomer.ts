import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '../../api/customers';
import { ApiError } from '../../api/client';

// 401 just means "not logged in" here, not a transient failure — no point
// retrying, and treating it as loading-forever would make every page think
// a guest is still checking auth.
export function useCustomer() {
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: (_failureCount, error) => !(error instanceof ApiError && error.status === 401),
  });

  return {
    customer: data?.customer ?? null,
    isLoggedIn: !!data?.customer,
    isLoading,
  };
}
