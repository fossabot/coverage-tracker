import { Hono } from 'hono';
import { getProjectBySlug, getLatestMetric } from '../lib/db';
import type { Bindings, Variables } from '../types';

const badge = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Public shields.io endpoint format.
 * Returns 404 (not 403) for projects with badge_enabled=0 to avoid confirming existence (A12).
 */
badge.get('/:owner/:repo/:metric{.+\\.json}', async (c) => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const metricParam = c.req.param('metric');
  const metricName = metricParam.replace(/\.json$/, '');

  const project = await getProjectBySlug(c.env.DB, `${owner}/${repo}`);
  if (!project || project.badge_enabled === 0) {
    return c.notFound();
  }

  const row = await getLatestMetric(c.env.DB, project.id, project.default_branch, metricName);
  if (!row) return c.notFound();

  const message = row.unit === '%' ? `${row.value.toFixed(1)}%` : `${row.value}`;
  const color = badgeColor(metricName, row.value);

  return c.json({
    schemaVersion: 1,
    label: metricName,
    message,
    color,
  });
});

function badgeColor(metricName: string, value: number): string {
  if (metricName === 'coverage') {
    if (value >= 80) return 'brightgreen';
    if (value >= 60) return 'yellow';
    return 'red';
  }
  if (metricName === 'duplication') {
    if (value <= 3) return 'brightgreen';
    if (value <= 10) return 'yellow';
    return 'red';
  }
  return 'blue';
}

export default badge;
