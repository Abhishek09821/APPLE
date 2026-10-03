import asyncio
import json
import plistlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from desktop_apps import InstalledApp, installed_apps, resolve_app, open_installed
from desktop_automation import select_control, safe_control, public_controls, permissions_status
import desktop_automation
from models import Action


class DesktopAutomationTests(unittest.TestCase):
    def setUp(self):
        self.apps = [InstalledApp('Photo Booth', '/System/Applications/Photo Booth.app', 'com.apple.PhotoBooth'),
                     InstalledApp('Visual Studio Code', '/Users/me/Downloads/Visual Studio Code.app', 'com.microsoft.VSCode'),
                     InstalledApp('System Settings', '/System/Applications/System Settings.app', 'com.apple.systempreferences')]

    def test_spoken_aliases_resolve_actual_installed_paths(self):
        self.assertEqual(resolve_app('camera', self.apps).bundle_id, 'com.apple.PhotoBooth')
        self.assertEqual(resolve_app('vs code', self.apps).path, '/Users/me/Downloads/Visual Studio Code.app')
        self.assertEqual(resolve_app('settings app', self.apps).name, 'System Settings')

    def test_unknown_or_ambiguous_apps_are_not_launched(self):
        with self.assertRaisesRegex(ValueError, 'could not find'):
            resolve_app('Notes" & malicious', self.apps)
        with self.assertRaisesRegex(ValueError, 'More than one'):
            resolve_app('Visual', self.apps + [InstalledApp('Visual Studio', '/Applications/Visual Studio.app')])

    def test_inventory_reads_bundles_and_skips_bundle_internals(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            info = root / 'Tools/Example.app/Contents/Info.plist'; info.parent.mkdir(parents=True)
            info.write_bytes(plistlib.dumps({'CFBundleIdentifier': 'example.app', 'CFBundleName': 'Example App'}))
            nested = root / 'Tools/Example.app/Contents/Helper.app/Contents/Info.plist'; nested.parent.mkdir(parents=True)
            nested.write_bytes(plistlib.dumps({'CFBundleIdentifier': 'example.helper'}))
            result = installed_apps(roots=[root])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].bundle_id, 'example.app')

    def test_open_uses_verified_full_bundle_path(self):
        process = AsyncMock()
        with patch('desktop_apps.installed_apps', return_value=self.apps):
            app = asyncio.run(open_installed('camera', process))
        process.assert_awaited_once_with('open', '-a', '/System/Applications/Photo Booth.app')
        self.assertEqual(app.name, 'Photo Booth')

    def test_control_requires_unique_exact_label(self):
        controls = [{'handle': '0.1', 'role': 'AXButton', 'title': 'Play', 'identifier': 'player.play', 'description': ''},
                    {'handle': '0.2', 'role': 'AXButton', 'title': 'Play', 'identifier': 'preview.play', 'description': ''}]
        with self.assertRaisesRegex(ValueError, 'More than one'):
            select_control(controls, 'Play', {'AXButton'})
        self.assertEqual(select_control(controls, 'player.play', {'AXButton'})['handle'], '0.1')
        with self.assertRaisesRegex(ValueError, 'could not find'):
            select_control(controls, 'Pla', {'AXButton'})

    def test_password_fields_and_shell_controls_are_not_mutated(self):
        control = {'role': 'AXTextField', 'subrole': 'AXSecureTextField', 'title': 'Password', 'value': 'secret'}
        self.assertEqual(public_controls({'controls': [control]}), [])
        with self.assertRaises(ValueError):
            select_control([control], 'Password', {'AXTextField'})
        with self.assertRaisesRegex(ValueError, 'shell commands'):
            safe_control(InstalledApp('Terminal', '/Applications/Terminal.app', 'com.apple.Terminal'), {}, 'set_value')
        with self.assertRaisesRegex(ValueError, 'recipient'):
            safe_control(InstalledApp('WhatsApp', '/Applications/WhatsApp.app', 'net.whatsapp.WhatsApp'),
                         {'identifier': 'ChatBar_SendButton'}, 'press')

    def test_permission_check_does_not_request_consent(self):
        process = AsyncMock(return_value=json.dumps({'accessibility': False}))
        result = asyncio.run(permissions_status(process))
        self.assertFalse(result['accessibility'])
        request = json.loads(process.call_args.args[-1])
        self.assertEqual(request, {'operation': 'permissions'})

    def test_symbol_controls_and_real_button_suffix_labels_are_preserved(self):
        controls = [{'handle': '0.1', 'role': 'AXButton', 'title': '+', 'identifier': ''},
                    {'handle': '0.2', 'role': 'AXButton', 'title': 'Action button', 'identifier': ''},
                    {'handle': '0.3', 'role': 'AXButton', 'title': 'Action', 'identifier': ''}]
        self.assertEqual(select_control(controls, '+', {'AXButton'})['handle'], '0.1')
        self.assertEqual(select_control(controls, 'Action button', {'AXButton'})['handle'], '0.2')
        self.assertEqual(select_control(controls, 'the + button', {'AXButton'})['handle'], '0.1')

    def test_value_only_display_is_available_to_inspection(self):
        controls = public_controls({'controls': [{'role': 'AXStaticText', 'value': '4', 'enabled': True}]})
        self.assertEqual(controls[0]['label'], '4')
        self.assertEqual(controls[0]['value'], '4')


