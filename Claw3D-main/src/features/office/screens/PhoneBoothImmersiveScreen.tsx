"use client";

import { AudioLines, PhoneCall, Smartphone } from "lucide-react";
import type { MockPhoneCallScenario } from "@/lib/office/call/types";

export type PhoneCallStep =
  | "dialing"
  | "ringing"
  | "speaking"
  | "reply"
  | "complete";

export function PhoneBoothImmersiveScreen({
  scenario,
  step,
  typedDigits,
}: {
  scenario: MockPhoneCallScenario;
  step: PhoneCallStep;
  typedDigits: string;
}) {
  const statusLabel =
    step === "dialing"
      ? "Dialing"
      : step === "ringing"
        ? "Waiting for answer"
        : step === "speaking"
          ? "Connected"
          : step === "reply"
            ? "On the line"
            : "Call complete";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,#0f172a_0%,#050816_46%,#02030a_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(56,189,248,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative flex h-full items-center justify-center px-8 py-10">
        <div className="grid w-full max-w-5xl grid-cols-[1.05fr_0.95fr] gap-10">
          <div className="rounded-[32px] border border-sky-300/18 bg-slate-950/65 p-8 shadow-[0_24px_90px_rgba(2,8,23,0.75)]">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-sky-200/70">
              <PhoneCall className="h-4 w-4" />
              Phone Booth Call
            </div>
            <div className="mt-4 text-4xl font-semibold tracking-[0.08em] text-sky-50">
              {scenario.callee}
            </div>
            <div className="mt-2 text-sm uppercase tracking-[0.24em] text-sky-200/55">
              {statusLabel}
            </div>
            <div className="mt-8 rounded-[28px] border border-sky-300/16 bg-slate-900/90 p-6">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-sky-200/60">
                <span>Calling from booth</span>
                <span>{scenario.voiceAvailable ? "ElevenLabs ready" : "Text fallback"}</span>
              </div>
              <div className="mt-5 text-3xl font-medium tracking-[0.24em] text-sky-50">
                {typedDigits || scenario.dialNumber}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                  <div
                    key={digit}
                    className={`flex h-14 items-center justify-center rounded-2xl border text-xl ${
                      typedDigits.includes(digit)
                        ? "border-sky-300/40 bg-sky-400/16 text-sky-50"
                        : "border-slate-700 bg-slate-900/75 text-slate-300"
                    }`}
                  >
                    {digit}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-end">
                <div
                  className={`inline-flex items-center gap-3 rounded-2xl border px-5 py-3 text-sm uppercase tracking-[0.22em] transition-all ${
                    step === "dialing"
                      ? "border-[#14F195]/18 bg-[#14F195]/8 text-[#14F195]/72"
                      : "border-[#14F195]/45 bg-[#14F195]/18 text-[#14F195] shadow-[0_0_24px_rgba(74,222,128,0.22)]"
                  }`}
                >
                  <PhoneCall className="h-4 w-4" />
                  {step === "dialing" ? "Ready to call" : "Calling"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative h-[74vh] max-h-[720px] w-[360px] rounded-[44px] border border-sky-200/20 bg-[#020617] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.78)]">
              <div className="absolute left-1/2 top-3 h-1.5 w-28 -translate-x-1/2 rounded-full bg-slate-700" />
              <div className="relative flex h-full flex-col overflow-hidden rounded-[34px] border border-sky-300/12 bg-[linear-gradient(180deg,#081225_0%,#020617_100%)] px-6 py-8">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-sky-200/65">
                  <span>Cellular relay</span>
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="mt-8 flex h-28 w-28 items-center justify-center self-center rounded-full border border-sky-300/22 bg-sky-400/10 text-sky-100">
                  {step === "speaking" || step === "reply" ? (
                    <AudioLines className="h-12 w-12" />
                  ) : (
                    <PhoneCall className="h-12 w-12" />
                  )}
                </div>
                <div className="mt-6 text-center">
                  <div className="text-[13px] uppercase tracking-[0.26em] text-sky-200/55">
                    {statusLabel}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-sky-50">
                    {scenario.callee}
                  </div>
                  <div className="mt-2 text-sm tracking-[0.22em] text-sky-200/60">
                    {scenario.dialNumber}
                  </div>
                </div>
                <div className="mt-8 flex-1 space-y-4">
                  <Bubble
                    label="Agent"
                    text={
                      step === "dialing"
                        ? `Typing ${typedDigits || scenario.dialNumber}.`
                        : step === "ringing"
                          ? `Pressed call and waiting for ${scenario.callee} to answer.`
                          : scenario.spokenText ?? "Preparing the line."
                    }
                    tone="primary"
                  />
                  {step === "reply" || step === "complete" ? (
                    <Bubble
                      label={scenario.callee}
                      text={scenario.recipientReply ?? "The line is quiet."}
                      tone="secondary"
                    />
                  ) : null}
                </div>
                <div className="rounded-[24px] border border-sky-300/14 bg-slate-950/70 px-4 py-3 text-sm text-sky-100/78">
                  {scenario.statusLine}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "primary" | "secondary";
}) {
  return (
    <div
      className={`rounded-[24px] border px-4 py-4 ${
        tone === "primary"
          ? "border-sky-300/18 bg-sky-400/10 text-sky-50"
          : "border-slate-700 bg-slate-900/90 text-slate-100"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] opacity-60">{label}</div>
      <div className="mt-2 text-sm leading-6">{text}</div>
    </div>
  );
}
