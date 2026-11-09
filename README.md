# EPK Studio — Client Onboarding

**Pricemakers Digital Solutions**  
Mobile-first intake application for travelling ministers, pastors, evangelists, music artists, DJs, bands, choirs and worship leaders.

## What is included

- Every one of the **43 approved questionnaire fields** from the EPK Client Intake Form.
- Conditional questions: **ministry**, **music**, or **both**. Other sections stay the same.
- Guided steps with inline validation, accessible labels, and a review screen.
- Optional small image uploads (headshot, action photo, logo). Combined file limit 7 MiB; larger media belongs in a shared folder.
- **Save draft on this device**. Saving is explicitly triggered by the applicant; after that, changes autosave locally. Uploaded files are not retained in the draft.
- A publication approval and media-rights acknowledgement workflow.
- A native-feeling mobile interface with fixed bottom navigation.
- Real form submission using **Netlify Forms** (no custom backend needed for MVP), honeypot, and a thank-you page.

## Quick preview

From the GitHub checkout, generate the static site and serve the output folder locally:

```sh
python3 scripts/build.py
cd dist
python3 -m http.server 8000
```

Open `http://localhost:8000`. In local preview mode you can test the flow, but **the Submit button intentionally does not send customer details**. A separate self-contained HTML preview may also be obtained from the original handoff package.

## Deploy as a live Netlify Form

1. In Netlify, create a **new site/project** for EPK Studio, or connect a new GitHub repository containing these files.
2. Connect the **`main` branch**. Netlify reads `netlify.toml` automatically and runs `python3 scripts/build.py` with the publish directory **`dist`**. No npm install or environment variables are required.
3. Under **Forms**, enable **Form detection**. This must be enabled before the deployment that registers the form. If you enable it afterward, trigger a new deploy.
4. Deploy the static files. Check that a form named **`epk-client-intake`** appears under the site's Forms section.
5. Send a consented test submission, including a small test image. Verify it appears under **Verified submissions**. If missing, check **Spam submissions**.
6. Under **Forms → Submission notifications**, configure notifications to an active member of your Netlify team. Never hardcode an unverified email address in the project.
7. Review the privacy notice and client-consent wording, set appropriate access permissions and a data-retention/deletion policy, then share the public URL.

**Important:** Do not consider the onboarding ready for real client data until the deployed submission test and privacy/security checks pass. Netlify Forms is the initial **admin submission inbox**. This version does not include a custom staff dashboard, customer logins, or server-synced drafts.

## Intake content and editing

The source of truth for all questions is `schema.json`. You may revise copy or add fields there; then regenerate the static HTML and deploy folder with:

```sh
python3 scripts/build.py
```

Only `dist/` is published on Netlify; the generated content includes the static HTML fields that Netlify scans. Do **not** hand-write an entirely JavaScript-rendered form without preserving a deployed static form skeleton: Netlify detects fields by parsing the built HTML at deploy time.

### Branching

- `ministry` → profile, biography, ministry, bookings, media, approval
- `artist` → profile, biography, music, bookings, media, approval
- `both` → all seven steps

A required media folder URL can be answered with **“Will provide later”**. This preserves the approved field without forcing a client to provide media before an initial discussion.

## Security, privacy and compliance

The applicant explicitly authorizes use of their details to produce the EPK. Public-display approval is separate from private project contacts and fees. No information is published automatically; the EPK draft is subject to human approval.

Data-handling requirements before live use:

- Limit access to Netlify Forms submissions to authorized EPK staff; enable multifactor authentication.
- Establish and publish a privacy notice covering collection purpose, responsible party, storage location, retention, access/correction/deletion and how to make a request. Review against South Africa's **POPIA** requirements with appropriate advice.
- The local draft uses ordinary browser storage on the applicant's device. It is **not encrypted or synchronized**; applicants should not use shared devices for sensitive submissions.
- Avoid identity documents, home addresses, banking information, private financial records or passwords. Client-supplied publicity images only, not sensitive documents.
- Inspect linked/shared assets and check usage rights. “Pending permission” means **do not publish** those assets until cleared.
- The form frontend is not a substitute for server-side audit/verification or an editorial approval process.
- Netlify Form limits documented at time of development include 8MB per submission request and one file per field. This app uses a 7MiB client-side cap, but server/provider limits still apply.

## QA

- Browser-level UI checks were executed for ministry, artist and both profile branches, required field validation, navigation, review, preview submission guard, local draft restoration, and mobile overflow. The Netlify `dist/` build is independently verified against the source and checked for static form registration fields.
- `tests/e2e.py` uses Python Playwright and Chromium to run these checks without requiring external web navigation, injecting the built HTML and assets into a test page.
- **Not yet verified:** an actual deployed Netlify submission, provider spam-filter handling, Netlify dashboard display, email notifications, or files uploaded in a deployed environment. These are post-deployment acceptance checkpoints.

## Deployment settings

| Setting | Value |
|---|---|
| Production branch | `main` |
| Base directory | Repository root |
| Build command | `python3 scripts/build.py` |
| Publish directory | `dist` |
| Runtime | Static site; Netlify Forms at the root URL |
| Redirects | `/thank-you` resolves to the static `thank-you.html` |

Do not configure a second build command manually: `netlify.toml` is the source of truth. If Netlify Forms registration is missing, enable form detection and redeploy so Netlify scans the newly built `dist/index.html`.

## Release checklist

- [ ] Decide on site URL, domain and brand copy.
- [ ] Enable Forms detection and deploy.
- [ ] Send a real test submission with agreed dummy data.
- [ ] Verify all field values arrive and only the applicable conditional branch is included.
- [ ] Verify an image upload and media-folder link.
- [ ] Verify notification recipients and admin-only access.
- [ ] Approve privacy notice, data-handling policy and EPK editorial workflow.
- [ ] Obtain stakeholder sign-off before sending the client intake link.