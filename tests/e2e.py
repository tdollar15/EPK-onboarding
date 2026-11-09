from playwright.sync_api import sync_playwright
from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
pr=root/'previews';pr.mkdir(exist_ok=True)
html=(root/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet"[^>]+>','',html)
html=re.sub(r'<script src="\./app\.js" defer></script>','',html)
css=(root/'styles.css').read_text().split('\n',1)[1]
js=(root/'app.js').read_text()

def open_page(browser,width,height,saved=None):
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    page.set_content(html,wait_until='domcontentloaded')
    page.evaluate('''(payload) => {
      const store = payload ? {'pds-epk-draft-v1':payload} : {};
      Object.defineProperty(window, 'localStorage', {configurable:true,value:{
        getItem: key => Object.hasOwn(store,key)?store[key]:null,
        setItem: (key,value) => {store[key]=String(value)},
        removeItem: key => {delete store[key]}
      }});
    }''',saved)
    page.add_style_tag(content=css)
    page.add_script_tag(content=js)
    return page

with sync_playwright() as p:
    chromium_path = Path('/usr/bin/chromium')
    launch_args = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
    if chromium_path.is_file():
        launch_args['executable_path'] = str(chromium_path)
    browser=p.chromium.launch(**launch_args)
    desktop=open_page(browser,1440,1000)
    desktop.screenshot(path=str(pr/'desktop-profile.png'),full_page=True)
    assert desktop.locator('#stepCounter').inner_text() == 'Step 1 of 5'
    desktop.locator('#nextBtn').click()
    assert desktop.locator('.field--invalid').count() >= 5
    desktop.locator('input[value="ministry"]').check()
    assert desktop.locator('#stepCounter').inner_text() == 'Step 1 of 6'
    for name,value in [('public_name','Pastor Nandi M.'),('title_role','Travelling Evangelist'),('city_province_country','Pretoria, Gauteng, South Africa'),('primary_contact_person','Nandi M.'),('private_contact','contact@example.org'),('one_sentence_intro','I preach the gospel across South Africa.')]:
        desktop.locator(f'[name="{name}"]').fill(value)
    desktop.locator('#nextBtn').click()
    assert desktop.locator('#panel-biography').is_visible()
    desktop.locator('[name="journey_beginning"]').fill('I began visiting churches across the country more than 10 years ago.')
    desktop.locator('[name="mission_message"]').fill('To share the gospel with people of every community.')
    desktop.locator('#nextBtn').click()
    assert desktop.locator('#panel-ministry').is_visible()
    desktop.locator('[name="ministry_focus_themes"]').fill('Evangelism and bible teaching.')
    desktop.locator('#nextBtn').click()
    assert desktop.locator('#panel-bookings').is_visible()
    desktop.locator('[name="booking_process"]').fill('Please send a WhatsApp introduction and date.')
    desktop.locator('#nextBtn').click()
    assert desktop.locator('#panel-media').is_visible()
    desktop.locator('[name="media_folder_link"]').fill('Will provide later')
    desktop.locator('[name="media_headshot"]').set_input_files({'name':'oversized.png','mimeType':'image/png','buffer':b'0'*(7*1024*1024+10)})
    assert 'exceed the 7 MB' in desktop.locator('#fileError').inner_text()
    desktop.locator('#nextBtn').click()
    assert desktop.locator('#panel-media').is_visible()
    desktop.locator('[name="media_headshot"]').set_input_files([])
    desktop.locator('#nextBtn').click()
    assert desktop.locator('#panel-approval').is_visible()
    desktop.locator('[name="public_contact_details"]').fill('None until separately approved')
    desktop.locator('[name="media_rights_confirmation"]').select_option('pending')
    desktop.locator('[name="final_review_restrictions"]').fill('Contact me to approve all final materials.')
    desktop.locator('[name="completed_by"]').fill('Nandi M.')
    assert 'None until separately approved' in desktop.locator('#reviewSummary').inner_text()
    desktop.locator('#processing_consent').check()
    desktop.locator('#publication_approval_acknowledgement').check()
    desktop.screenshot(path=str(pr/'desktop-review.png'),full_page=True)
    desktop.locator('#submitBtn').click()
    assert 'Submission did not complete' in desktop.locator('#toast').inner_text() or 'Preview mode' in desktop.locator('#toast').inner_text()
    desktop.locator('#saveDraft').click()
    assert 'Saved on this device' in desktop.locator('#saveStatus').inner_text()
    draft=desktop.evaluate("localStorage.getItem('pds-epk-draft-v1')")
    assert draft is not None
    restored=open_page(browser,1100,800,draft)
    assert restored.locator('[name="public_name"]').input_value()=='Pastor Nandi M.'
    print('PASS: ministry flow, required validation, review, local preview protection, draft saving and restoration')
    mobile=open_page(browser,390,844)
    mobile.locator('input[value="artist"]').check()
    assert mobile.locator('#stepCounter').inner_text() == 'Step 1 of 6'
    mobile.screenshot(path=str(pr/'mobile-profile.png'),full_page=True)
    visible_steps=[s.inner_text() for s in mobile.locator('#mobileSteps button').all()]
    assert any('Music' in t for t in visible_steps)
    assert not any('Ministry' in t for t in visible_steps)
    overflow=mobile.evaluate('document.documentElement.scrollWidth - window.innerWidth')
    assert overflow<=1, f'mobile overflow: {overflow}'
    mobile.locator('[name="public_name"]').fill('Artist Example')
    mobile.screenshot(path=str(pr/'mobile-filled.png'),full_page=True)
    both=open_page(browser,375,812)
    both.locator('input[value="both"]').check()
    assert both.locator('#stepCounter').inner_text() == 'Step 1 of 7'
    print('PASS: artist/ministry/both branching, responsive mobile 390px/375px and no horizontal overflow')
    browser.close()