export const deriveDispatchEventIndexFields = (params: {
  reasonCode?: string | null;
  action?: string | null;
  actor?: string | null;
  packId?: string | null;
  payload?: Record<string, any> | null;
}) => {
  const payload = params.payload || {};
  const reasonCodeFromPayload = Array.isArray(payload.reasonCodes)
    ? payload.reasonCodes[0]
    : payload.reasonCode;
  const actionFromPayload = payload.action;
  const actorFromPayload = payload.overrideActor || payload.appliedBy || payload.reviewerId;
  const packIdFromPayload =
    payload.selectedPackId || (Array.isArray(payload.packIds) ? payload.packIds[0] : null);
  return {
    reasonCode: params.reasonCode || reasonCodeFromPayload || null,
    action: params.action || actionFromPayload || null,
    actor: params.actor || actorFromPayload || null,
    packId: params.packId || packIdFromPayload || null,
  };
};

