# EPK Studio — Private Administration Dashboard

This feature adds an invite-only **/admin** experience to the existing public EPK Client Onboarding app.

## Design and source of truth

- **Public onboarding:** The existing form remains at `/`, preserving the 43 approved fields and Netlify Forms submission handling.
- **Verified-submission ingestion:** Netlify's signed `formSubmitted` platform event automatically copies submitted form values to an isolated Netlify Database table. Submission idempotency uses `application_id` (a UUID generated in the browser); legacy submissions use a stable hash. Unverified or spam form submissions are not ingested.
- **Administration:** Only an authenticated Netlify Identity user with `app_metadata.roles` containing `admin` can call the `/admin` API. No service key or business data is embedded in the public client bundle.
- **Workflow:** Six tracked stages, internal notes, activity log, and confirmed final client approval required before `published` status.
- **Privacy:** Client answers are only returned from an authenticated function. The `/admin` shell itself is static and public, but contains no applicant data. The app does not store submissions in browser local storage.
- **Storage:** Netlify Database (Postgres), provisioned as part of the Netlify deploy if supported by the team's plan; deployed migration creates `epk_applications` and `epk_application_activity`.

## Required Netlify configuration before production

1. Confirm Forms > **Form detection** is enabled. The site currently returns **zero registered forms** despite the feature being enabled, so **redeploy** and verify `epk-client-intake` is shown in Forms. Do not publish the onboarding link to real clients until a consented form test passes.
2. Under **Identity**, select **Enable Identity**, then **Invite only** registration. Leave confirmation emails enabled and invite your intended administrator.
3. Under **Project configuration > Environment variables**, set `EPK_ADMIN_EMAIL` to the invited administrator's exact email address, with **Functions** scope. This variable is the bootstrap allowlist; only the matching account is assigned role `admin` during `userSignup`. No default email is embedded in the app. Set it **before inviting/accepting** the new account. Do **not** set test addresses you do not own.
4. Ensure Netlify Database is available for the site. Deploy uses `@netlify/database` with migration `netlify/database/migrations/20261116063000_epk_admin.sql`. If the team plan does not support Netlify Database, deployment must be held until a supported plan or alternative private database is selected. Netlify Database consumes usage credits.
5. After the deploy is successful, accept the Identity invitation (the root form forwards Identity invite hashes to `/admin/`), then visit `/admin`. Sign in. `New application` should show empty until a **verified** submission arrives.
6. Send an agreed dummy onboarding submission, verify it appears in Netlify Forms, then verify it appears in the `/admin` inbox. Change its stage, save a note, reload and check persistence. Confirm that published is blocked without explicit approval evidence. Test non-admin rejection and signed-out rejection.
7. Verify South African POPIA privacy wording, retention/deletion process, staff roles and backups **before accepting real client data**. Since data is mirrored into Netlify Database, deleting a Netlify Forms submission alone does **not** delete the dashboard copy; add coordinated erasure before real production use.

## Notes and limits

- Use a **new invitation** after setting `EPK_ADMIN_EMAIL`, so the bootstrap role runs. Accounts that existed before the signup event require an administrator role granted via a separate authorized provisioning procedure; the app intentionally does not have an unauthenticated role-grant endpoint.
- The event is issued for **verified** submissions only. There is no automatic backfill for previous submissions, and no deduplication of multiple distinct client submits (only repeat event deliveries are idempotent).
- Media remains in Netlify Forms; the event payload exposes string field values and may include media file URLs where available. The dashboard displays links but does not duplicate media binaries.
- Email and WhatsApp buttons open the administrator's mail/WhatsApp client. The app does **not** automatically message clients.
- User role changes require Identity token refresh / a new login.
- For multiple simultaneous administrators, add workflow optimistic locking and audit access policies. Current implementation serializes each row update within a database transaction and records changes in the activity table.
- The Netlify Database package and Netlify Identity are recent platform features; live sign-in and production DB provisioning **cannot be verified locally**. CI/build and hosted acceptance are required.
- Preview deployments and database previews may have a copy of real data. Never share preview URLs with unauthorized people.

## Tests

```sh
python3 scripts/build.py
npm install
npm run build:admin
npm run test:workflow
```

The onboarding questionnaire's existing `tests/e2e.py` remains part of the repo. Run it alongside the workflow tests.

## Release gate

- [ ] Netlify production Forms registration confirmed
- [ ] Netlify Database migrated successfully
- [ ] Identity invite-only, administrator role verified
- [ ] Non-admin and unauthenticated API requests denied
- [ ] Test form submission stored in Forms and EPK dashboard
- [ ] Stage and notes persist after reload
- [ ] Publication approval guard verified
- [ ] Privacy notice/retention and deletion workflow approved