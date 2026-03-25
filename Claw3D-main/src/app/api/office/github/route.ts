import { NextResponse } from "next/server";

import {
  loadGitHubDashboard,
  loadGitHubPullRequestDetail,
  submitGitHubInlineComment,
  submitGitHubPullRequestReview,
  type GitHubInlineCommentSide,
  type GitHubReviewAction,
} from "@/lib/office/github";

export const runtime = "nodejs";

type ReviewRequestBody = {
  repo?: string;
  number?: number;
  action?: GitHubReviewAction;
  body?: string | null;
  path?: string;
  line?: number;
  side?: GitHubInlineCommentSide;
  commitId?: string | null;
};

const parsePullRequestNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = (searchParams.get("repo") ?? "").trim();
    const number = parsePullRequestNumber(searchParams.get("number"));
    if (repo && number) {
      return NextResponse.json(loadGitHubPullRequestDetail({ repo, number }), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(loadGitHubDashboard(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load GitHub server room data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewRequestBody;
    const repo = typeof body.repo === "string" ? body.repo.trim() : "";
    const number =
      typeof body.number === "number" && Number.isFinite(body.number)
        ? Math.round(body.number)
        : null;
    const action = typeof body.action === "string" ? body.action : null;
    const path = typeof body.path === "string" ? body.path.trim() : "";
    const line =
      typeof body.line === "number" && Number.isFinite(body.line)
        ? Math.round(body.line)
        : null;
    const side = body.side === "LEFT" || body.side === "RIGHT" ? body.side : null;
    const commentBody = typeof body.body === "string" ? body.body : null;

    if (action) {
      if (!repo || !number) {
        return NextResponse.json(
          { error: "repo, number, and action are required." },
          { status: 400 },
        );
      }

      if (!["APPROVE", "COMMENT", "REQUEST_CHANGES"].includes(action)) {
        return NextResponse.json(
          { error: "Unsupported review action." },
          { status: 400 },
        );
      }

      const result = submitGitHubPullRequestReview({
        repo,
        number,
        action,
        body: commentBody,
      });
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!repo || !number || !path || !line || !side || !commentBody?.trim()) {
      return NextResponse.json(
        { error: "repo, number, path, line, side, and body are required." },
        { status: 400 },
      );
    }

    const result = submitGitHubInlineComment({
      repo,
      number,
      path,
      line,
      side,
      body: commentBody,
      commitId: typeof body.commitId === "string" ? body.commitId : null,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit GitHub review.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
