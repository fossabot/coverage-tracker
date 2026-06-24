-- Local development seed data.
-- Run with: npx wrangler d1 execute DB --local --file test/seed-local.sql
-- Safe to re-run (INSERT OR IGNORE).

INSERT OR IGNORE INTO owners (id, github_id, login, type, avatar_url)
VALUES (1, 1234567, 'ZeroStash', 'Organization', 'https://avatars.githubusercontent.com/u/1234567');

INSERT OR IGNORE INTO projects (id, owner_id, github_repo_id, repo_name, full_slug, installation_id, default_branch, badge_enabled)
VALUES (1, 1, 9876543, 'coverage-tracker', 'ZeroStash/coverage-tracker', 1, 'main', 0);

-- Coverage trend: 15 pushes over the past 2 weeks, rising from ~91% to 98%
INSERT OR IGNORE INTO metrics (project_id, branch, commit_sha, metric_name, value, unit, recorded_at) VALUES
  (1, 'main', 'aaa0001', 'coverage', 91.2, '%', datetime('now', '-14 days')),
  (1, 'main', 'aaa0002', 'coverage', 91.8, '%', datetime('now', '-13 days')),
  (1, 'main', 'aaa0003', 'coverage', 92.5, '%', datetime('now', '-12 days')),
  (1, 'main', 'aaa0004', 'coverage', 91.9, '%', datetime('now', '-11 days')),
  (1, 'main', 'aaa0005', 'coverage', 93.1, '%', datetime('now', '-10 days')),
  (1, 'main', 'aaa0006', 'coverage', 94.0, '%', datetime('now', '-9 days')),
  (1, 'main', 'aaa0007', 'coverage', 94.4, '%', datetime('now', '-8 days')),
  (1, 'main', 'aaa0008', 'coverage', 95.2, '%', datetime('now', '-7 days')),
  (1, 'main', 'aaa0009', 'coverage', 95.0, '%', datetime('now', '-6 days')),
  (1, 'main', 'aaa0010', 'coverage', 96.1, '%', datetime('now', '-5 days')),
  (1, 'main', 'aaa0011', 'coverage', 96.8, '%', datetime('now', '-4 days')),
  (1, 'main', 'aaa0012', 'coverage', 97.3, '%', datetime('now', '-3 days')),
  (1, 'main', 'aaa0013', 'coverage', 97.5, '%', datetime('now', '-2 days')),
  (1, 'main', 'aaa0014', 'coverage', 98.0, '%', datetime('now', '-1 day')),
  (1, 'main', 'aaa0015', 'coverage', 98.1, '%', datetime('now'));

-- Duplication trend: always 0% (no clones detected)
INSERT OR IGNORE INTO metrics (project_id, branch, commit_sha, metric_name, value, unit, recorded_at) VALUES
  (1, 'main', 'aaa0001', 'duplication', 0.0, '%', datetime('now', '-14 days')),
  (1, 'main', 'aaa0005', 'duplication', 0.0, '%', datetime('now', '-10 days')),
  (1, 'main', 'aaa0010', 'duplication', 0.0, '%', datetime('now', '-5 days')),
  (1, 'main', 'aaa0015', 'duplication', 0.0, '%', datetime('now'));
