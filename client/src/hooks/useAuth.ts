import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 0, // Always fetch fresh auth data
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
  };
}
