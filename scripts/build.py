#!/usr/bin/env python3
"""Build a Netlify-detectable, static EPK form from the approved question schema."""
from __future__ import annotations
import html, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
schema = json.loads((ROOT / 'schema.json').read_text(encoding='utf-8'))
E = lambda t: html.escape(str(t), quote=True)


def render_field(field):
    key, kind = field['name'], field['kind']
    required = '<span class="required" title="Required">*</span>' if field.get('required') else ''
    hint = f'<p class="hint" id="hint-{E(key)}">{E(field["hint"])}</p>' if field.get('hint') else ''
    helpid = f' aria-describedby="hint-{E(key)}"' if field.get('hint') else ''
    if kind == 'choice':
        options = ''.join(f'''<label class="persona-card"><input type="radio" name="{E(key)}" value="{E(value)}" data-required="true"><span class="persona-icon" aria-hidden="true">{icon}</span><span class="persona-text"><strong>{E(label)}</strong><small>{E(desc)}</small></span><span class="persona-check" aria-hidden="true">✓</span></label>'''
            for (value,label,desc),icon in zip(field['options'], ['✦','♫','✧']))
        return f'''<div class="field field--full persona-field" data-field="{E(key)}"><div class="field-label" id="label-{E(key)}">{E(field['label'])} {required}</div><div class="persona-options" role="radiogroup" aria-labelledby="label-{E(key)}">{options}</div><p class="field-error" id="error-{E(key)}" aria-live="polite"></p></div>'''
    common = f'name="{E(key)}" id="{E(key)}" data-required="{str(bool(field.get("required"))).lower()}"{helpid}'
    if kind == 'textarea':
        control=f'<textarea {common} rows="{field.get("rows",4)}" placeholder="{E(field.get("placeholder", ""))}"></textarea>'
    elif kind == 'select':
        opts=''.join(f'<option value="{E(val)}">{E(label)}</option>' for val,label in field['options'])
        control=f'<div class="select-wrap"><select {common}>{opts}</select><span aria-hidden="true">⌄</span></div>'
    else:
        typ=kind if kind in ('email','tel','url','date') else 'text'
        placeholder=f' placeholder="{E(field.get("placeholder", ""))}"' if field.get('placeholder') else ''
        control=f'<input type="{typ}" {common}{placeholder} autocomplete="off" />'
    private_tag='<span class="private-pill">Private</span>' if field.get('private') else ''
    full=' field--full' if field.get('full',False) else ''
    return f'''<div class="field{full}" data-field="{E(key)}"><label for="{E(key)}">{E(field['label'])} {required} {private_tag}</label>{control}{hint}<p class="field-error" id="error-{E(key)}" aria-live="polite"></p></div>'''


def render_step(step):
    fields = [f for f in schema['fields'] if f['step']==step['id']]
    controls = '\n'.join(render_field(f) for f in fields)
    conditional = f' data-conditional="{E(step["conditional"])}"' if step.get('conditional') else ''
    special_top = ''
    if step['id']=='biography':
        special_top='<div class="tip-card"><span class="tip-icon" aria-hidden="true">✍</span><p><strong>You tell the story. We write the biography.</strong><br>Use your own words, even short notes. We will create both short and full versions for you to review.</p></div>'
    if step['id']=='bookings':
        special_top='<div class="tip-card tip-card--private"><span class="tip-icon" aria-hidden="true">♢</span><p><strong>Private information stays private.</strong><br>Your coordination contact and commercial arrangements are not automatically displayed on your EPK.</p></div>'
    if step['id']=='media':
        special_top='<div class="tip-card"><span class="tip-icon" aria-hidden="true">↗</span><p><strong>Large videos and high-resolution photos?</strong><br>Share a cloud folder link instead of uploading large files here. Small optional files may be attached below.</p></div>'
    if step['id']=='approval':
        special_top='<div class="tip-card tip-card--private"><span class="tip-icon" aria-hidden="true">✓</span><p><strong>Nothing goes public without your approval.</strong><br>We will send a draft for review before releasing the final EPK.</p></div>'
    special_bottom=''
    if step['id']=='media':
        special_bottom='''<div class="upload-card"><div class="upload-intro"><span class="upload-icon" aria-hidden="true">⇧</span><div><h3>Optional quick uploads</h3><p>Images only. For larger batches, use the shared-folder link above. Files are not included in saved drafts.</p></div></div><div class="upload-grid"><label class="upload-item" for="media_headshot"><span>Portrait / headshot</span><input name="media_headshot" id="media_headshot" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG or WebP</small></label><label class="upload-item" for="media_performance_photo"><span>Action / event photo</span><input name="media_performance_photo" id="media_performance_photo" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG or WebP</small></label><label class="upload-item" for="media_logo"><span>Logo (if available)</span><input name="media_logo" id="media_logo" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG or WebP</small></label></div><p class="upload-limit">Combined upload limit: 7 MB. No IDs, bank records or other sensitive documents.</p><p id="fileError" class="field-error" role="alert"></p></div>'''
    if step['id']=='approval':
        special_bottom='''<div class="review-card"><div class="review-heading"><h3>Your application at a glance</h3><p>Review the details before submitting.</p></div><div id="reviewSummary" class="review-summary"></div></div><div class="permission-card"><label class="permission-row"><input type="checkbox" name="processing_consent" id="processing_consent" value="yes"/><span>I consent to the collection and use of my information to prepare this EPK and communicate about the project. <b>*</b></span></label><label class="permission-row"><input type="checkbox" name="publication_approval_acknowledgement" id="publication_approval_acknowledgement" value="yes"/><span>I understand that the draft EPK must be approved by me or my authorized representative before publication. <b>*</b></span></label><p class="field-error" id="consentError" role="alert"></p></div>'''
    return f'''<section class="wizard-panel" id="panel-{E(step['id'])}" data-step="{E(step['id'])}"{conditional} aria-labelledby="title-{E(step['id'])}" hidden><div class="panel-topline"><span class="kicker">{E(step['eyebrow'])}</span><span class="time-chip">◷ {E(step['time'])}</span></div><h2 id="title-{E(step['id'])}">{E(step['title'])}</h2><p class="panel-desc">{E(step['description'])}</p>{special_top}<div class="field-grid">{controls}</div>{special_bottom}</section>'''

