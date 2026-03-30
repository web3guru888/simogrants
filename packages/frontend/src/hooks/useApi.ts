import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Round, Project, RoundDetail, ProjectDetail, RoundResults } from '@/lib/types';

export function useRounds(status?: string) {
  return useQuery({
    queryKey: ['rounds', status],
    queryFn: () => api.getRounds(status ? { status } : undefined),
  });
}

export function useRound(id: string) {
  return useQuery({
    queryKey: ['round', id],
    queryFn: () => api.getRound(id),
    enabled: !!id,
  });
}

export function useRoundResults(id: string) {
  return useQuery({
    queryKey: ['roundResults', id],
    queryFn: () => api.getRoundResults(id),
    enabled: !!id,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
    enabled: !!id,
  });
}
