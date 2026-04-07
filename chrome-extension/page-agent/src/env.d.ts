/// <reference types="vite/client" />
import type { PageAgent } from './PageAgent'

declare global {
	interface Window {
		pageAgent?: PageAgent
		PageAgent: typeof PageAgent
	}
}
