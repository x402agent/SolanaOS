import { Check, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { type ReactNode, useState } from 'react'

export type SetupStep = {
  title: string
  icon: ReactNode
  content: ReactNode
}

export function SetupStepper({
  steps,
  currentStep,
  onStepChange,
}: {
  steps: SetupStep[]
  currentStep: number
  onStepChange: (step: number) => void
}) {
  return (
    <div className="setup-stepper">
      <nav className="setup-step-nav" aria-label="Setup steps">
        {steps.map((step, index) => (
          <button
            key={index}
            type="button"
            className={`setup-step-indicator ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            onClick={() => onStepChange(index)}
          >
            <span className="setup-step-number">
              {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className="setup-step-title">{step.title}</span>
          </button>
        ))}
      </nav>

      <div className="setup-step-content card">
        <div className="gallery-panel-header">
          <div>
            <h2>
              Step {currentStep + 1}: {steps[currentStep].title}
            </h2>
          </div>
          {steps[currentStep].icon}
        </div>
        {steps[currentStep].content}
      </div>

      <div className="setup-nav">
        <button
          type="button"
          className="btn"
          disabled={currentStep === 0}
          onClick={() => onStepChange(currentStep - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </button>
        <span className="setup-progress">
          {currentStep + 1} / {steps.length}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={currentStep === steps.length - 1}
          onClick={() => onStepChange(currentStep + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="setup-code-block">
      <pre>
        <code>{code}</code>
      </pre>
      <button type="button" className="btn btn-secondary setup-copy-btn" onClick={() => void handleCopy()}>
        <Copy className="h-4 w-4" aria-hidden="true" />
        {copied ? 'Copied' : label ?? 'Copy'}
      </button>
    </div>
  )
}
