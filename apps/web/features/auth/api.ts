import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Me = components['schemas']['Me'];

export const meKey = ['auth', 'me'] as const;

/**
 * Fetch the current user's profile.
 * Returns null if not authenticated (catches 401 errors).
 */
export function useMe(options?: Omit<UseQueryOptions<Me | null>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await apiFetch<Me>('/auth/me');
      } catch (error) {
        // Handle 401 (guest/not authenticated) by returning null
        if (error instanceof ApiRequestError) {
          if (error.status === 401) {
            return null;
          }
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    ...options,
  });
}

/**
 * Log in with email/username and password.
 * Updates the 'auth/me' query data on success.
 */
export function useLogin(
  options?: Omit<UseMutationOptions<Me, ApiRequestError, { identifier: string; password: string }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ identifier, password }) =>
      apiFetch<Me>('/auth/login', {
        method: 'POST',
        body: { identifier, password },
      }),
    ...options,
    onSuccess: (...args) => {
      queryClient.setQueryData(meKey, args[0]);
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Log out the current user.
 * Clears all query data on success.
 */
export function useLogout(options?: Omit<UseMutationOptions<void, ApiRequestError, void>, 'mutationFn'>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiFetch<void>('/auth/logout', {
        method: 'POST',
      });
    },
    ...options,
    onSuccess: (...args) => {
      queryClient.clear();
      options?.onSuccess?.(...args);
    },
  });
}
