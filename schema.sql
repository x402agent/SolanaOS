-- ============================================================
-- MAWDBOT OS :: COMPLETE SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor to create all tables.
-- Covers: memory, trades, market data, research, strategy,
--         agents, experiments, and wallets.
-- ============================================================

-- Extensions
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- ============================================================
-- CORE MEMORY TABLE (3-tier: known / learned / inferred)
-- ============================================================
create table if not exists agent_memories (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  memory_type     text not null check (memory_type in ('known', 'learned', 'inferred')),
  source          text not null,
  topic           text not null,
  asset           text,
  asset_class     text,
  timeframe       text,
  content         text not null,
  raw_data        jsonb,
  metadata        jsonb default '{}',
  embedding       vector(1536),
  confidence      float default 1.0 check (confidence between 0 and 1),
  reinforcement   int default 1,
  contradictions  int default 0,
  expires_at      timestamptz,
  parent_memory_id uuid references agent_memories(id),
  trade_ids       uuid[],
  session_id      text
);

create index if not exists idx_memories_embedding on agent_memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_memories_type on agent_memories (memory_type);
create index if not exists idx_memories_source on agent_memories (source);
create index if not exists idx_memories_asset on agent_memories (asset);
create index if not exists idx_memories_created on agent_memories (created_at desc);
create index if not exists idx_memories_expires on agent_memories (expires_at) where expires_at is not null;

-- ============================================================
-- TRADE RECORDS
-- ============================================================
create table if not exists trade_records (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  settled_at      timestamptz,
  mode            text not null check (mode in ('live', 'simulated', 'backtest')),
  asset           text not null,
  asset_class     text not null,
  direction       text not null check (direction in ('long', 'short')),
  entry_price     numeric(20,8) not null,
  exit_price      numeric(20,8),
  size            numeric(20,8) not null,
  size_usd        numeric(20,4),
  pnl_usd         numeric(20,4),
  pnl_pct         numeric(10,4),
  status          text default 'open' check (status in ('open','closed','cancelled','failed')),
  signal_source   text,
  thesis          text,
  confidence      float,
  memory_ids      uuid[],
  stop_loss       numeric(20,8),
  take_profit     numeric(20,8),
  max_drawdown    numeric(10,4),
  tx_signature    text,
  wallet          text,
  outcome_notes   text,
  learned_memory_id uuid references agent_memories(id)
);

create index if not exists idx_trades_asset on trade_records (asset);
create index if not exists idx_trades_status on trade_records (status);
create index if not exists idx_trades_created on trade_records (created_at desc);

-- ============================================================
-- MARKET SNAPSHOTS
-- ============================================================
create table if not exists market_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  captured_at     timestamptz default now(),
  source          text not null,
  asset           text not null,
  asset_class     text not null,
  snapshot_type   text not null,
  data            jsonb not null,
  ttl_seconds     int default 300
);

create index if not exists idx_snapshots_asset on market_snapshots (asset, snapshot_type, captured_at desc);
create index if not exists idx_snapshots_created on market_snapshots (captured_at desc);

-- ============================================================
-- RESEARCH REPORTS
-- ============================================================
create table if not exists research_reports (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  title           text not null,
  asset           text,
  asset_class     text,
  report_type     text,
  summary         text not null,
  full_text       text,
  data_sources    text[],
  memory_ids      uuid[],
  confidence      float,
  embedding       vector(1536),
  tags            text[]
);

create index if not exists idx_reports_embedding on research_reports using ivfflat (embedding vector_cosine_ops) with (lists = 50);
create index if not exists idx_reports_asset on research_reports (asset, created_at desc);

-- ============================================================
-- LEARNING EVENTS
-- ============================================================
create table if not exists learning_events (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  event_type      text not null,
  description     text not null,
  old_belief      text,
  new_belief      text,
  evidence        jsonb,
  triggered_by    text,
  trade_id        uuid references trade_records(id),
  affected_memory_ids uuid[],
  new_memory_id   uuid references agent_memories(id)
);

-- ============================================================
-- KNOWLEDGE INDEX
-- ============================================================
create table if not exists knowledge_index (
  id              uuid primary key default uuid_generate_v4(),
  first_seen_at   timestamptz default now(),
  last_refreshed  timestamptz default now(),
  entity_type     text not null,
  entity_id       text not null,
  entity_name     text,
  has_price_data      bool default false,
  has_fundamentals    bool default false,
  has_on_chain_data   bool default false,
  has_news            bool default false,
  has_trade_history   bool default false,
  learned_patterns    text[],
  learned_correlations jsonb,
  learned_signals     text[],
  summary         text,
  embedding       vector(1536),
  unique (entity_type, entity_id)
);

create index if not exists idx_knowledge_embedding on knowledge_index using ivfflat (embedding vector_cosine_ops) with (lists = 50);
create index if not exists idx_knowledge_entity on knowledge_index (entity_type, entity_id);

-- ============================================================
-- STRATEGY STATE
-- ============================================================
create table if not exists strategy_state (
  strategy_key  text primary key,
  state         jsonb not null,
  updated_at    timestamptz not null default now()
);

create index if not exists idx_strategy_updated on strategy_state(updated_at desc);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger agent_memories_updated_at
  before update on agent_memories
  for each row execute function update_updated_at();

create or replace function search_memories(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_type text default null,
  filter_asset text default null
)
returns table (
  id uuid,
  memory_type text,
  source text,
  topic text,
  asset text,
  content text,
  metadata jsonb,
  confidence float,
  created_at timestamptz,
  similarity float
) as $$
begin
  return query
  select
    m.id, m.memory_type, m.source, m.topic, m.asset,
    m.content, m.metadata, m.confidence, m.created_at,
    1 - (m.embedding <=> query_embedding) as similarity
  from agent_memories m
  where m.embedding is not null
    and (filter_type is null or m.memory_type = filter_type)
    and (filter_asset is null or m.asset = filter_asset)
    and (m.expires_at is null or m.expires_at > now())
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
end;
$$ language plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

create or replace view knowledge_vs_learned as
select
  asset, asset_class,
  count(*) filter (where memory_type = 'known') as known_facts,
  count(*) filter (where memory_type = 'learned') as learned_insights,
  count(*) filter (where memory_type = 'inferred') as inferred_connections,
  avg(confidence) filter (where memory_type = 'learned') as avg_learned_confidence,
  max(created_at) as most_recent_memory
from agent_memories
where expires_at is null or expires_at > now()
group by asset, asset_class
order by (count(*)) desc;

create or replace view strategy_active_params as
select
  strategy_key,
  state ->> 'last_updated' as last_updated,
  (state ->> 'best_metric')::float as best_metric,
  state ->> 'metric_name' as metric_name,
  state -> 'active_params' as active_params,
  jsonb_array_length(state -> 'changelog') as changelog_entries
from strategy_state;

create or replace view strategy_changelog as
select
  strategy_key,
  entry ->> 'id' as entry_id,
  (entry ->> 'timestamp')::timestamptz as changed_at,
  entry ->> 'reason' as reason,
  entry ->> 'triggered_by' as triggered_by,
  entry -> 'delta' as param_delta,
  (entry ->> 'metric_before')::float as metric_before,
  (entry ->> 'metric_after')::float as metric_after,
  entry -> 'new_params' as new_params
from strategy_state,
  jsonb_array_elements(state -> 'changelog') as entry
order by (entry ->> 'timestamp')::timestamptz desc;
