import { useRecoilValue } from 'recoil';
import { QueryKeys, dataService } from 'librechat-data-provider';
import { useQuery } from '@tanstack/react-query';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type t from 'librechat-data-provider';
import store from '~/store';

export const useGetBannerQuery = (
  config?: UseQueryOptions<t.TBannerResponse>,
): QueryObserverResult<t.TBannerResponse> => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<t.TBannerResponse>([QueryKeys.banner], () => dataService.getBanner(), {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    ...config,
    enabled: (config?.enabled ?? true) === true && queriesEnabled,
  });
};

export const useGetUserBalance = (
  config?: UseQueryOptions<t.TBalanceResponse>,
): QueryObserverResult<t.TBalanceResponse> => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<t.TBalanceResponse>([QueryKeys.balance], () => dataService.getUserBalance(), {
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    ...config,
    enabled: (config?.enabled ?? true) === true && queriesEnabled,
  });
};

export const useGetSearchEnabledQuery = (
  config?: UseQueryOptions<boolean>,
): QueryObserverResult<boolean> => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<boolean>([QueryKeys.searchEnabled], () => dataService.getSearchEnabled(), {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    ...config,
    enabled: (config?.enabled ?? true) === true && queriesEnabled,
  });
};

export const useGetAittcoQuotaQuery = (config?: UseQueryOptions<t.TAittcoQuotaResponse>) => {
  const enabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<t.TAittcoQuotaResponse>([QueryKeys.aittcoQuota], () => dataService.getAittcoQuota(), { ...config, enabled: (config?.enabled ?? true) && enabled, refetchOnWindowFocus: false });
};

export const useGetAittcoUsageQuery = (refreshKey = 0, config?: UseQueryOptions<t.TAittcoUsageResponse>) => {
  const enabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<t.TAittcoUsageResponse>([QueryKeys.aittcoUsage, refreshKey], () => dataService.getAittcoUsage({ refresh: refreshKey > 0 }), { ...config, enabled: (config?.enabled ?? true) && enabled, refetchOnWindowFocus: false });
};
