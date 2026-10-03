"""Saved-contact settings UI against isolated HTTP fixtures; no actual contacts/messages."""
import asyncio
from playwright.async_api import async_playwright

async def main():
    contacts, writes, errors = [], [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width':1440,'height':960})
        page.on('pageerror', lambda e: errors.append(str(e)))
        async def route(request):
            path = request.request.url.split('/api')[-1]
            method = request.request.method
            if path == '/status': return await request.fulfill(json={'token':'fixture','ai':{'ready':True,'models':['test']},'profile':{'name':'Test User','tutorial_completed':True},'settings':{'model':'test','speech_rate':175,'setup_completed':True,'automation_enabled':False,'auto_tutor':True}})
            if path == '/permissions': return await request.fulfill(json={'accessibility':True})
            if path in ['/documents','/routines','/history','/memories']: return await request.fulfill(json=[])
            if path.startswith('/contacts'):
                if method == 'GET': return await request.fulfill(json=contacts)
                writes.append(method)
                if method == 'DELETE': contacts.clear(); return await request.fulfill(json={'deleted':True})
                contact = {**request.request.post_data_json,'id':'fixture-contact'}
                contacts[:] = [contact]
                return await request.fulfill(json=contact)
            return await request.fulfill(status=400,json={'detail':'Unexpected request'})
        await page.route('**/api/**',route)
        await page.goto('http://127.0.0.1:8000/#assistant')
        if await page.locator('.global-nav-toggle').is_visible():
            await page.get_by_role('button', name='Show navigation', exact=True).click()
        await page.get_by_role('button',name='Settings & connections',exact=True).click()
        panel=page.get_by_role('region',name='WhatsApp contacts')
        await panel.get_by_label('WhatsApp name',exact=True).fill('Test Mother')
        await panel.get_by_label('Phone number',exact=True).fill('9876543210')
        await panel.get_by_role('button',name='Save contact',exact=True).click()
        await panel.get_by_text('Use +, your country code, and 8–15 digits in total.').wait_for()
        assert writes == []
        await panel.get_by_label('Phone number',exact=True).fill('+91 98765 43210')
        await panel.get_by_label('Voice aliases',exact=True).fill('Mummy, माँ, Mom')
        await panel.get_by_role('button',name='Save contact',exact=True).click()
        await panel.get_by_role('button',name='Edit Test Mother',exact=True).wait_for()
        assert contacts[0]['phone'] == '+919876543210'
        assert contacts[0]['aliases'] == ['Mummy','माँ','Mom']
        await panel.get_by_role('button',name='Edit Test Mother',exact=True).click()
        await panel.get_by_label('Voice aliases',exact=True).fill('Maa, माँ')
        await panel.get_by_role('button',name='Save contact',exact=True).click()
        await panel.get_by_text('Maa',exact=True).wait_for()
        await panel.screenshot(path='/tmp/apple-saved-contacts.png')
        await panel.get_by_role('button',name='Remove Test Mother',exact=True).click()
        await panel.get_by_role('button',name='Remove Test Mother',exact=True).wait_for(state='hidden')
        assert contacts == [] and writes == ['POST','PUT','DELETE']
        await page.set_viewport_size({'width':390,'height':844})
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        assert not errors,errors
        await browser.close()
        print('PASS: contact validation, create/edit/remove, international number normalization, Hindi aliases, mobile overflow; no real contacts or messages used.')

asyncio.run(main())
