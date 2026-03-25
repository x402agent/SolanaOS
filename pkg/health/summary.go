package health

import "time"

type SummaryCheck struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

type HealthSummary struct {
	Status  string                  `json:"status"`
	Version string                  `json:"version"`
	Uptime  int64                   `json:"uptime"`
	Checks  map[string]SummaryCheck `json:"checks"`
}

func (c *Checker) Summary(version string, startedAt time.Time) HealthSummary {
	results := c.GetCached()
	checks := make(map[string]SummaryCheck, len(results))
	for name, result := range results {
		checks[name] = SummaryCheck{
			Status:  mapStatus(result.Status),
			Message: result.Message,
		}
	}
	uptime := int64(0)
	if !startedAt.IsZero() {
		uptime = int64(time.Since(startedAt).Seconds())
	}
	return HealthSummary{
		Status:  mapStatus(c.Overall()),
		Version: version,
		Uptime:  uptime,
		Checks:  checks,
	}
}

func mapStatus(status Status) string {
	switch status {
	case StatusOK:
		return "healthy"
	case StatusDegraded:
		return "degraded"
	case StatusDown:
		return "unhealthy"
	default:
		return "unknown"
	}
}