class DesktopActionTests(unittest.IsolatedAsyncioTestCase):
    async def test_calculator_plus_alias_uses_observed_add_control_and_returns_display(self):
        app = InstalledApp('Calculator', '/System/Applications/Calculator.app', 'com.apple.calculator')
        button = {'handle': '0.1', 'role': 'AXButton', 'title': 'Add', 'identifier': 'Add', 'value': ''}
        before = {'controls': [button, {'role': 'AXStaticText', 'value': '2'}]}
        after = {'controls': [button, {'role': 'AXStaticText', 'value': '2 +'}]}
        bridge = AsyncMock(side_effect=[before, {}, after])
        with patch.object(desktop_automation, 'open_installed', AsyncMock(return_value=app)), \
             patch.object(desktop_automation, 'call_bridge', bridge), \
             patch.object(desktop_automation.asyncio, 'sleep', AsyncMock()):
            result = await desktop_automation.desktop_action(Action(action='click_control', target='Calculator', control='the plus button'), AsyncMock())
        self.assertEqual(bridge.await_args_list[1].kwargs['node'], button)
        self.assertTrue(result['visible_change'])
        self.assertIn('2 +', [control['value'] for control in result['controls']])

    async def test_search_uses_guarded_text_events_and_observes_results(self):
        app = InstalledApp('Finder', '/System/Library/CoreServices/Finder.app', 'com.apple.finder')
        field = {'handle': '0.1', 'role': 'AXTextField', 'subrole': 'AXSearchField', 'title': '', 'identifier': '_NS:122', 'value': ''}
        before = {'controls': [field, {'role': 'AXStaticText', 'value': '12 items'}]}
        after = {'controls': [{**field, 'value': 'needle'}, {'role': 'AXStaticText', 'value': '0 items'}]}
        bridge = AsyncMock(side_effect=[before, {}, before, {}, after])
        with patch.object(desktop_automation, 'open_installed', AsyncMock(return_value=app)), \
             patch.object(desktop_automation, 'call_bridge', bridge), \
             patch.object(desktop_automation.asyncio, 'sleep', AsyncMock()):
            result = await desktop_automation.desktop_action(Action(action='search_app', target='Finder', message='needle'), AsyncMock())
        self.assertEqual(bridge.await_args_list[3].args[1], 'type_value')
        self.assertEqual(bridge.await_args_list[3].kwargs['value'], 'needle')
        self.assertIn('0 items', [control['value'] for control in result['controls']])

    async def test_search_field_echo_alone_is_not_reported_as_results(self):
        app = InstalledApp('Finder', '/System/Library/CoreServices/Finder.app', 'com.apple.finder')
        before = {'controls': [{'role': 'AXTextField', 'title': 'Search', 'value': ''}]}
        after = {'controls': [{'role': 'AXTextField', 'title': 'Search', 'value': 'needle'}]}
        with patch.object(desktop_automation, 'call_bridge', AsyncMock(return_value=after)), \
             patch.object(desktop_automation.asyncio, 'sleep', AsyncMock()):
            with self.assertRaisesRegex(ValueError, 'could not verify updated results'):
                await desktop_automation._wait_search_results(AsyncMock(), app, before, 'needle')

    async def test_unrelated_result_change_with_a_different_query_is_not_verified(self):
        app = InstalledApp('Finder', '/System/Library/CoreServices/Finder.app', 'com.apple.finder')
        before = {'controls': [{'role': 'AXTextField', 'subrole': 'AXSearchField', 'value': ''}]}
        after = {'controls': [{'role': 'AXTextField', 'subrole': 'AXSearchField', 'value': 'another query'},
                              {'role': 'AXStaticText', 'value': '0 items'}]}
        with patch.object(desktop_automation, 'call_bridge', AsyncMock(return_value=after)), \
             patch.object(desktop_automation.asyncio, 'sleep', AsyncMock()):
            with self.assertRaisesRegex(ValueError, 'could not verify updated results'):
                await desktop_automation._wait_search_results(AsyncMock(), app, before, 'needle')

    async def test_unsupported_chrome_web_app_reports_the_actual_adapter_limit(self):
        with patch.object(desktop_automation, 'call_bridge', AsyncMock(side_effect=RuntimeError('The app’s visible control tree is too large.'))):
            with self.assertRaisesRegex(ValueError, 'runs inside Chrome'):
                await desktop_automation._inspect_ready(AsyncMock(), 'com.google.Chrome.app.example')


if __name__ == '__main__':
    unittest.main()
