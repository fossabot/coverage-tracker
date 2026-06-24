import { Hono } from 'hono';
import { requireAccess } from '../middleware/access';
import { requireOidc } from '../middleware/oidc';
import { listProjectsWithOwners, getProjectBySlug, getMetricsTrend, getLatestMetric } from '../lib/db';
import type { Bindings, Variables } from '../types';

const api = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/** List all tracked projects, grouped with owner metadata. Access-gated. */
api.get('/projects', requireAccess(), async (c) => {
  const rows = await listProjectsWithOwners(c.env.DB);
  return c.json(rows);
});

/** Trend data for one repo+branch+metric. Access-gated. */
api.get('/projects/:owner/:repo/metrics', requireAccess(), async (c) => {
  const fullSlug = `${c.req.param('owner')}/${c.req.param('repo')}`;
  const project = await getProjectBySlug(c.env.DB, fullSlug);
  if (!project) return c.json({ error: 'Not found' }, 404);

  const metric = c.req.query('metric') ?? 'coverage';
  const branch = c.req.query('branch') ?? project.default_branch;
  const limit = Math.min(Number(c.req.query('limit') ?? '100'), 1000);

  const rows = await getMetricsTrend(c.env.DB, project.id, branch, metric, limit);
  return c.json({ project: fullSlug, branch, metric, data: rows });
});

/**
 * Latest metric value for a repo+branch — the baseline for threshold/PR checks.
 * OIDC-gated + project-scoped: only the repo whose token is presented can read its own baseline.
 */
api.get('/projects/:owner/:repo/baseline', requireOidc(), async (c) => {
  const claims = c.get('oidcClaims');

  // Use the OIDC-verified repository identity — the URL params are informational only
  const project = await getProjectBySlug(c.env.DB, claims.repository);
  if (!project) return c.json({ error: 'Repository not registered' }, 403);

  // Verify the URL params match the token (extra sanity check, not the auth gate)
  const urlSlug = `${c.req.param('owner')}/${c.req.param('repo')}`;
  if (urlSlug !== claims.repository) {
    return c.json({ error: 'URL path does not match OIDC token repository' }, 403);
  }

  const metric = c.req.query('metric') ?? 'coverage';
  const branch = c.req.query('branch') ?? project.default_branch;

  const row = await getLatestMetric(c.env.DB, project.id, branch, metric);
  if (!row) return c.json({ error: 'No data for this metric/branch' }, 404);

  return c.json({ project: claims.repository, branch, metric, ...row });
});

export default api;
