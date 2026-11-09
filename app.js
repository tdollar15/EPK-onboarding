(() => {
  'use strict';
  const schema = JSON.parse(document.getElementById('schemaData').textContent);
  const form = document.getElementById('epkForm');
  const STORAGE_KEY = 'pds-epk-draft-v1';
  const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;
  const FILE_NAMES = ['media_headshot', 'media_performance_photo', 'media_logo'];
  const byId = (id) => document.getElementById(id);
  const fieldsByName = new Map(schema.fields.map(f => [f.name, f]));
  let currentStep = 'profile';
  let furthestStep = 'profile';
  let autosaveEnabled = false;
  let saving = false;
  let toastTimeout = null;

  function profileType() {
    return form.querySelector('[name="profile_type"]:checked')?.value || '';
  }
  function stepApplies(step) {
    if (!step.conditional) return true;
    const type = profileType();
    return type === 'both' || type === step.conditional;
  }
  function activeSteps() {
    return schema.steps.filter(stepApplies);
  }
  function valueFor(name) {
    const field = fieldsByName.get(name);
    if (field?.kind === 'choice') return form.querySelector(`[name="${name}"]:checked`)?.value || '';
    return (form.elements.namedItem(name)?.value || '').trim();
  }
  function isFilled(name) {
    return valueFor(name).length > 0;
  }
  function currentStepIndex() {
    return Math.max(0, activeSteps().findIndex(s => s.id === currentStep));
  }
  function localDateString() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  function showToast(message, error = false) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
  }
  function setStep(stepId, scroll = true) {
    const visible = activeSteps();
    if (!visible.some(step => step.id === stepId)) stepId = 'profile';
    currentStep = stepId;
    schema.steps.forEach(step => {
      const panel = byId(`panel-${step.id}`);
      panel.hidden = step.id !== currentStep;
      // Hide and disable only questions belonging to an inapplicable client type.
      // The other completed panels remain enabled for the final submission.
      const inapplicable = !stepApplies(step);
      panel.querySelectorAll('input,select,textarea').forEach(el => {
        el.disabled = inapplicable;
      });
    });
    renderSteps();
    renderProgress();
    const idx = currentStepIndex();
    byId('prevBtn').disabled = idx === 0;
    byId('nextBtn').hidden = idx === visible.length - 1;
    byId('submitBtn').hidden = idx !== visible.length - 1;
    if (stepId === 'approval') renderReview();
    if (scroll) {
      window.scrollTo({top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      setTimeout(() => byId(`title-${stepId}`).focus?.({preventScroll: true}), 0);
    }
  }
  function renderSteps() {
    const steps = activeSteps();
    const active = steps.findIndex(s => s.id === currentStep);
    const furthest = Math.max(0, steps.findIndex(s => s.id === furthestStep));
    const desktop = byId('desktopSteps');
    const mobile = byId('mobileSteps');
    desktop.replaceChildren();
    mobile.replaceChildren();
    steps.forEach((step,i) => {
      const cls = i === active ? 'active' : (i < active ? 'done' : '');
      const number = document.createElement('span');
      number.className = 'step-number';
      number.textContent = i < active ? '✓' : String(i+1).padStart(2,'0');
      const desktopBtn = document.createElement('button');
      desktopBtn.type = 'button';
      desktopBtn.disabled = i > furthest;
      desktopBtn.append(number, document.createTextNode(step.short));
      desktopBtn.addEventListener('click', () => setStep(step.id));
      const li = document.createElement('li');
      li.className = cls;
      if (i === active) desktopBtn.setAttribute('aria-current', 'step');
      li.append(desktopBtn);
      desktop.append(li);
      const mobBtn = document.createElement('button');
      mobBtn.type = 'button';
      mobBtn.className = `step-pill ${cls}`;
      mobBtn.textContent = `${i+1}. ${step.short}`;
      mobBtn.disabled = i > furthest;
      mobBtn.addEventListener('click', () => setStep(step.id));
      if (i === active) mobBtn.setAttribute('aria-current', 'step');
      mobile.append(mobBtn);
    });
    const currentPill = mobile.querySelector('.active');
    currentPill?.scrollIntoView({block:'nearest', inline:'nearest'});
  }
  function renderProgress() {
    const steps = activeSteps();
    const idx = currentStepIndex();
    byId('stepCounter').textContent = `Step ${idx+1} of ${steps.length}`;
    byId('stepTitle').textContent = steps[idx]?.title || '';
    byId('progressFill').style.width = `${((idx+1)/steps.length)*100}%`;
    const relevantRequired = schema.fields.filter(f => f.required && steps.some(s => s.id === f.step));
    const answered = relevantRequired.filter(f => isFilled(f.name)).length + Number(byId('processing_consent').checked) + Number(byId('publication_approval_acknowledgement').checked);
    const total = relevantRequired.length + 2;
    const percent = Math.round(answered/total*100);
    byId('progressPercent').textContent = `${percent}%`;
    byId('progressRing').style.setProperty('--progress', `${percent*3.6}deg`);
  }
  function setFieldError(name, text) {
    const field = document.querySelector(`[data-field="${name}"]`);
    if (!field) return;
    field.classList.toggle('field--invalid', Boolean(text));
    const error = byId(`error-${name}`);
    if (error) error.textContent = text;
    field.querySelectorAll('input,textarea,select').forEach(el => el.setAttribute('aria-invalid', text ? 'true' : 'false'));
  }
  function validateField(field) {
    const val = valueFor(field.name);
    let error = '';
    if (field.required && !val) error = 'Please complete this field.';
    else if (val && field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) error = 'Enter a valid email address.';
    else if (val && field.kind === 'url' && !(field.allow_later && /^will provide later$/i.test(val))) {
      try {
        const url = new URL(val);
        if (!['http:', 'https:'].includes(url.protocol)) throw Error('Invalid protocol');
      } catch { error = "Enter a full web address (https://...) or 'Will provide later'."; }
    }
    setFieldError(field.name, error);
    return !error;
  }
  function validateFiles() {
    const err = byId('fileError');
    let total = 0;
    for (const name of FILE_NAMES) {
      const file = form.elements.namedItem(name)?.files?.[0];
      if (!file) continue;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
        err.textContent = 'Please upload JPG, PNG or WebP images only.';
        return false;
      }
      total += file.size;
    }
    if (total > MAX_UPLOAD_BYTES) {
      err.textContent = 'Selected images exceed the 7 MB combined limit. Please use your shared media folder for larger files.';
      return false;
    }
    err.textContent = '';
    return true;
  }
  function validateStep(stepId) {
    const fields = schema.fields.filter(f => f.step === stepId);
    let first = null;
    for (const field of fields) {
      if (!validateField(field) && !first) first = form.elements.namedItem(field.name);
    }
    if (stepId === 'media' && !validateFiles()) first ||= byId('media_headshot');
    if (stepId === 'approval') {
      const consentsOk = byId('processing_consent').checked && byId('publication_approval_acknowledgement').checked;
      byId('consentError').textContent = consentsOk ? '' : 'Please confirm both statements before sending your application.';
      if (!consentsOk) first ||= byId('processing_consent');
    }
    if (first) {
      if (first instanceof RadioNodeList) first = [...first].find(el => !el.disabled) || first[0];
      first?.focus?.({preventScroll:false});
      showToast('Please complete the highlighted questions to continue.', true);
      return false;
    }
    return true;
  }
  function goNext() {
    if (!validateStep(currentStep)) return;
    const steps = activeSteps();
    const idx = currentStepIndex();
    if (idx < steps.length - 1) {
      const nextId = steps[idx + 1].id;
      furthestStep = nextId;
      setStep(nextId);
    }
  }
  function renderReview() {
    const mappings = [
      ['public_name','Public / stage name'],['title_role','Title or role'],
      ['city_province_country','Location'],['mission_message','Your mission'],
      ['booking_process','Booking process'],['media_folder_link','Media folder'],
      ['public_contact_details','Approved public details'],['private_contact','Private project contact']
    ];
    const summary = byId('reviewSummary');
    summary.replaceChildren();
    mappings.forEach(([key,label]) => {
      const item = document.createElement('div');
      item.className = `summary-item ${['mission_message','public_contact_details'].includes(key)?'summary-item--full':''}`;
      const small = document.createElement('small'); small.textContent = label;
      const strong = document.createElement('strong');
      const value = valueFor(key);
      strong.textContent = value ? (value.length > 280 ? value.slice(0,280)+'…' : value) : 'Not provided';
      if (!value) strong.className = 'summary-empty';
      item.append(small,strong); summary.append(item);
    });
  }
  function saveDraft() {
    try {
      const data = {};
      schema.fields.forEach(f => { data[f.name] = valueFor(f.name); });
      data.processing_consent = byId('processing_consent').checked;
      data.publication_approval_acknowledgement = byId('publication_approval_acknowledgement').checked;
      const payload = {version: schema.version, savedAt: new Date().toISOString(), values: data};
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      autosaveEnabled = true;
      byId('saveStatus').textContent = 'Saved on this device';
      showToast('Draft saved on this device. Uploaded files must be selected again when you return.');
    } catch {
      showToast('Draft could not be saved on this device. Please check your browser storage settings.', true);
    }
  }
  function restoreDraft() {
    let raw;
    try {raw = localStorage.getItem(STORAGE_KEY);} catch {return;}
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft.version !== schema.version || !draft.values) return;
      schema.fields.forEach(field => {
        const val = draft.values[field.name];
        if (!val) return;
        if (field.kind === 'choice') {
          const radio = [...form.elements.namedItem(field.name)].find(el => el.value === val);
          if (radio) radio.checked = true;
        } else {
          const el = form.elements.namedItem(field.name);
          if (el) el.value = val;
        }
      });
      byId('processing_consent').checked = Boolean(draft.values.processing_consent);
      byId('publication_approval_acknowledgement').checked = Boolean(draft.values.publication_approval_acknowledgement);
      autosaveEnabled = true;
      byId('saveStatus').textContent = 'Draft restored from this device';
      showToast('Your saved draft has been restored from this device.');
    } catch { /* Invalid local data should not prevent onboarding. */ }
  }
  function clearDraft() {
    if (!window.confirm('Clear all answers and your locally saved draft from this device?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    autosaveEnabled = false;
    form.reset();
    byId('date_completed').value = localDateString();
    byId('saveStatus').textContent = 'Not saved on this device';
    document.querySelectorAll('.field--invalid').forEach(el => el.classList.remove('field--invalid'));
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    furthestStep = currentStep = 'profile';
    setStep('profile');
    showToast('Form and locally saved draft cleared.');
  }
  async function submitApplication(event) {
    event.preventDefault();
    if (saving) return;
    for (const step of activeSteps()) {
      if (!validateStep(step.id)) {
        setStep(step.id);
        return;
      }
    }
    const demo = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (demo) {
      showToast('Preview mode: form submission activates when this site is deployed with Netlify Forms enabled. Your answers have not been sent.', true);
      return;
    }
    // Netlify notification Reply-To: extract an email if the approved combined
    // private email/phone field contains one. Never expose this as a public contact.
    const replyMatch = valueFor('private_contact').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    byId('replyEmail').value = replyMatch ? replyMatch[0] : '';
    saving = true;
    const submit = byId('submitBtn');
    const original = submit.textContent;
    submit.textContent = 'Submitting…';
    submit.disabled = true;
    try {
      const response = await fetch('/', {method: 'POST', body: new FormData(form)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      window.location.assign('/thank-you');
    } catch {
      showToast('Submission did not complete. Check your connection and try again; your answers are still here.', true);
      submit.disabled = false;
      submit.textContent = original;
      saving = false;
    }
  }
  function initialise() {
    byId('date_completed').value = localDateString();
    restoreDraft();
    byId('nextBtn').addEventListener('click', goNext);
    byId('prevBtn').addEventListener('click', () => {
      const idx = currentStepIndex();
      if (idx > 0) setStep(activeSteps()[idx - 1].id);
    });
    byId('saveDraft').addEventListener('click', saveDraft);
    byId('resetDraft').addEventListener('click', clearDraft);
    form.addEventListener('submit', submitApplication);
    form.addEventListener('input', event => {
      if (event.target.name && fieldsByName.has(event.target.name)) {
        setFieldError(event.target.name, '');
      }
      if (event.target.name === 'profile_type') {
        furthestStep = 'profile';
        if (!stepApplies(schema.steps.find(s=>s.id===currentStep))) currentStep = 'profile';
        setStep(currentStep, false);
      }
      if (event.target.name === 'processing_consent' || event.target.name === 'publication_approval_acknowledgement') {
        byId('consentError').textContent = '';
      }
      renderProgress();
      if (currentStep === 'approval' && fieldsByName.has(event.target.name)) renderReview();
      if (autosaveEnabled && event.target.type !== 'file') {
        clearTimeout(window.__epkDraftSave);
        window.__epkDraftSave = setTimeout(() => {
          try {
            const data = {};
            schema.fields.forEach(f => {data[f.name] = valueFor(f.name)});
            data.processing_consent = byId('processing_consent').checked;
            data.publication_approval_acknowledgement = byId('publication_approval_acknowledgement').checked;
            localStorage.setItem(STORAGE_KEY,JSON.stringify({version:schema.version,savedAt:new Date().toISOString(),values:data}));
            byId('saveStatus').textContent='Saved on this device';
          } catch {}
        },400);
      }
    });
    FILE_NAMES.forEach(name => form.elements.namedItem(name).addEventListener('change', validateFiles));
    setStep('profile', false);
  }
  initialise();
})();