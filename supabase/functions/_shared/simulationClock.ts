export const QUICK_START_TICK_SECONDS = 10;

type SimulationProgress = {
  minute: number;
  lastTickAt: string;
};

export function simulationProgress(
  currentMinute: number,
  lastTickAt: string | null,
  tickedAt: Date,
  speed: number,
  serviceMinutes: number,
  isQuickStart: boolean,
): SimulationProgress {
  const safeSpeed = Math.max(1, speed);
  const tickedAtMs = tickedAt.getTime();
  const parsedLastTickAt = lastTickAt ? Date.parse(lastTickAt) : tickedAtMs;
  const lastTickAtMs = Number.isFinite(parsedLastTickAt) ? Math.min(parsedLastTickAt, tickedAtMs) : tickedAtMs;
  const availableMinutes = Math.max(0, Math.floor(((tickedAtMs - lastTickAtMs) / 60_000) * safeSpeed));
  const quickStartLimit = Math.max(1, Math.ceil((safeSpeed * QUICK_START_TICK_SECONDS) / 60));
  const appliedMinutes = Math.min(
    serviceMinutes - currentMinute,
    isQuickStart ? Math.min(availableMinutes, quickStartLimit) : availableMinutes,
  );

  // Advance the cursor only by the time actually consumed. A delayed cron call
  // therefore leaves a backlog for later small ticks instead of jumping to close.
  const consumedMilliseconds = (appliedMinutes / safeSpeed) * 60_000;
  return {
    minute: currentMinute + appliedMinutes,
    lastTickAt: new Date(Math.min(tickedAtMs, lastTickAtMs + consumedMilliseconds)).toISOString(),
  };
}

export function simulationTargetMinute(progressMinute: number, serviceMinutes: number, completeImmediately: boolean) {
  return completeImmediately ? serviceMinutes : progressMinute;
}

export function marketCycleMinutes(currentMinute: number, nextMinute: number, intervalMinutes = 5) {
  const firstCycleMinute = (Math.floor(currentMinute / intervalMinutes) + 1) * intervalMinutes;
  const cycles: number[] = [];
  for (let minute = firstCycleMinute; minute <= nextMinute; minute += intervalMinutes) cycles.push(minute);
  return cycles;
}
