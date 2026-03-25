export type RafBatcher = {
  schedule: () => void;
  cancel: () => void;
};

export const createRafBatcher = (flush: () => void): RafBatcher => {
  let rafId: number | null = null;
  return {
    schedule: () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        flush();
      });
    },
    cancel: () => {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
};

export type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export const isNearBottom = (metrics: ScrollMetrics, thresholdPx: number = 40): boolean => {
  const remaining = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop;
  return remaining <= thresholdPx;
};

