import { getDatabase } from '@netlify/database';
import { createHash } from 'node:crypto';
import { makeApplicationId, publicSummary, safeAnswerData } from './workflow.mjs';

// Netlify invokes this verified, signed platform event internally; this is not a public HTTP handler.
export default {
  async formSubmitted(event) {
    const raw = event?.data || {};
    if (raw['form-name'] && raw['form-name'] !== 'epk-client-intake') return;
    if (!raw.public_name || !raw.processing_consent) return;
    const answers = safeAnswerData(raw);
    // Submission ID is supplied by the browser and retained across Netlify event retries.
    // Fallback handles legacy submissions that predate this field.
    const id = makeApplicationId(answers.application_id) || 'legacy-' + createHash('sha256').update(JSON.stringify(answers)).digest('hex').slice(0,32);
    const summary = publicSummary(answers, new Date().toISOString());
    const db = getDatabase();
    await db.sql`
      INSERT INTO epk_applications (id, profile_type, public_name, contact, answers)
      VALUES (${id}, ${summary.profileType}, ${summary.name}, ${summary.contact}, ${JSON.stringify(answers)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
    // No private submission fields are logged.
  }
};