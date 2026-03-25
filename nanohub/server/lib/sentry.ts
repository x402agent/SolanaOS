import * as Sentry from '@sentry/node'
import { defineEventHandler, getRequestIP, getRequestURL } from 'h3'
import type { H3Event } from 'h3'

type RequestContext = Record<string, unknown>

let sentryInitialized = false

function parseBoolean(value: string | undefined, fallback = false) {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return fallback
}

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sentryDsn() {
  return process.env.SENTRY_DSN?.trim() || ''
}

function isSentryEnabled() {
  return sentryDsn().length > 0
}

function initSentry() {
  if (sentryInitialized || !isSentryEnabled()) return

  Sentry.init({
    dsn: sentryDsn(),
    environment: process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || 'development',
    tracesSampleRate: parseNumber(process.env.SENTRY_TRACES_SAMPLE_RATE, 0),
    sendDefaultPii: parseBoolean(process.env.SENTRY_SEND_DEFAULT_PII, false),
  })

  sentryInitialized = true
}

function statusCodeOf(error: unknown) {
  if (!error || typeof error !== 'object') return null
  if ('statusCode' in error && typeof error.statusCode === 'number') return error.statusCode
  if ('status' in error && typeof error.status === 'number') return error.status
  return null
}

function shouldCapture(error: unknown) {
  const statusCode = statusCodeOf(error)
  if (statusCode && statusCode >= 400 && statusCode < 500) return false
  return true
}

export function captureServerException(
  event: H3Event,
  error: unknown,
  route: string,
  context?: RequestContext,
) {
  initSentry()
  if (!isSentryEnabled() || !shouldCapture(error)) return

  Sentry.withScope((scope) => {
    scope.setTag('route', route)
    scope.setContext('request', {
      method: event.method,
      path: event.path,
      url: getRequestURL(event).toString(),
      ip: getRequestIP(event, { xForwardedFor: true }) || undefined,
    })

    if (context && Object.keys(context).length > 0) {
      scope.setContext('context', context)
    }

    Sentry.captureException(error)
  })
}

export function withSentryEventHandler<T>(
  route: string,
  handler: (event: H3Event) => Promise<T> | T,
) {
  initSentry()

  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    } catch (error) {
      captureServerException(event, error, route)
      throw error
    }
  })
}
