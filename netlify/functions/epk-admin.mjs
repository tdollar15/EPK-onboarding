import { getUser } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import { STAGES, validateUpdate, makeApplicationId } from '../../lib/workflow.mjs';

const responseHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
const json = (payload, status = 200) => Response.json(payload, { status, headers: responseHeaders });
const fail = (message, status) => json({ error: message }, status);

export default async function handler(request) {
  try {
    if (!['GET','POST'].includes(request.method)) return fail('Method not allowed', 405);
    const user = await getUser();
    if (!user) return fail('Sign in required', 401);
    if (!Array.isArray(user.roles) || !user.roles.includes('admin')) return fail('Administrator role required', 403);
    const url = new URL(request.url);
    const db = getDatabase();

    if (request.method === 'GET') {
      const action = url.searchParams.get('action') || 'list';
      if (action === 'list') {
        const rawPage = Number(url.searchParams.get('page') || 1);
        const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 1000 ? rawPage : 1;
        const stageParam = url.searchParams.get('stage') || 'all';
        const stage = STAGES.some(item => item.id === stageParam) ? stageParam : 'all';
        const search = (url.searchParams.get('q') || '').trim().slice(0,100);
        const pattern = `%${search}%`;
        const [rows, count, stageCounts] = await Promise.all([
          db.sql`
            SELECT id, submitted_at, profile_type, public_name, contact, stage, approval_verified, updated_at
            FROM epk_applications
            WHERE (${stage} = 'all' OR stage = ${stage})
              AND (${search} = '' OR public_name ILIKE ${pattern} OR contact ILIKE ${pattern})
            ORDER BY submitted_at DESC LIMIT 30 OFFSET ${(page - 1) * 30}
          `,
          db.sql`SELECT COUNT(*)::integer AS total FROM epk_applications WHERE (${stage}='all' OR stage=${stage}) AND (${search}='' OR public_name ILIKE ${pattern} OR contact ILIKE ${pattern})`,
          db.sql`SELECT stage, COUNT(*)::integer AS count FROM epk_applications GROUP BY stage`,
        ]);
        return json({ items: rows, total: count[0]?.total || 0, stages: STAGES, stageCounts, page, pageSize: 30 });
      }
      if (action === 'board') {
        const items = await db.sql`
          SELECT id, public_name, profile_type, submitted_at, stage
          FROM (
            SELECT id, public_name, profile_type, submitted_at, stage,
                   ROW_NUMBER() OVER (PARTITION BY stage ORDER BY submitted_at DESC) AS rank
            FROM epk_applications
          ) ordered WHERE rank <= 8
          ORDER BY stage, submitted_at DESC
        `;
        return json({ items });
      }
      if (action === 'detail') {
        const id = makeApplicationId(url.searchParams.get('id'));
        if (!id) return fail('Invalid application ID',400);
        const [matches, activity] = await Promise.all([
          db.sql`SELECT * FROM epk_applications WHERE id = ${id} LIMIT 1`,
          db.sql`SELECT action, actor, from_stage, to_stage, summary, created_at FROM epk_application_activity WHERE application_id = ${id} ORDER BY created_at DESC LIMIT 25`,
        ]);
        if (!matches.length) return fail('Application not found', 404);
        return json({ application: matches[0], activity });
      }
      return fail('Unknown action', 400);
    }

    // The session is stored in an HttpOnly cookie: require same-origin requests for mutations.
    const origin = request.headers.get('origin');
    if (!origin || origin !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return fail('Origin not allowed', 403);
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return fail('Expected JSON', 415);
    const raw = await request.text();
    if (raw.length > 9000) return fail('Request too large',413);
    const body = JSON.parse(raw);
    if (body.action !== 'update' || !makeApplicationId(body.id)) return fail('Invalid update request',400);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT stage, approval_verified, internal_notes, approval_evidence FROM epk_applications WHERE id=$1 FOR UPDATE', [body.id]);
      if (!found.rows.length) { await client.query('ROLLBACK'); return fail('Application not found',404); }
      const old = found.rows[0];
      const parsed = validateUpdate(body,old);
      if (parsed.error) { await client.query('ROLLBACK'); return fail(parsed.error,400); }
      await client.query(`UPDATE epk_applications SET stage=$2, internal_notes=$3, approval_verified=$4, approval_evidence=$5, updated_at=now(), updated_by=$6 WHERE id=$1`,
        [body.id,parsed.stage,parsed.notes,parsed.approvalVerified,parsed.approvalEvidence,user.id]);
      await client.query(`INSERT INTO epk_application_activity(application_id,actor,action,from_stage,to_stage,summary) VALUES($1,$2,$3,$4,$5,$6)`,
        [body.id,user.id,'update',old.stage,parsed.stage,`Stage ${old.stage} → ${parsed.stage}; notes ${parsed.notes !== old.internal_notes ? 'changed' : 'unchanged'}; approval ${parsed.approvalVerified ? 'verified' : 'not verified'}`]);
      await client.query('COMMIT');
      return json({ saved: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof SyntaxError) return fail('Invalid JSON',400);
    // Do not leak SQL errors, secrets, or client details.
    console.error('EPK admin request failed', error?.name || 'Error');
    return fail('Administrative service is temporarily unavailable',503);
  }
}