"""UI smoke test against a running local server; never sends or runs desktop actions."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 960}, device_scale_factor=1)
        await page.add_init_script("localStorage.setItem('apple-voice', 'false')")
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        async def status(route):
            response = await route.fetch()
            data = await response.json()
            data['settings'].update(auto_tutor=False, setup_completed=True)
            await route.fulfill(json=data)
        await page.route('**/api/status', status)
        approval = {'type':'approval', 'approval_id':'ui-test', 'reply':'Review test only', 'actions':[{'action':'whatsapp_send','target':'UI Test Contact','message':'This should never send'}]}
        await page.route('**/api/command/stream', lambda route: route.fulfill(content_type='text/event-stream', body='data: '+json.dumps(approval)+'\n\n'))
        await page.route('**/api/approvals/ui-test', lambda route: route.fulfill(json={'cancelled':True}))
        async def navigate(label):
            await page.locator('.reveal-nav-trigger').focus()
            await page.keyboard.press('ArrowDown')
            await page.get_by_role('button', name=label, exact=True).click()
        await page.goto('http://127.0.0.1:8000')
        await page.get_by_role('heading', name='At your service.', exact=True).wait_for()
        await page.screenshot(path='/tmp/apple-desktop.png', full_page=True)
        await navigate('Knowledge library')
        for button in await page.get_by_role('button', name='Remove APPLE UI test notes.txt from library', exact=True).all():
            await button.click()
        await page.locator('input[type=file]').set_input_files({'name': 'APPLE UI test notes.txt', 'mimeType': 'text/plain', 'buffer': b'Gravity attracts objects. Photosynthesis converts light to chemical energy.'})
        await page.get_by_text('APPLE UI test notes.txt', exact=True).wait_for()
        await page.locator('.document-row').filter(has_text='APPLE UI test notes.txt').get_by_role('button', name='Ask', exact=True).click()
        await page.get_by_text('Asking about APPLE UI test notes.txt').wait_for()
        await page.get_by_role('button', name='Remove document context').click()
        await page.get_by_role('textbox', name='Message APPLE').fill('WhatsApp UI Test Contact: This should never send')
        await page.get_by_role('button', name='Send command', exact=True).click()
        await page.get_by_text('Ready for your review', exact=True).wait_for()
        await page.get_by_role('button', name='Cancel', exact=True).click()
        await page.get_by_text('Cancelled. No actions from this plan were run.', exact=True).wait_for()
        await navigate('My routines')
        await page.get_by_role('button', name='Teach a routine', exact=True).click()
        await page.get_by_label('Give it a name').fill('UI smoke routine')
        await page.get_by_placeholder('Open Calendar').fill('Open Notes\nOpen Safari')
        await page.get_by_role('button', name='Remember this routine').click()
        await page.get_by_role('heading', name='UI smoke routine').wait_for()
        await page.get_by_role('button', name='Delete routine UI smoke routine').click()
        await page.get_by_role('heading', name='UI smoke routine').wait_for(state='hidden')
        await navigate('Knowledge library')
        await page.get_by_role('button', name='Remove APPLE UI test notes.txt from library').click()
        await page.get_by_text('APPLE UI test notes.txt', exact=True).wait_for(state='hidden')
        await navigate('Settings & connections')
        await page.get_by_role('heading', name='Local intelligence', exact=True).wait_for()
        await page.screenshot(path='/tmp/apple-settings.png', full_page=True)
        await navigate('Assistant')
        await page.get_by_role('button', name='New session').click()
        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.screenshot(path='/tmp/apple-mobile.png', full_page=True)
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal overflow'
        assert not errors, errors
        await browser.close()
        print('PASS: dashboard, document import/context/removal, approval cancellation, routines, settings, mobile overflow; no browser errors.')


asyncio.run(main())
