// Package cron provides scheduled task execution for MawdBot.
// Adapted from PicoClaw — configurable cron jobs for OODA, research, heartbeat.
package cron

import (
	"context"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/logger"
)

type Job struct {
	Name     string
	Interval time.Duration
	Fn       func(ctx context.Context) error
}

type Scheduler struct {
	mu   sync.Mutex
	jobs []Job
	stop chan struct{}
}

func NewScheduler() *Scheduler {
	return &Scheduler{stop: make(chan struct{})}
}

func (s *Scheduler) Add(job Job) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs = append(s.jobs, job)
}

func (s *Scheduler) Start(ctx context.Context) {
	s.mu.Lock()
	jobs := make([]Job, len(s.jobs))
	copy(jobs, s.jobs)
	s.mu.Unlock()

	logger.InfoCF("cron", "Starting scheduler", map[string]any{"jobs": len(jobs)})

	for _, job := range jobs {
		go func(j Job) {
			ticker := time.NewTicker(j.Interval)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					if err := j.Fn(ctx); err != nil {
						logger.WarnCF("cron", "Job failed", map[string]any{
							"job":   j.Name,
							"error": err.Error(),
						})
					}
				case <-s.stop:
					return
				case <-ctx.Done():
					return
				}
			}
		}(job)
	}
}

func (s *Scheduler) Stop() {
	close(s.stop)
}
