import { Hono } from 'hono';
import { requireOidc } from '../middleware/oidc';
import { getProjectBySlug, insertMetric } from '../lib/db';
import type { Bindings, Variables, MetricPayload } from '../types';

const ingest = new Hono<{ Bindings: Bindings; Variables: Variables }>();

ingest.post('/', requireOidc(), async (c) => {
  const claims = c.get('oidcClaims');

  // Derive repo/branch/sha from the OIDC token — ignore any body values (A3)
  const { repository, ref, sha, ref_type } = claims;

  // Reject non-branch refs (tags, etc.) — only branches should produce trend data (A3)
  if (ref_type !== 'branch') {
    return c.json({ error: 'Ingest is only allowed from branch refs' }, 422);
  }

  const branch = ref.replace(/^refs\/heads\//, '');

  const project = await getProjectBySlug(c.env.DB, repository);
  if (!project) {
    return c.json({ error: 'Repository not registered' }, 403);
  }

  // Only persist metrics from the configured default branch
  if (branch !== project.default_branch) {
    return c.json({ error: 'Ingest only accepted on the default branch' }, 422);
  }

  let body: { metrics?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!Array.isArray(body.metrics) || body.metrics.length === 0) {
    return c.json({ error: 'metrics array is required' }, 400);
  }

  const metrics = body.metrics as MetricPayload[];
  for (const m of metrics) {
    if (typeof m.name !== 'string' || typeof m.value !== 'number' || typeof m.unit !== 'string') {
      return c.json({ error: 'Each metric must have name (string), value (number), unit (string)' }, 400);
    }
  }

  for (const m of metrics) {
    await insertMetric(c.env.DB, project.id, branch, sha, m.name, m.value, m.unit);
  }

  return c.json({ ok: true, inserted: metrics.length }, 200);
});

export default ingest;
