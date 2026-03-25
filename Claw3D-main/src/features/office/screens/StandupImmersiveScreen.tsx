"use client";

import { ExternalLink, X } from "lucide-react";

import type { StandupMeeting } from "@/lib/office/standup/types";

const sourceTone = (ready: boolean, stale: boolean) => {
  if (!ready) return stale ? "text-amber-200 border-amber-400/25" : "text-rose-200 border-rose-400/25";
  return "text-[#14F195] border-[#14F195]/25";
};

export function StandupImmersiveScreen({
  meeting,
  onClose,
}: {
  meeting: StandupMeeting;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[#05070b]/96 text-white">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-cyan-500/15 px-6 py-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-200/85">
              Standup Board
            </div>
            <div className="mt-1 font-mono text-[12px] text-white/50">
              {meeting.phase === "gathering"
                ? "Everyone is walking to the meeting room."
                : meeting.phase === "in_progress"
                  ? "Team updates are being presented."
                  : "Last standup snapshot."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>

        <div className="grid gap-4 border-b border-cyan-500/10 px-6 py-4 font-mono text-[11px] text-white/60 md:grid-cols-3">
          <div>Phase: {meeting.phase}</div>
          <div>Speaker: {meeting.currentSpeakerAgentId ?? "Waiting"}</div>
          <div>
            Progress: {meeting.arrivedAgentIds.length}/{meeting.participantOrder.length} arrived
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 xl:grid-cols-3">
            {meeting.cards.map((card) => {
              const isSpeaking = card.agentId === meeting.currentSpeakerAgentId;
              return (
                <section
                  key={card.agentId}
                  className={`rounded-2xl border px-4 py-4 ${
                    isSpeaking
                      ? "border-cyan-400/35 bg-cyan-500/[0.08]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
                        Participant
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {card.agentName}
                      </div>
                    </div>
                    {isSpeaking ? (
                      <div className="rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100">
                        Speaking
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Current task
                      </div>
                      <div className="mt-1 text-sm leading-6 text-white/85">
                        {card.currentTask}
                      </div>
                    </div>

                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Recent commits
                      </div>
                      <div className="mt-2 space-y-2">
                        {card.recentCommits.length === 0 ? (
                          <div className="font-mono text-[11px] text-white/35">
                            No recent GitHub activity.
                          </div>
                        ) : (
                          card.recentCommits.map((commit) => (
                            <div
                              key={commit.id}
                              className="rounded border border-white/8 bg-black/20 px-3 py-2"
                            >
                              <div className="text-sm text-white/82">{commit.title}</div>
                              {commit.subtitle ? (
                                <div className="mt-1 font-mono text-[10px] text-white/40">
                                  {commit.subtitle}
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Active tickets
                      </div>
                      <div className="mt-2 space-y-2">
                        {card.activeTickets.length === 0 ? (
                          <div className="font-mono text-[11px] text-white/35">
                            No active Jira tickets.
                          </div>
                        ) : (
                          card.activeTickets.map((ticket) => (
                            <div
                              key={ticket.id}
                              className="rounded border border-white/8 bg-black/20 px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200/80">
                                    {ticket.key}
                                  </div>
                                  <div className="mt-1 text-sm text-white/82">
                                    {ticket.title}
                                  </div>
                                  <div className="mt-1 font-mono text-[10px] text-white/40">
                                    {ticket.status}
                                  </div>
                                </div>
                                {ticket.url ? (
                                  <a
                                    href={ticket.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-white/45 transition-colors hover:text-white"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Blockers
                      </div>
                      <div className="mt-2 space-y-2">
                        {card.blockers.length === 0 ? (
                          <div className="font-mono text-[11px] text-[#14F195]/75">
                            No blockers reported.
                          </div>
                        ) : (
                          card.blockers.map((blocker, index) => (
                            <div
                              key={`${card.agentId}-blocker-${index}`}
                              className="rounded border border-rose-400/20 bg-rose-500/[0.06] px-3 py-2 text-sm text-rose-100/90"
                            >
                              {blocker}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {card.manualNotes.length > 0 ? (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                          Manual notes
                        </div>
                        <div className="mt-2 space-y-2">
                          {card.manualNotes.map((note, index) => (
                            <div
                              key={`${card.agentId}-note-${index}`}
                              className="rounded border border-white/8 bg-black/20 px-3 py-2 text-sm text-white/75"
                            >
                              {note}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Sources
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {card.sourceStates.map((source) => (
                          <div
                            key={`${card.agentId}-${source.kind}`}
                            className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${sourceTone(
                              source.ready,
                              source.stale
                            )}`}
                          >
                            {source.kind}
                            {source.error ? ` · ${source.error}` : source.stale ? " · stale" : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
