import {
  buildOperationalOnboardingSteps as unavailableBuildOperationalSteps,
} from './onboardingPreviewPlaceholder';
import {
  getTrainingModulesForRoles,
  trovanTrainingCatalog,
  unwrapApiData,
  type OnboardingReadiness,
  type TrainingModule,
  type TrainingProgress,
} from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getSession } from './api.session';
import { isPreview } from './api.preview';
import { queryKeys } from './queryKeys';

export type OnboardingTeamMember = {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  completedModuleKeys: string[];
};

const PREVIEW_PROGRESS_KEY = 'trovan.preview.onboarding-progress.v1';
const PREVIEW_CHAMPION_KEY = 'trovan.preview.onboarding-champion.v1';

const readPreviewProgress = (): TrainingProgress[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(PREVIEW_PROGRESS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writePreviewProgress = (progress: TrainingProgress[]) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PREVIEW_PROGRESS_KEY, JSON.stringify(progress));
  }
};

export const getOnboardingCatalog = async (): Promise<TrainingModule[]> => {
  if (isPreview()) {
    const session = await getSession();
    const roleModules = getTrainingModulesForRoles(session.user.roles?.length ? session.user.roles : [session.user.role]);
    // The preview organization represents an Owner-led evaluation workspace, while
    // /driver/help remains the dedicated Driver-only surface.
    return session.user.roles?.includes('DRIVER')
      ? [...roleModules]
      : [...trovanTrainingCatalog.filter((module) => module.track !== 'driver-quick-start' || module.required)];
  }
  const response = await apiFetch('/api/onboarding/catalog');
  const data = unwrapApiData<{ modules?: TrainingModule[] }>(await response.json());
  return Array.isArray(data.modules) ? data.modules : [];
};

export const getMyOnboardingProgress = async (): Promise<TrainingProgress[]> => {
  if (isPreview()) return readPreviewProgress();
  const response = await apiFetch('/api/onboarding/progress/me');
  const data = unwrapApiData<{ progress?: TrainingProgress[] }>(await response.json());
  return Array.isArray(data.progress) ? data.progress : [];
};

export const updateOnboardingProgress = async (input: {
  moduleKey: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  score?: number;
  signoffAcknowledged?: boolean;
}): Promise<TrainingProgress> => {
  if (isPreview()) {
    const module = trovanTrainingCatalog.find((item) => item.key === input.moduleKey);
    if (!module) throw new Error('Training module not found');
    const existing = readPreviewProgress();
    const now = new Date().toISOString();
    const passed = input.status === 'COMPLETED' && (input.score ?? 0) >= module.knowledgeCheck.passingScore;
    const next: TrainingProgress = {
      moduleKey: module.key,
      contentVersion: module.contentVersion,
      status: passed ? 'COMPLETED' : 'IN_PROGRESS',
      score: input.score ?? null,
      signoffAcknowledged: module.key === 'go-live' && passed && input.signoffAcknowledged === true,
      startedAt: existing.find((item) => item.moduleKey === module.key)?.startedAt || now,
      completedAt: passed ? now : null,
      updatedAt: now,
    };
    writePreviewProgress([next, ...existing.filter((item) => item.moduleKey !== module.key)]);
    return next;
  }
  const response = await apiFetch(`/api/onboarding/progress/${encodeURIComponent(input.moduleKey)}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: input.status,
      score: input.score,
      signoffAcknowledged: input.signoffAcknowledged,
    }),
  });
  const data = unwrapApiData<{ progress: TrainingProgress }>(await response.json());
  return data.progress;
};

export const setOnboardingChampion = async (userId: string) => {
  if (isPreview()) {
    if (typeof window !== 'undefined') window.localStorage.setItem(PREVIEW_CHAMPION_KEY, userId);
    return { championUserId: userId };
  }
  const response = await apiFetch('/api/onboarding/champion', {
    method: 'PUT',
    body: JSON.stringify({ userId }),
  });
  return unwrapApiData<{ championUserId: string }>(await response.json());
};

const buildPreviewReadiness = async (): Promise<OnboardingReadiness> => {
  const progress = readPreviewProgress();
  const championUserId =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(PREVIEW_CHAMPION_KEY) || 'preview-user'
      : 'preview-user';
  const completed = new Set(progress.filter((item) => item.status === 'COMPLETED').map((item) => item.moduleKey));
  const operationalSteps = unavailableBuildOperationalSteps();
  const trainingSteps = trovanTrainingCatalog
    .filter((module) => module.required)
    .map((module) => ({
      id: `training-${module.key}`,
      label: module.title,
      owner: module.key === 'driver-quick-start' ? 'Pilot driver' : 'Champion',
      complete: completed.has(module.key),
      blocked: false,
      action: 'Open lesson',
      href: `/academy/${module.key}`,
      detail: `${module.estimatedMinutes} minutes`,
    }));
  const all = [...trainingSteps, ...operationalSteps];
  const signoffComplete = progress.some((item) => item.moduleKey === 'go-live' && item.signoffAcknowledged);
  return {
    championUserId,
    operationalSteps,
    trainingSteps,
    operationalComplete: operationalSteps.filter((step) => step.complete).length,
    trainingComplete: trainingSteps.filter((step) => step.complete).length,
    totalSteps: all.length,
    completedSteps: all.filter((step) => step.complete).length,
    driverTrainingComplete: completed.has('driver-quick-start'),
    signoffComplete,
    readyForReview: all.every((step) => step.complete) && signoffComplete,
    nextAction: all.find((step) => !step.complete) || null,
    generatedAt: new Date().toISOString(),
  };
};

export const getOnboardingReadiness = async (): Promise<OnboardingReadiness> => {
  if (isPreview()) return buildPreviewReadiness();
  const response = await apiFetch('/api/onboarding/readiness');
  const data = unwrapApiData<{ readiness: OnboardingReadiness }>(await response.json());
  return data.readiness;
};

export const getOnboardingTeamProgress = async (): Promise<OnboardingTeamMember[]> => {
  if (isPreview()) {
    return [
      { userId: 'preview-user', displayName: 'Trovan Champion', email: 'ops@trovan.local', role: 'OWNER', completedModuleKeys: readPreviewProgress().map((item) => item.moduleKey) },
      { userId: 'preview-driver-user', displayName: 'Anna Quinn', email: 'anna.quinn@trovan.local', role: 'DRIVER', completedModuleKeys: [] },
    ];
  }
  const response = await apiFetch('/api/onboarding/team-progress');
  const data = unwrapApiData<{ members?: OnboardingTeamMember[] }>(await response.json());
  return Array.isArray(data.members) ? data.members : [];
};

export const useOnboardingCatalogQuery = () =>
  useQuery({ queryKey: queryKeys.onboardingCatalog, queryFn: getOnboardingCatalog });

export const useMyOnboardingProgressQuery = () =>
  useQuery({ queryKey: queryKeys.onboardingProgress, queryFn: getMyOnboardingProgress });

export const useOnboardingReadinessQuery = () =>
  useQuery({ queryKey: queryKeys.onboardingReadiness, queryFn: getOnboardingReadiness });

export const useOnboardingTeamProgressQuery = (enabled = true) =>
  useQuery({ queryKey: queryKeys.onboardingTeamProgress, queryFn: getOnboardingTeamProgress, enabled });

export const useUpdateOnboardingProgressMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOnboardingProgress,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingReadiness }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboardingTeamProgress }),
      ]);
    },
  });
};

export const useSetOnboardingChampionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setOnboardingChampion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.onboardingReadiness });
    },
  });
};
