"use client";

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";

import type { GitHubInlineCommentSide } from "@/lib/office/github";

import {
  getDiffLineTone,
  parseDiffPatch,
  type GitHubDiffFile,
} from "./diff";
import { maskGitHubRecordingText } from "./utils";

type FileDiffModalProps = {
  file: GitHubDiffFile;
  repo: string;
  pullNumber: number;
  commitId: string | null;
  onSubmitInlineComment: (input: {
    repo: string;
    pullNumber: number;
    commitId: string | null;
    path: string;
    line: number;
    side: GitHubInlineCommentSide;
    body: string;
  }) => Promise<void>;
  onClose: () => void;
};

export function FileDiffModal({
  file,
  repo,
  pullNumber,
  commitId,
  onSubmitInlineComment,
  onClose,
}: FileDiffModalProps) {
  const diffLines = useMemo(() => parseDiffPatch(file.patch), [file.patch]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [submissionTone, setSubmissionTone] = useState<"info" | "success" | "error">(
    "info",
  );
  const selectedLine = useMemo(
    () =>
      diffLines.find((line) => line.id === selectedLineId && line.commentable) ??
      null,
    [diffLines, selectedLineId],
  );

  const handleSubmitComment = useCallback(() => {
    if (!selectedLine?.side || !selectedLine.lineNumber) return;
    const nextCommentBody = commentBody;
    const nextLineNumber = selectedLine.lineNumber;
    const nextSide = selectedLine.side;
    setCommentBusy(true);
    setCommentError(null);
    setSubmissionTone("info");
    setSubmissionMessage("Submitting inline comment...");
    setCommentBody("");
    setSelectedLineId(null);

    void onSubmitInlineComment({
      repo,
      pullNumber,
      commitId,
      path: file.path,
      line: nextLineNumber,
      side: nextSide,
      body: nextCommentBody,
    })
      .then(() => {
        setSubmissionTone("success");
        setSubmissionMessage("Inline comment submitted.");
      })
      .catch((error) => {
        setSubmissionTone("error");
        setSubmissionMessage(
          error instanceof Error
            ? error.message
            : "Unable to submit the inline comment.",
        );
      })
      .finally(() => {
        setCommentBusy(false);
      });
  }, [
    commentBody,
    commitId,
    file.path,
    onSubmitInlineComment,
    pullNumber,
    repo,
    selectedLine,
  ]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/76 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92%] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-cyan-300/16 bg-[#081223] shadow-[0_28px_120px_rgba(0,0,0,0.66)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/48">
              File Diff
            </div>
            <div className="mt-2 break-all text-lg font-semibold text-white">
              {file.path}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
              {file.status ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {file.status}
                </span>
              ) : null}
              <span className="rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2.5 py-1 text-[#14F195]/88">
                +{file.additions}
              </span>
              <span className="rounded-full border border-rose-400/18 bg-rose-400/10 px-2.5 py-1 text-rose-100/88">
                -{file.deletions}
              </span>
            </div>
            {file.previousPath ? (
              <div className="mt-3 text-sm text-white/54">
                Renamed from {file.previousPath}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-white/18 hover:text-white"
            aria-label="Close file diff"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#050b15]">
            <div className="border-b border-white/8 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-white/40">
              Patch
            </div>
            {submissionMessage ? (
              <div
                className={`border-b px-4 py-3 text-sm ${
                  submissionTone === "success"
                    ? "border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]"
                    : submissionTone === "error"
                      ? "border-rose-400/18 bg-rose-400/10 text-rose-100"
                      : "border-cyan-300/14 bg-cyan-300/10 text-cyan-100"
                }`}
              >
                {submissionMessage}
              </div>
            ) : null}
            <div className="overflow-auto p-2">
              {diffLines.map((line) => (
                <div key={line.id}>
                  {line.commentable ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLineId(line.id);
                        setCommentError(null);
                      }}
                      className={`grid w-full grid-cols-[44px_44px_minmax(0,1fr)] gap-3 rounded-md px-3 py-1 text-left transition-colors hover:bg-white/6 ${
                        selectedLine?.id === line.id ? "ring-1 ring-cyan-300/28" : ""
                      } ${getDiffLineTone(line.text)}`}
                    >
                      <span className="select-none text-right font-mono text-[11px] text-white/28">
                        {line.oldNumber ?? ""}
                      </span>
                      <span className="select-none text-right font-mono text-[11px] text-white/28">
                        {line.newNumber ?? ""}
                      </span>
                      <span className="block whitespace-pre-wrap break-all font-mono text-[12px] leading-5">
                        {maskGitHubRecordingText(line.text) || " "}
                      </span>
                    </button>
                  ) : (
                    <div
                      className={`grid grid-cols-[44px_44px_minmax(0,1fr)] gap-3 rounded-md px-3 py-1 ${getDiffLineTone(line.text)}`}
                    >
                      <span className="select-none text-right font-mono text-[11px] text-white/22" />
                      <span className="select-none text-right font-mono text-[11px] text-white/22" />
                      <span className="block whitespace-pre-wrap break-all font-mono text-[12px] leading-5">
                        {maskGitHubRecordingText(line.text) || " "}
                      </span>
                    </div>
                  )}
                  {selectedLine?.id === line.id ? (
                    <div className="mx-3 my-2 rounded-2xl border border-cyan-300/14 bg-[#0b172c] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/58">
                        Comment on {(selectedLine.side ?? "RIGHT").toLowerCase()} side
                        line {selectedLine.lineNumber}
                      </div>
                      <textarea
                        value={commentBody}
                        onChange={(event) => setCommentBody(event.target.value)}
                        placeholder="Add an inline comment."
                        className="mt-3 h-28 w-full resize-none rounded-2xl border border-white/8 bg-black/22 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28"
                      />
                      {commentError ? (
                        <div className="mt-3 rounded-xl border border-rose-400/18 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                          {commentError}
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-[12px] text-white/45">
                          This posts directly to GitHub on the selected diff line.
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLineId(null);
                              setCommentBody("");
                              setCommentError(null);
                            }}
                            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/68 transition-colors hover:border-white/18 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={commentBusy || !commentBody.trim()}
                            onClick={() => void handleSubmitComment()}
                            className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-[12px] text-cyan-100 transition-colors hover:border-cyan-200/38 hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {commentBusy ? "Submitting..." : "Add Comment"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
