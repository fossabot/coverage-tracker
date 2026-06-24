-- owners: a GitHub user or org that owns tracked repos
CREATE TABLE owners (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id     INTEGER NOT NULL UNIQUE,
  login         TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK (type IN ('User','Organization')),
  avatar_url    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- projects: a single repo under an owner, registered via App installation
CREATE TABLE projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id        INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  github_repo_id  INTEGER NOT NULL UNIQUE,
  repo_name       TEXT    NOT NULL,
  full_slug       TEXT    NOT NULL UNIQUE,
  installation_id INTEGER NOT NULL,
  default_branch  TEXT    NOT NULL DEFAULT 'main',
  badge_enabled   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_installation ON projects(installation_id);

-- metrics: one row per (project, branch, commit, metric) — append-only
CREATE TABLE metrics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  branch        TEXT    NOT NULL,
  commit_sha    TEXT    NOT NULL,
  metric_name   TEXT    NOT NULL,
  value         REAL    NOT NULL,
  unit          TEXT    NOT NULL,
  recorded_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_metrics_trend
  ON metrics(project_id, branch, metric_name, recorded_at);

CREATE INDEX idx_metrics_latest
  ON metrics(project_id, branch, metric_name, commit_sha);

-- Idempotent ingest (A11): re-ingesting the same commit+metric is a no-op
CREATE UNIQUE INDEX idx_metrics_idempotent
  ON metrics(project_id, commit_sha, metric_name);

-- Webhook replay protection (A5): deduplicate on GitHub's X-GitHub-Delivery id
CREATE TABLE webhook_deliveries (
  delivery_id TEXT NOT NULL PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
