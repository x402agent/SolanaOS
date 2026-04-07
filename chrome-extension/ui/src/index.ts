/**
 * Minimal UI stub for Page Agent.
 * The full Panel UI is in the Chrome extension; this provides the type interface.
 */

import type { PageAgentCore } from '@page-agent/core'

export interface PanelConfig {
  language?: string
  promptForNextTask?: boolean
}

export class Panel {
  private agent: PageAgentCore
  private config: PanelConfig

  constructor(agent: PageAgentCore, config: PanelConfig) {
    this.agent = agent
    this.config = config
  }

  show(): void {}
  hide(): void {}
  destroy(): void {}
}
