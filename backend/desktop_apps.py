"""Resolve spoken app names against applications actually installed on this Mac."""
import plistlib
import re
import time
import unicodedata
from dataclasses import dataclass
from difflib import get_close_matches
from pathlib import Path


def app_key(value):
    value = unicodedata.normalize('NFKC', str(value)).casefold()
    return ''.join(c for c in value if c.isalnum())


ALIASES = {
    'chrome': 'Google Chrome', 'googlechrome': 'Google Chrome', 'google': 'Google Chrome',
    'vscode': 'Visual Studio Code', 'vsc': 'Visual Studio Code', 'visualcode': 'Visual Studio Code',
    'code': 'Visual Studio Code', 'whatsapp': 'WhatsApp', 'whatsup': 'WhatsApp',
    'whatapp': 'WhatsApp', 'settings': 'System Settings', 'systempreferences': 'System Settings',
    'preferences': 'System Settings', 'camera': 'Photo Booth', 'photobooth': 'Photo Booth',
    'applemusic': 'Music', 'itunes': 'Music', 'applemaps': 'Maps', 'applemail': 'Mail',
    'appstore': 'App Store', 'calculatorapp': 'Calculator', 'activitymonitor': 'Activity Monitor',
    'filemanager': 'Finder', 'files': 'Finder', 'safaribrowser': 'Safari',
    'passwordmanager': 'Passwords', 'vs': 'Visual Studio Code', 'facetime': 'FaceTime',
}


@dataclass(frozen=True)
class InstalledApp:
    name: str
    path: str
    bundle_id: str = ''
    alternate_names: tuple = ()

    def public(self):
        return {'name': self.name, 'bundle_id': self.bundle_id, 'path': self.path}


_cache = (0, [])


def installed_apps(*, roots=None, refresh=False):
    global _cache
    if roots is None and not refresh and time.monotonic() - _cache[0] < 30:
        return list(_cache[1])
    default = roots is None
    roots = roots or [Path('/Applications'), Path('/System/Applications'),
                      Path('/System/Library/CoreServices/Applications'), Path.home() / 'Applications']
    found = {}

    def add(path):
        try:
            with (path / 'Contents/Info.plist').open('rb') as handle:
                info = plistlib.load(handle)
        except (OSError, plistlib.InvalidFileException):
            return
        bundle_id = info.get('CFBundleIdentifier', '')
        names = tuple(dict.fromkeys(str(v) for v in (path.stem, info.get('CFBundleDisplayName'), info.get('CFBundleName')) if v))
        name = names[0]
        key = bundle_id or str(path.resolve())
        # Prefer user-facing /Applications over copies inside system support folders.
        found.setdefault(key, InstalledApp(name, str(path), bundle_id, names))

    def scan(folder, depth=0):
        if depth > 3:
            return
        try:
            entries = sorted(folder.iterdir(), key=lambda p: p.name.casefold())
        except OSError:
            return
        for entry in entries:
            if entry.name.startswith('.'):
                continue
            if entry.suffix.lower() == '.app':
                add(entry)
            elif entry.is_dir() and not entry.is_symlink():
                scan(entry, depth + 1)

    for root in roots:
        scan(Path(root))
    if default:
        # macOS also launches portable apps directly from these folders; they
        # are common install locations for VS Code and downloaded utilities.
        for folder in (Path.home() / 'Downloads', Path.home() / 'Desktop'):
            try:
                for entry in folder.iterdir():
                    if entry.suffix.lower() == '.app':
                        add(entry)
            except OSError:
                pass
        add(Path('/System/Library/CoreServices/Finder.app'))
        add(Path('/System/Cryptexes/App/System/Applications/Safari.app'))
    result = sorted(found.values(), key=lambda a: a.name.casefold())
    if default:
        _cache = (time.monotonic(), result)
    return result


def resolve_app(query, apps=None):
    apps = installed_apps() if apps is None else apps
    query = query.strip()
    if not query or '\n' in query or '\r' in query:
        raise ValueError('Give me the application name.')
    cleaned = re.sub(r'\s+(?:app|application|browser)$', '', query, flags=re.I)
    canonical = ALIASES.get(app_key(cleaned), cleaned)
    keys = {app_key(query), app_key(cleaned), app_key(canonical)}
    matches = [app for app in apps if app.bundle_id.casefold() == query.casefold()
               or any(app_key(name) in keys for name in (app.name, *app.alternate_names))
               or app.path == query]
    if len(matches) == 1:
        return matches[0]
    if not matches and len(app_key(canonical)) >= 4:
        matches = [app for app in apps if app_key(app.name).startswith(app_key(canonical))]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise ValueError('More than one installed app matches. Say ' + ' or '.join(a.name for a in matches[:5]) + '.')
    suggestions = get_close_matches(app_key(canonical), [app_key(a.name) for a in apps], n=3, cutoff=.58)
    names = [a.name for a in apps if app_key(a.name) in suggestions]
    suffix = ' Available matches: ' + ', '.join(names) + '.' if names else ' Say “list my apps” to see what is installed.'
    raise ValueError(f'I could not find an installed app named “{query}”.' + suffix)


async def open_installed(query, process):
    app = resolve_app(query)
    await process('open', '-a', app.path)
    return app
