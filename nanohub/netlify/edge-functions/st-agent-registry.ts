/**
 * st-agent-registry — Query on-chain agent reputation from 8004 registry.
 *
 * GET /st/agent-registry?asset=<address>  — returns agent reputation data
 * Fetches from 8004 indexer (no on-chain calls needed for reads).
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const INDEXER_BASE = "https://8004-indexer-main.qnt.sh/rest/v1";

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const asset = url.searchParams.get("asset");

  if (!asset) {
    return new Response(
      JSON.stringify({ error: "asset query parameter required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  try {
    // Fetch agent data from 8004 indexer
    const [agentResp, feedbackResp] = await Promise.all([
      fetch(`${INDEXER_BASE}/agents?asset=eq.${asset}&select=*&limit=1`),
      fetch(`${INDEXER_BASE}/feedbacks?agent=eq.${asset}&select=score,tag1,created_at&order=created_at.desc&limit=50`),
    ]);

    const agents = agentResp.ok ? await agentResp.json() : [];
    const feedbacks = feedbackResp.ok ? await feedbackResp.json() : [];

    const agent = agents[0] ?? null;

    // Compute reputation summary from feedbacks
    let atomScore = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    for (const fb of feedbacks) {
      const score = fb.score ?? 0;
      if (score >= 50) positiveCount++;
      else negativeCount++;
      atomScore += score;
    }
    const avgScore = feedbacks.length > 0 ? Math.round(atomScore / feedbacks.length) : 0;

    // Determine trust tier
    let trustTier = "unrated";
    if (feedbacks.length >= 20 && avgScore >= 90) trustTier = "platinum";
    else if (feedbacks.length >= 10 && avgScore >= 80) trustTier = "gold";
    else if (feedbacks.length >= 5 && avgScore >= 65) trustTier = "silver";
    else if (feedbacks.length >= 1) trustTier = "bronze";

    const result = {
      asset,
      agent: agent ? {
        name: agent.name,
        uri: agent.uri,
        owner: agent.owner,
        wallet: agent.wallet,
        atom_enabled: agent.atom_enabled,
        created_at: agent.created_at,
      } : null,
      reputation: {
        atomScore: avgScore,
        trustTier,
        feedbackCount: feedbacks.length,
        positiveCount,
        negativeCount,
        recentFeedbacks: feedbacks.slice(0, 10),
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch agent data", detail: String(err) }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
};

export const config = { path: "/st/agent-registry" };
