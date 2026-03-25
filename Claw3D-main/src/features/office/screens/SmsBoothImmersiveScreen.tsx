"use client";

import { CheckCheck, MessageSquareText, Send, Smartphone } from "lucide-react";
import type { MockTextMessageScenario } from "@/lib/office/text/types";

export type TextMessageStep =
  | "selecting_contact"
  | "composing"
  | "sending"
  | "delivered"
  | "reply"
  | "complete";

export function SmsBoothImmersiveScreen({
  scenario,
  step,
  typedMessage,
  activeKey,
  contacts,
  activeContactIndex,
}: {
  scenario: MockTextMessageScenario;
  step: TextMessageStep;
  typedMessage: string;
  activeKey: string | null;
  contacts: string[];
  activeContactIndex: number | null;
}) {
  const statusLabel =
    step === "selecting_contact"
      ? "Selecting contact"
      : step === "composing"
      ? "Composing"
      : step === "sending"
        ? "Sending"
        : step === "delivered"
          ? "Delivered"
          : step === "reply"
            ? "Reply received"
            : "Message complete";
  const messageBody = typedMessage || scenario.messageText || "";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,#0f172a_0%,#050816_48%,#02030a_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(56,189,248,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative flex h-full items-center justify-center px-8 py-10">
        <div className="grid w-full max-w-5xl grid-cols-[1fr_0.92fr] gap-10">
          <div className="rounded-[32px] border border-sky-300/18 bg-slate-950/65 p-8 shadow-[0_24px_90px_rgba(2,8,23,0.75)]">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-sky-200/70">
              <MessageSquareText className="h-4 w-4" />
              Messaging Booth
            </div>
            <div className="mt-4 text-4xl font-semibold tracking-[0.08em] text-sky-50">
              {scenario.recipient}
            </div>
            <div className="mt-2 text-sm uppercase tracking-[0.24em] text-sky-200/55">
              {statusLabel}
            </div>
            <div className="mt-8 rounded-[28px] border border-sky-300/16 bg-slate-900/90 p-6">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-sky-200/60">
                <span>Typing from booth</span>
                <span>iPhone relay</span>
              </div>
              <div className="mt-5 rounded-[24px] border border-slate-700 bg-slate-950/80 px-5 py-4 text-base leading-7 text-sky-50">
                {messageBody || "Waiting for the first characters."}
                {step === "composing" ? <span className="ml-1 inline-block animate-pulse">|</span> : null}
              </div>
              <div className="mt-5 flex items-center justify-end gap-3 text-sm uppercase tracking-[0.22em]">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/22 bg-sky-400/10 px-4 py-2 text-sky-100/80">
                  <Smartphone className="h-4 w-4" />
                  Active
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-[#14F195]/24 bg-[#14F195]/10 px-4 py-2 text-[#14F195]/80">
                  {step === "sending" ? <Send className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
                  {step === "composing" ? "Drafting" : statusLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative h-[74vh] max-h-[720px] w-[360px] rounded-[44px] border border-sky-200/20 bg-[#020617] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.78)]">
              <div className="absolute left-1/2 top-3 h-1.5 w-28 -translate-x-1/2 rounded-full bg-slate-700" />
              <div className="relative flex h-full flex-col overflow-hidden rounded-[34px] border border-sky-300/12 bg-[linear-gradient(180deg,#081225_0%,#020617_100%)] px-5 py-6">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-sky-200/65">
                  <span>Messages</span>
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="mt-5 text-center">
                  <div className="text-[13px] uppercase tracking-[0.26em] text-sky-200/55">
                    {statusLabel}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-sky-50">
                    {scenario.recipient}
                  </div>
                </div>
                <div className="mt-6 flex-1">
                  {step === "selecting_contact" ? (
                    <ContactList
                      contacts={contacts}
                      activeContactIndex={activeContactIndex}
                    />
                  ) : (
                    <div className="space-y-4">
                      <Bubble
                        align="right"
                        label="Agent"
                        text={messageBody || "Starting draft."}
                        tone="primary"
                      />
                      {step === "delivered" || step === "reply" || step === "complete" ? (
                        <div className="text-right text-[11px] uppercase tracking-[0.2em] text-sky-200/45">
                          Delivered
                        </div>
                      ) : null}
                      {step === "reply" || step === "complete" ? (
                        <Bubble
                          align="left"
                          label={scenario.recipient}
                          text={scenario.confirmationText ?? "Delivered."}
                          tone="secondary"
                        />
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="mt-4 rounded-[24px] border border-sky-300/14 bg-slate-950/75 p-3">
                  <PhoneKeyboard activeKey={activeKey} />
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

function ContactList({
  contacts,
  activeContactIndex,
}: {
  contacts: string[];
  activeContactIndex: number | null;
}) {
  const selectedIndex = activeContactIndex ?? 0;
  const windowStart = Math.max(
    0,
    Math.min(selectedIndex - 2, Math.max(contacts.length - 5, 0)),
  );
  const visibleContacts = contacts.slice(windowStart, windowStart + 5);

  return (
    <div className="relative h-full overflow-hidden rounded-[24px] border border-sky-300/14 bg-slate-950/55 px-3 py-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(2,6,23,0))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-[linear-gradient(0deg,rgba(2,6,23,0.94),rgba(2,6,23,0))]" />
      <div className="space-y-2 pt-3">
        {visibleContacts.map((contact, index) => {
          const absoluteIndex = windowStart + index;
          const active = absoluteIndex === selectedIndex;
          return (
            <div
              key={`${contact}-${absoluteIndex}`}
              className={`rounded-[22px] border px-4 py-3 transition-all duration-150 ${
                active
                  ? "scale-[0.98] border-sky-200/70 bg-sky-300/20 text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                  : "border-slate-700/80 bg-slate-900/80 text-slate-200"
              }`}
            >
              <div className="text-sm font-medium">{contact}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] opacity-60">
                {active ? "Opening conversation" : "Recent thread"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "?"],
] as const;

function PhoneKeyboard({ activeKey }: { activeKey: string | null }) {
  return (
    <div className="space-y-2">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div
          key={row.join("")}
          className={`flex gap-2 ${rowIndex === 1 ? "px-3" : rowIndex === 2 ? "px-6" : ""}`}
        >
          {row.map((keyValue) => (
            <KeyboardKey
              key={keyValue}
              label={keyValue}
              active={activeKey === keyValue}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <KeyboardKey label="123" active={false} className="w-[18%]" />
        <KeyboardKey label="space" active={activeKey === "space"} className="flex-1" />
        <KeyboardKey label="return" active={activeKey === "return"} className="w-[22%]" />
      </div>
    </div>
  );
}

function KeyboardKey({
  label,
  active,
  className = "",
}: {
  label: string;
  active: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex h-9 min-w-0 flex-1 items-center justify-center rounded-2xl border text-[12px] font-medium uppercase tracking-[0.12em] transition-all duration-100 ${
        active
          ? "scale-[0.96] border-sky-200/70 bg-sky-300/30 text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.25)]"
          : "border-slate-700/90 bg-slate-800/90 text-slate-200"
      } ${className}`}
    >
      {label}
    </div>
  );
}

function Bubble({
  align,
  label,
  text,
  tone,
}: {
  align: "left" | "right";
  label: string;
  text: string;
  tone: "primary" | "secondary";
}) {
  return (
    <div className={align === "right" ? "ml-10" : "mr-10"}>
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
    </div>
  );
}
