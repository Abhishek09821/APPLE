"""New visitor flow, navigation, shared page widths and README screenshots.
All records and responses are fixtures. No personal profile, files or contacts change.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / 'docs' / 'images'

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--mute-audio'])
  page=await browser.new_page(viewport={'width':1440,'height':960},color_scheme='light',device_scale_factor=1)
  errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
  profile={'name':'','tutorial_completed':False}
  profile_writes=[]; reject=[True]
  settings={'model':'qwen3:8b','speech_rate':175,'setup_completed':True,'automation_enabled':False,'auto_tutor':False,'expressive_voice':True}
  docs=[{'id':'sample-notes','name':'Biology revision.txt','pages':2,'characters':1280,'created':'2026-10-03T12:00:00Z'}]
  async def routes(route):
   path=route.request.url.split('/api')[-1]; method=route.request.method
   if path=='/status': return await route.fulfill(json={'token':'fixture','ai':{'ready':True,'models':['qwen3:8b']},'profile':profile,'settings':settings})
   if path=='/profile' and method=='PUT':
    if reject:
     reject.pop(); return await route.fulfill(status=503,json={'detail':'Could not save your name. Please try again.'})
    value=route.request.post_data_json; value['name']=' '.join(value['name'].split()); profile.update(value); profile_writes.append(value)
    return await route.fulfill(json=profile)
   if path=='/documents': return await route.fulfill(json=docs)
   if path in ['/routines','/history','/memories','/contacts']: return await route.fulfill(json=[])
   if path=='/permissions': return await route.fulfill(json={'accessibility':True})
   if path in ['/speech/stop','/stop']: return await route.fulfill(json={'stopped':True})
   errors.append('Unexpected route '+path); return await route.fulfill(status=404,json={'detail':'Unexpected fixture'})
  await page.route('**/api/**',routes)
  async def open_nav():
   await page.get_by_role('button',name='Show navigation',exact=True).focus()
   await page.keyboard.press('ArrowDown')
  async def navigate(label):
   await open_nav()
   await page.get_by_role('navigation',name='Main navigation').get_by_role('button',name=label,exact=True).click()
   assert await page.locator('.global-nav-panel').get_attribute('aria-hidden')=='true', 'Navigation must retract after selection'
   assert await page.locator('.topbar').count()==0, 'Duplicate header returned'
  await page.goto('http://127.0.0.1:8000')
  welcome=page.get_by_role('dialog')
  await welcome.get_by_role('heading',name='What should I call you?').wait_for()
  assert await welcome.locator('input').count()==1
  assert await welcome.get_by_role('button',name='Let’s get started').is_disabled()
  await welcome.screenshot(path=str(SHOTS/'welcome.png'))
  await welcome.get_by_label('Your name',exact=True).fill('  Aditi   Rao  ')
  await welcome.get_by_role('button',name='Let’s get started').click()
  await welcome.get_by_role('alert').wait_for()
  assert profile['name']=='' and not profile_writes
  await welcome.get_by_role('button',name='Let’s get started').click()
  await welcome.get_by_role('heading',name='Hi Aditi Rao. Let’s save you some typing.').wait_for()
  assert profile['name']=='Aditi Rao' and not profile['tutorial_completed']
  await welcome.screenshot(path=str(SHOTS/'whatsapp-tour.png'))
  await welcome.get_by_role('button',name='Skip tour',exact=True).click()
  await welcome.wait_for(state='hidden')
  assert profile['tutorial_completed']
  await page.reload()
  await page.get_by_role('heading',name='Less clicking. More living.').wait_for()
  assert await page.locator('dialog[open]').count()==0
  await page.wait_for_timeout(700)
  await page.mouse.move(100,1)
  await page.wait_for_timeout(350)
  await page.screenshot(path=str(SHOTS/'home.png'))
  await navigate('Settings & connections')
  # The panel stays hidden after selection, then returns from any point on the top edge.
  await page.mouse.move(300,250)
  await page.wait_for_timeout(450)
  assert await page.locator('.global-nav-panel').get_attribute('aria-hidden')=='true'
  await page.mouse.move(100,1)
  await page.wait_for_timeout(350)
  assert await page.locator('.global-nav-panel').get_attribute('aria-hidden')=='false'
  await page.mouse.move(300,250)
  await page.wait_for_timeout(450)
  assert await page.locator('.global-nav-panel').get_attribute('aria-hidden')=='true'
  # Keyboard users can reveal the panel, reach its links and dismiss it with Escape.
  await open_nav()
  await page.wait_for_function("document.activeElement?.getAttribute('aria-label') === 'About APPLE'")
  await page.keyboard.press('Escape')
  assert await page.get_by_role('button',name='Show navigation',exact=True).get_attribute('aria-expanded')=='false'
  await page.get_by_label('Your name',exact=True).fill('Riya')
  await page.get_by_role('button',name='Save name',exact=True).click()
  await page.get_by_text('Your name is saved. APPLE will use it in future conversations.',exact=True).wait_for()
  assert profile['name']=='Riya'
  await page.get_by_role('button',name='Replay welcome tour',exact=True).click()
  await welcome.get_by_role('heading',name='Hi Riya. Let’s save you some typing.').wait_for()
  await welcome.get_by_role('button',name='Next: your library').click()
  await welcome.get_by_role('heading',name='Put your notes to work.').wait_for()
  await welcome.screenshot(path=str(SHOTS/'library-tour.png'))
  await welcome.get_by_role('button',name='Back',exact=True).click()
  await welcome.get_by_role('button',name='Next: your library').click()
  await welcome.get_by_role('button',name='Open my assistant',exact=True).click()
  await welcome.wait_for(state='hidden')
  assert await page.locator('.workspace-owner').inner_text()=='Riya'
  await page.get_by_role('heading',name='At your service.',exact=True).wait_for()
  await page.wait_for_timeout(350)
  await page.screenshot(path=str(SHOTS/'assistant.png'))
  await navigate('Knowledge library')
  await page.get_by_text('Biology revision.txt',exact=True).wait_for()
  await page.screenshot(path=str(SHOTS/'library.png'))
  await navigate('Settings & connections')
  await page.get_by_role('button',name='Replay welcome tour',exact=True).click()
  await welcome.get_by_role('button',name='Next: your library').click()
  await welcome.get_by_role('button',name='Skip tour',exact=True).click()
  await welcome.wait_for(state='hidden')
  await navigate('About APPLE')
  await open_nav()
  await page.get_by_role('button',name='Switch to dark theme').click()
  await page.wait_for_timeout(300)
  await page.screenshot(path=str(SHOTS/'home-dark.png'))
  await page.get_by_role('button',name='Switch to light theme').click()
  assert await page.locator('html').evaluate('(el)=>getComputedStyle(el).getPropertyValue("--canvas").trim()')=='#f5f7fa'
  for width in [1440,1024,820,390,320]:
   await page.set_viewport_size({'width':width,'height':900 if width>820 else 844})
   for view,label in [('home','About APPLE'),('library','Knowledge library'),('routines','My routines'),('activity','Activity'),('settings','Settings & connections'),('contact','Contact & support'),('faq','FAQs'),('privacy','Privacy policy'),('assistant','Assistant')]:
    await navigate(label)
    await page.wait_for_timeout(100)
    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{view} document overflow at {width}'
    assert await page.locator('.primary-content').evaluate('(el)=>el.scrollWidth <= el.clientWidth+1'), f'{view} content overflow at {width}'
    if view!='assistant':
     geometry=await page.evaluate('''()=>{ const page=document.querySelector('.page-content, .product-page'); const nav=document.querySelector('.global-nav-inner'); const a=page.getBoundingClientRect(),b=nav.getBoundingClientRect(); return {left:Math.abs(a.left+parseFloat(getComputedStyle(page).paddingLeft)-b.left-parseFloat(getComputedStyle(nav).paddingLeft)),right:Math.abs(a.right-b.right)} }''')
     assert geometry['left']<2 and geometry['right']<2,(view,width,geometry)
    if width==390 and view=='home':
     await page.wait_for_timeout(650)
     await page.screenshot(path=str(SHOTS/'home-mobile.png'))
   if width==390:
    await page.get_by_role('button',name='Show navigation',exact=True).click()
    assert await page.get_by_role('button',name='Privacy policy',exact=True).is_visible()
    await page.keyboard.press('Escape')
    assert await page.get_by_role('button',name='Show navigation',exact=True).get_attribute('aria-expanded')=='false'
    await navigate('Settings & connections')
    await page.get_by_role('button',name='Replay welcome tour',exact=True).click()
    assert await welcome.evaluate('(el)=>el.scrollWidth <= el.clientWidth'), 'Tour overflow'
    await welcome.get_by_role('button',name='Skip tour',exact=True).click()
    await welcome.wait_for(state='hidden')
  # Touch has a visible tap target; it never depends on hover support.
  touch=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  touch_page=await touch.new_page()
  await touch_page.route('**/api/**',routes)
  await touch_page.goto('http://127.0.0.1:8000')
  await touch_page.get_by_role('button',name='Show navigation',exact=True).tap()
  await touch_page.get_by_role('button',name='Knowledge library',exact=True).tap()
  await touch_page.get_by_text('Biology revision.txt',exact=True).wait_for()
  assert await touch_page.locator('.global-nav-panel').get_attribute('aria-hidden')=='true'
  await touch_page.get_by_role('button',name='Show navigation',exact=True).tap()
  await touch_page.get_by_role('button',name='Hide navigation',exact=True).tap()
  assert await touch_page.locator('.global-nav-panel').get_attribute('aria-hidden')=='true'
  await touch.close()
  await page.emulate_media(reduced_motion='reduce')
  await navigate('About APPLE')
  assert await page.locator('.global-nav-panel').evaluate('(el)=>getComputedStyle(el).transitionDuration')=='0s'
  await page.locator('.system-preview').hover()
  assert await page.locator('.system-scan').evaluate('(el)=>getComputedStyle(el).animationName')=='none'
  assert not errors,errors
  await browser.close()
  print('PASS: name-only welcome, save failure/retry, persistence, name edits, both skip steps, replay/back/finish, hover/touch/keyboard navigation, reduced motion, original palette, consistent widths on every page, README screenshots.')

if __name__=='__main__': asyncio.run(main())