steps_html='\n'.join(render_step(s) for s in schema['steps'])
content=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#112a2a" />
<meta name="description" content="Create your professional EPK. A guided onboarding questionnaire for travelling ministers, ministries, music artists and worship teams." />
<title>EPK Client Onboarding · Pricemakers Digital Solutions</title>
<link rel="icon" href="./favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="./styles.css" />
</head>
<body>
<div class="app-shell">
  <aside class="sidebar" aria-label="Onboarding information">
    <div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><div><strong>EPK<span>STUDIO</span></strong><small>by Pricemakers Digital Solutions</small></div></div>
    <div class="side-body"><div class="side-eyebrow"><span class="small-dot"></span> CLIENT ONBOARDING</div><h1>Your story.<br><em>Your impact.</em><br>One great EPK.</h1><p>For travelling ministers, worship leaders and music artists who want to be discovered, invited and booked.</p><div class="side-rule"></div><div class="side-steps"><div class="side-steps-title">YOUR JOURNEY</div><ol id="desktopSteps" class="step-list"></ol></div></div>
    <div class="side-bottom"><div class="side-quote">“Your story deserves to be told with clarity and purpose.”</div><span>Process meets intelligence.</span></div>
  </aside>
  <main class="main-area">
    <header class="mobile-brand"><span class="brand-mark" aria-hidden="true">✦</span><strong>EPK<span>STUDIO</span></strong><span class="mobile-brand-caption">CLIENT ONBOARDING</span></header>
    <div class="top-controls"><div class="breadcrumbs">EPK Studio <span>/</span> Client onboarding</div><div class="draft-tools"><span class="save-status" id="saveStatus" aria-live="polite">Not saved on this device</span><button class="text-button" type="button" id="saveDraft">Save draft</button><button class="icon-button" id="resetDraft" type="button" aria-label="Clear saved draft" title="Clear saved draft">↺</button></div></div>
    <div class="content-wrap"><div class="intro-row"><div><span class="mini-eyebrow">APPLICATION FORM</span><h1 class="main-title">Let's create something<br> <em>worth sharing.</em></h1><p>Answer a few guided questions. We'll turn your story, achievements and media into a professional EPK.</p></div><div class="completion-card"><div class="ring" id="progressRing"><span id="progressPercent">0%</span></div><span>Complete</span></div></div>
    <div class="mobile-progress"><div><span id="stepCounter">Step 1 of 6</span><span id="stepTitle">Your profile</span></div><div class="progress-track"><div id="progressFill" class="progress-fill"></div></div></div>
    <div class="step-pills" id="mobileSteps" aria-label="Form sections"></div>
    <form id="epkForm" name="epk-client-intake" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/thank-you" enctype="multipart/form-data" novalidate>
      <input type="hidden" name="form-name" value="epk-client-intake" />
      <input type="hidden" name="subject" value="New EPK onboarding · %{{submissionId}}" />
      <input type="hidden" name="email" id="replyEmail" value="" />
      <p class="honeypot" aria-hidden="true"><label>Leave this field empty <input name="bot-field" tabindex="-1" autocomplete="off" /></label></p>
      {steps_html}
      <div class="form-footer"><div class="footer-guidance"><span class="lock-icon" aria-hidden="true">♢</span><span>Only details you explicitly approve will appear on your public EPK.</span></div><div class="footer-buttons"><button id="prevBtn" type="button" class="btn btn--secondary">← Back</button><button id="nextBtn" type="button" class="btn btn--primary">Continue <span aria-hidden="true">→</span></button><button id="submitBtn" type="submit" class="btn btn--primary" hidden>Submit application <span aria-hidden="true">→</span></button></div></div>
    </form>
    <p class="below-footer">Have questions? Contact the EPK project team through your usual communication channel. <span>Do not submit identity numbers, personal addresses or banking information.</span></p>
    </div>
  </main>
</div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="schemaData">{json.dumps(schema,ensure_ascii=False).replace('</','<\\/')}</script>
<script src="./app.js" defer></script>
</body>
</html>
'''
# Keep a generated source copy for inspection and local UI tests, but publish only
# the generated site. This prevents shipping schema, tests, readme, and previews.
(ROOT / 'index.html').write_text(content, encoding='utf-8')
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
(DIST / 'index.html').write_text(content, encoding='utf-8')
for asset in ('app.js', 'styles.css', 'favicon.svg', 'thank-you.html'):
    shutil.copyfile(ROOT / asset, DIST / asset)
print(f"Built {DIST/'index.html'} with {len(schema['fields'])} approved fields")