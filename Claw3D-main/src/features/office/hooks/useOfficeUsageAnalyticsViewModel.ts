"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";
import {
  defaultStudioAnalyticsPreference,
  resolveAnalyticsPreference,
  type StudioAnalyticsBudgetSettings,
} from "@/lib/studio/settings";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useUsageAnalytics } from "@/features/office/hooks/useUsageAnalytics";
import { getDefaultUsageAnalyticsRange } from "@/lib/office/usageAnalyticsPresentation";

export type OfficeUsageAnalyticsParams = {
  client: GatewayClient;
  status: GatewayStatus;
  agents: AgentState[];
  gatewayUrl: string;
  settingsCoordinator: StudioSettingsCoordinator;
};

export const useOfficeUsageAnalyticsViewModel = ({
  client,
  status,
  agents,
  gatewayUrl,
  settingsCoordinator,
}: OfficeUsageAnalyticsParams) => {
  const defaultRange = getDefaultUsageAnalyticsRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [budgets, setBudgets] = useState<StudioAnalyticsBudgetSettings>(
    defaultStudioAnalyticsPreference().budgets
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const gatewayKey = gatewayUrl.trim();
    if (!gatewayKey) {
      setBudgets(defaultStudioAnalyticsPreference().budgets);
      setSettingsLoaded(true);
      return;
    }
    void (async () => {
      try {
        const settings = await settingsCoordinator.loadSettings({ maxAgeMs: 30_000 });
        if (cancelled || !settings) return;
        const analyticsPreference = resolveAnalyticsPreference(settings, gatewayKey);
        setBudgets(analyticsPreference.budgets);
      } finally {
        if (!cancelled) {
          setSettingsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gatewayUrl, settingsCoordinator]);

  const usage = useUsageAnalytics({
    client,
    status,
    agents,
    startDate,
    endDate,
    budgets,
  });

  const saveBudgets = useCallback(
    (nextBudgets: StudioAnalyticsBudgetSettings) => {
      const key = gatewayUrl.trim();
      if (!key) return;
      settingsCoordinator.schedulePatch(
        {
          analytics: {
            [key]: {
              budgets: nextBudgets,
            },
          },
        },
        150
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const updateBudget = useCallback(
    (key: keyof StudioAnalyticsBudgetSettings, value: number | null) => {
      setBudgets((current) => {
        const next = { ...current, [key]: value };
        saveBudgets(next);
        return next;
      });
    },
    [saveBudgets]
  );

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    budgets,
    settingsLoaded,
    usage,
    updateBudget,
  };
};
