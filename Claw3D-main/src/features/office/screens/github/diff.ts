"use client";

import type {
  GitHubInlineCommentSide,
  GitHubPullRequestDetail,
} from "@/lib/office/github";

export type GitHubDiffFile = GitHubPullRequestDetail["files"][number];

export type ParsedDiffLine = {
  id: string;
  text: string;
  kind: "meta" | "hunk" | "context" | "add" | "del";
  oldNumber: number | null;
  newNumber: number | null;
  lineNumber: number | null;
  side: GitHubInlineCommentSide | null;
  commentable: boolean;
};

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export const getDiffLineTone = (line: string): string => {
  if (line.startsWith("@@")) {
    return "bg-cyan-400/10 text-cyan-100";
  }
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return "bg-[#14F195]/12 text-[#14F195]";
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return "bg-rose-500/12 text-rose-100";
  }
  if (
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("---") ||
    line.startsWith("+++")
  ) {
    return "bg-white/4 text-white/72";
  }
  return "text-white/78";
};

export const parseDiffPatch = (patch: string | null): ParsedDiffLine[] => {
  const lines = (patch ?? "Diff preview unavailable for this file.").split("\n");
  const parsed: ParsedDiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  lines.forEach((line, index) => {
    const hunkMatch = line.match(HUNK_HEADER_PATTERN);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[2]);
      inHunk = true;
      parsed.push({
        id: `hunk-${index}`,
        text: line,
        kind: "hunk",
        oldNumber: null,
        newNumber: null,
        lineNumber: null,
        side: null,
        commentable: false,
      });
      return;
    }

    if (!inHunk) {
      parsed.push({
        id: `meta-${index}`,
        text: line,
        kind: "meta",
        oldNumber: null,
        newNumber: null,
        lineNumber: null,
        side: null,
        commentable: false,
      });
      return;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      parsed.push({
        id: `add-${index}`,
        text: line,
        kind: "add",
        oldNumber: null,
        newNumber: newLine,
        lineNumber: newLine,
        side: "RIGHT",
        commentable: true,
      });
      newLine += 1;
      return;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      parsed.push({
        id: `del-${index}`,
        text: line,
        kind: "del",
        oldNumber: oldLine,
        newNumber: null,
        lineNumber: oldLine,
        side: "LEFT",
        commentable: true,
      });
      oldLine += 1;
      return;
    }

    if (line.startsWith("\\")) {
      parsed.push({
        id: `meta-${index}`,
        text: line,
        kind: "meta",
        oldNumber: null,
        newNumber: null,
        lineNumber: null,
        side: null,
        commentable: false,
      });
      return;
    }

    parsed.push({
      id: `ctx-${index}`,
      text: line,
      kind: "context",
      oldNumber: oldLine,
      newNumber: newLine,
      lineNumber: newLine,
      side: "RIGHT",
      commentable: true,
    });
    oldLine += 1;
    newLine += 1;
  });

  return parsed;
};
