"""Isolated product UI tests. Real Chrome PiP and fake microphone; no personal data changes."""
import asyncio
import json
from playwright.async_api import async_playwright

FIXTURES = '''
window.voiceInstances = []; window.capturedTracks = []; window.clickTones = 0;
window.SpeechRecognition = class {
  constructor() { window.voiceInstances.push(this); }
  start(track) { this.track = track; this.active = true; this.onstart?.(); }
  abort() { this.active = false; this.onend?.(); }
  finish(text) { const result = [{transcript:text}]; result.isFinal = true;
    this.onresult?.({results:[result]}); this.active = false; this.onend?.(); }
};
const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = async (...args) => {
 const stream = await capture(...args); window.capturedTracks.push(...stream.getTracks()); return stream;
};
const oscillator = AudioContext.prototype.createOscillator;
AudioContext.prototype.createOscillator = function(...args) { window.clickTones++; return oscillator.apply(this, args); };
'''
ACTIVE = 'window.voiceInstances.some(r => r.active)'


async def main():
 async with async_playwright() as p:
  browser = await p.chromium.launch(headless=True, args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--mute-audio'])
  context = await browser.new_context(viewport=None, color_scheme='dark')
  page = await context.new_page()
  await page.set_viewport_size({'width':1440,'height':960})
  await page.add_init_script(FIXTURES)
  errors, mutations, commands = [], [], []
  reject_delete = [True]
  history = [{'id':f'h{i}', 'command':command, 'reply':'Synthetic result.', 'success':True,
              'created':'2026-10-03T12:00:00Z','session_id':'fixture'}
             for i, command in enumerate(['Open Notes', 'Find my document', 'Explain gravity'])]
  async def routes(route):
   path = route.request.url.split('/api')[-1]
   method = route.request.method
   if path == '/status':
    return await route.fulfill(json={'token':'fixture', 'ai':{'ready':True, 'models':['fixture']},
      'profile':{'name':'Test User','tutorial_completed':True},'settings':{'model':'fixture','speech_rate':175,'setup_completed':True,'automation_enabled':False,'auto_tutor':False,'expressive_voice':True}})
   if path == '/history' and method == 'GET': return await route.fulfill(json=history)
   if path == '/history/delete':
    if reject_delete:
     reject_delete.pop()
     return await route.fulfill(status=503, json={'detail':'Temporary deletion failure. Try again.'})
    ids = route.request.post_data_json['ids']; mutations.append(ids)
    count = len(history); history[:] = [h for h in history if h['id'] not in ids]
    return await route.fulfill(json={'deleted':count-len(history)})
   if path == '/history' and method == 'DELETE':
    mutations.append('all'); count=len(history); history.clear()
    return await route.fulfill(json={'deleted':count})
   if path in ['/documents','/routines','/memories','/contacts']: return await route.fulfill(json=[])
   if path == '/permissions': return await route.fulfill(json={'accessibility':True})
   if path in ['/speech/stop','/stop']: return await route.fulfill(json={'stopped':True})
   if path == '/speech/audio': return await route.fulfill(status=204)
   if path == '/command/stream':
    commands.append(route.request.post_data_json['command'])
    event={'type':'done','reply':'Fixture received.','spoken_reply':'Fixture received.','success':True}
    return await route.fulfill(content_type='text/event-stream',body='data: '+json.dumps(event)+'\n\n')
   if path == '/settings': return await route.fulfill(json=route.request.post_data_json)
   errors.append('Unexpected API request '+method+' '+path)
   return await route.fulfill(status=404, json={'detail':'Unknown fixture route'})
  await context.route('**/api/**',routes)
  context.on('page',lambda tab:tab.on('pageerror',lambda e:errors.append(str(e))))
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def open_nav():
   menu=page.get_by_role('button',name='Open navigation menu',exact=True)
   trigger=page.get_by_role('button',name='Show navigation',exact=True)
   if await menu.is_visible(): await menu.click()
   elif await trigger.is_visible():
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
  async def navigate(label):
   await open_nav()
   await page.get_by_role('navigation',name='Main navigation').get_by_role('button',name=label,exact=True).click()
  async def no_overflow():
   assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Document overflow'
   assert await page.locator('.primary-content').evaluate('(el)=>el.scrollWidth <= el.clientWidth+1'), 'Content overflow'
  await page.goto('http://127.0.0.1:8000')
  await page.get_by_role('heading',name='Less clicking. More living.').wait_for()
  nav=await page.get_by_role('navigation',name='Main navigation').bounding_box()
  assert nav['width'] == 1440
  await page.screenshot(path='/tmp/apple-home-dark.png')
  await open_nav()
  await page.get_by_role('button',name='Switch to light theme').click()
  assert await page.locator('html').get_attribute('data-theme') == 'light'
  await page.wait_for_timeout(300)
  await page.screenshot(path='/tmp/apple-home-light.png')
  await page.reload()
  await page.get_by_role('heading',name='Less clicking. More living.').wait_for()
  assert await page.locator('html').get_attribute('data-theme') == 'light'
  await navigate('Settings & connections')
  await page.get_by_role('switch',name='Interface sounds',exact=True).click()
  assert await page.evaluate("localStorage.getItem('apple-ui-sounds')") == 'true'
  # Every color is distinct in both modes; color and appearance persist independently.
  for appearance in ['Dark','Light']:
   await page.get_by_role('button',name=appearance,exact=True).click()
   accents=[]
   for palette in ['Blue','Graphite','Violet','Rose','Amber','Mint']:
    button=page.get_by_role('button',name=f'{palette} color theme',exact=True)
    await button.click()
    assert await button.get_attribute('aria-pressed')=='true'
    assert await page.locator('html').get_attribute('data-palette')==palette.lower()
    accents.append(await page.locator('html').evaluate('(el)=>getComputedStyle(el).getPropertyValue("--accent").trim()'))
   assert len(set(accents))==6, accents
  await page.get_by_role('button',name='Violet color theme',exact=True).click()
  await page.reload()
  await page.get_by_role('button',name='Violet color theme',exact=True).wait_for()
  assert await page.locator('html').get_attribute('data-palette')=='violet'
  assert await page.locator('html').get_attribute('data-theme')=='light'
  await navigate('FAQs')
  await page.locator('summary').filter(has_text='How does the floating companion work?').click()
  assert await page.locator('details[open]').count() == 1
  assert await page.evaluate('window.clickTones') > 0, 'No interface audio feedback'
  tones = await page.evaluate('window.clickTones')
  await page.mouse.move(600,650)
  await page.mouse.wheel(0,400)
  await page.wait_for_timeout(350)
  assert await page.evaluate('window.clickTones') == tones, 'Scrolling must always be silent'
  # Master mute covers click sounds and survives reload, without altering sound preferences.
  await open_nav()
  tones=await page.evaluate('window.clickTones')
  await page.get_by_role('button',name='Mute all sounds',exact=True).click()
  assert await page.get_by_role('button',name='Unmute all sounds',exact=True).get_attribute('aria-pressed')=='true'
  await page.locator('summary').first.click()
  assert await page.evaluate('window.clickTones')==tones, 'Mute click or later controls produced sound'
  assert await page.evaluate("localStorage.getItem('apple-ui-sounds')")=='true'
  await page.reload()
  await page.locator('summary').first.click()
  assert await page.evaluate('window.clickTones')==0, 'Mute did not survive reload'
  await navigate('Settings & connections')
  assert await page.get_by_role('button',name='Try the voice',exact=True).is_disabled()
  assert await page.get_by_role('switch',name='App sound',exact=True).get_attribute('aria-checked')=='false'
  await open_nav()
  await page.get_by_role('button',name='Unmute all sounds',exact=True).click()
  assert await page.get_by_role('button',name='Try the voice',exact=True).is_enabled()
  await navigate('FAQs')
  await page.locator('summary').first.click()
  assert await page.evaluate('window.clickTones')>0, 'Unmute failed to restore click sounds'
  await navigate('Contact & support')
  assert await page.locator('.contact-links a').first.get_attribute('href') == 'mailto:abhishek.tiwarii9821@gmail.com?subject=APPLE%20support'
  assert await page.locator('.contact-links a').last.get_attribute('href') == 'https://www.linkedin.com/in/abhishek-tiwari-3a3594300/'
  await page.get_by_role('heading',name='Abhishek Tiwari',exact=True).wait_for()
  await page.screenshot(path='/tmp/apple-contact.png')
  await navigate('Privacy policy')
  assert await page.locator('.policy-section').count() == 7
  await page.go_back()
  await page.get_by_role('heading',name='Abhishek Tiwari',exact=True).wait_for()
  await navigate('Activity')
  await page.get_by_role('textbox',name='Search history').fill('document')
  assert await page.locator('.activity-record').count() == 1
  await page.get_by_role('checkbox',name='Select Find my document',exact=True).check()
  await page.get_by_role('button',name='Delete selected (1)',exact=True).click()
  await page.get_by_role('button',name='Keep history',exact=True).click()
  assert not mutations
  await page.get_by_role('textbox',name='Search history').fill('')
  await page.get_by_role('checkbox',name='Select Open Notes',exact=True).check()
  await page.get_by_role('button',name='Delete selected (2)',exact=True).click()
  await page.get_by_role('button',name='Delete permanently',exact=True).click()
  await page.get_by_role('alert').filter(has_text='Temporary deletion failure. Try again.').wait_for()
  assert len(history) == 3 and not mutations
  await page.get_by_role('button',name='Delete permanently',exact=True).click()
  await page.get_by_role('checkbox',name='Select Open Notes',exact=True).wait_for(state='hidden')
  assert set(mutations[0]) == {'h0','h1'}
  await page.get_by_role('button',name='Delete Explain gravity',exact=True).click()
  await page.get_by_role('button',name='Keep history',exact=True).click()
  await page.get_by_role('button',name='Clear all history',exact=True).click()
  await page.get_by_role('button',name='Delete permanently',exact=True).click()
  await page.get_by_role('heading',name='A fresh start',exact=True).wait_for()
  assert mutations[-1] == 'all' and not history
  await navigate('Settings & connections')
  assert await page.get_by_role('switch',name='Conversational expression').get_attribute('aria-checked') == 'true'
  await page.get_by_role('switch',name='Conversational expression').click()
  await page.get_by_role('button',name='Save settings',exact=True).click()
  await page.get_by_text('Your settings are saved.',exact=True).wait_for()
  await page.get_by_role('button',name='Dark',exact=True).click()
  await navigate('Assistant')
  # Exercise an actual Document Picture-in-Picture window, not a DOM overlay.
  await open_nav()
  async with context.expect_page() as event:
   await page.get_by_role('button',name='Float assistant',exact=True).click()
  pip=await event.value
  await pip.get_by_role('button',name='Start voice session',exact=True).wait_for()
  assert await pip.title() == 'APPLE companion'
  # Headless Chromium does not apply native PiP window dimensions.
  await pip.set_viewport_size({'width':300,'height':390})
  await pip.wait_for_function("getComputedStyle(document.querySelector('.floating-assistant')).display === 'flex'", polling=100)
  assert await pip.locator('.vc-core').evaluate('(el)=>el.getBoundingClientRect().width') < 180
  assert await pip.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Companion overflow'
  assert await pip.locator('html').get_attribute('data-theme') == 'dark'
  assert await pip.locator('html').get_attribute('data-palette') == 'violet'
  await pip.get_by_role('textbox',name='Message floating assistant').fill('A synthetic question')
  await pip.get_by_role('button',name='Send floating request').click()
  await page.get_by_text('Fixture received.',exact=True).wait_for()
  assert commands == ['A synthetic question']
  await pip.get_by_role('button',name='Start voice session',exact=True).click()
  await page.wait_for_function(ACTIVE)
  await pip.get_by_text('I’m listening.',exact=True).wait_for()
  tones=await page.evaluate('window.clickTones')
  await open_nav()
  await page.get_by_role('button',name='Switch to light theme').click()
  assert await pip.locator('html').get_attribute('data-theme') == 'light'
  assert await page.evaluate('window.clickTones') == tones, 'UI sound interfered with voice session'
  await pip.wait_for_timeout(300)
  await pip.screenshot(path='/tmp/apple-companion-light.png')
  await page.evaluate("window.voiceInstances.find(r=>r.active).finish('Another synthetic question')")
  await page.wait_for_function('window.voiceInstances.some(r=>r.active)')
  await page.wait_for_timeout(1500)
  assert commands[-1] == 'Another synthetic question', commands
  await pip.get_by_role('button',name='Return to APPLE').click()
  if not pip.is_closed(): await pip.wait_for_event('close')
  assert await page.evaluate(ACTIVE), 'Returning to APPLE ended session'
  await open_nav()
  async with context.expect_page() as event:
   await page.get_by_role('button',name='Float assistant',exact=True).click()
  pip=await event.value
  await pip.get_by_role('button',name='End voice session',exact=True).wait_for()
  await pip.close()
  await page.wait_for_function('!window.voiceInstances.some(r=>r.active)')
  assert await page.evaluate("window.capturedTracks.every(t=>t.readyState==='ended')"), 'Closing PiP left microphone active'
  for width in [390,320,768]:
   await page.set_viewport_size({'width':width,'height':844})
   for view,label in [('home','About APPLE'),('contact','Contact & support'),('faq','FAQs'),('privacy','Privacy policy'),('assistant','Assistant'),('settings','Settings & connections')]:
    await navigate(label); await no_overflow()
    await page.mouse.move(width-2,800)
    await page.keyboard.press('Escape')
    await page.evaluate('document.activeElement?.blur()')
    await page.wait_for_timeout(300)
    if view == 'assistant':
     caption = await page.locator('.vc-permission').bounding_box()
     message_panel = await page.locator('.messages').bounding_box()
     assert caption['y'] + caption['height'] <= message_panel['y'], 'Voice caption overlaps messages'
    if width == 390 and view in ['home','assistant','settings']:
     await page.screenshot(path=f'/tmp/apple-{view}-mobile-light.png')
  assert not errors,errors
  await browser.close()
  print('PASS: landing, links, FAQ, privacy, six color themes in both modes, persistent master mute, sounds, selected/all history deletion, responsive pages, real PiP, shared voice and microphone cleanup.')

if __name__ == '__main__': asyncio.run(main())
