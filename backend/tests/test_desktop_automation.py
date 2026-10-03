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


if __name__ == '__main__':
    unittest.main()
