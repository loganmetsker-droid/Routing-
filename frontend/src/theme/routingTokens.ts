import { trovanTokens } from './tokens';

export const routingTokens = {
  status: {
    route: {
      draft: trovanTokens.color.slate[500],
      planned: trovanTokens.color.slate[600],
      optimized: trovanTokens.color.semantic.success,
      assigned: trovanTokens.color.semantic.info,
      in_progress: trovanTokens.color.copper[500],
      completed: trovanTokens.color.semantic.success,
      cancelled: trovanTokens.color.semantic.danger,
      failed: trovanTokens.color.semantic.danger,
    },
    optimizationJob: {
      queued: trovanTokens.color.slate[500],
      running: trovanTokens.color.copper[500],
      completed: trovanTokens.color.semantic.success,
      failed: trovanTokens.color.semantic.danger,
      cancelled: trovanTokens.color.semantic.neutral,
    },
    exception: {
      open: trovanTokens.color.semantic.warning,
      acknowledged: trovanTokens.color.semantic.info,
      resolved: trovanTokens.color.semantic.success,
      dismissed: trovanTokens.color.semantic.neutral,
    },
    assignment: {
      pending: trovanTokens.color.semantic.warning,
      confirmed: trovanTokens.color.semantic.success,
      reassigned: trovanTokens.color.copper[500],
      cancelled: trovanTokens.color.semantic.danger,
    },
  },
} as const;
