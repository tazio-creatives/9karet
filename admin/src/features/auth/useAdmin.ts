import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '../../api/auth';
import { ApiError } from '../../api/client';

export function useAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: (_failureCount, error) => !(error instanceof ApiError && error.status === 401),
  });

  return {
    admin: data?.admin ?? null,
    isLoggedIn: !!data?.admin,
    isLoading,
  };
}
