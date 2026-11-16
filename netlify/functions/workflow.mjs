export const STAGES = Object.freeze([
  { id: 'new', label: 'New application' },
  { id: 'under_review', label: 'Under review' },
  { id: 'awaiting_content', label: 'Awaiting content' },
  { id: 'in_production', label: 'In production' },
  { id: 'client_approval', label: 'Client approval' },
  { id: 'published', label: 'Published' },
]);
export const STAGE_IDS = Object.freeze(STAGES.map(item => item.id));
const clean = value => typeof value === 'string' ? value.trim() : '';
export function validateUpdate(input, current) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Invalid request' };
  if (!STAGE_IDS.includes(input.stage)) return { error: 'Invalid production stage' };
  if (typeof input.notes !== 'string' || input.notes.length > 5000) return { error: 'Notes must contain no more than 5000 characters' };
  if (typeof input.approvalVerified !== 'boolean') return { error: 'Approval confirmation must be true or false' };
  const evidence = clean(input.approvalEvidence);
  if (evidence.length > 400) return { error: 'Approval evidence must contain no more than 400 characters' };
  if (input.approvalVerified && evidence.length < 10) return { error: 'Record where and when the client approved the final EPK (at least 10 characters)' };
  if (input.stage === 'published' && !input.approvalVerified) return { error: 'Client approval must be verified before publication' };
  if (current.stage === 'published' && !input.approvalVerified && input.stage === 'published') return { error: 'Revoke publication status before removing approval' };
  return { stage: input.stage, notes: clean(input.notes), approvalVerified: input.approvalVerified, approvalEvidence: evidence };
}
export function publicSummary(data = {}, submittedAt) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  return {
    profileType: clean(data.profile_type).slice(0,50) || 'unspecified',
    name: clean(data.public_name).slice(0,200) || 'Unnamed applicant',
    contact: clean(data.private_contact).slice(0,240),
    submittedAt,
  };
}
export function safeAnswerData(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const blocked = new Set(['bot-field','form-name','subject','email','g-recaptcha-response']);
  return Object.fromEntries(Object.entries(source).filter(([k,v]) => /^[a-z][a-z0-9_]{1,80}$/i.test(k) && !blocked.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')).map(([k,v])=>[k,String(v).slice(0,15000)]));
}
export function makeApplicationId(id) {
  return typeof id === 'string' && /^[a-z0-9_-]{8,128}$/i.test(id) ? id : null;
}