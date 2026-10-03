// Fixed, bounded macOS Accessibility operations. Request values are JSON data.
ObjC.import('ApplicationServices');
ObjC.import('AppKit');

function run(argv) {
  const request = JSON.parse(argv[0]);
  const trusted = Boolean($.AXIsProcessTrusted());
  if (request.operation === 'permissions') return JSON.stringify({accessibility: trusted});
  if (!trusted) throw Error('APPLE_ACCESSIBILITY_REQUIRED');
  let running;
  for (let attempt = 0; attempt < 12; attempt++) {
    running = $.NSRunningApplication.runningApplicationsWithBundleIdentifier($(request.bundle_id));
    if (Number(running.count) === 1) break;
    delay(.1);
  }
  if (Number(running.count) !== 1) throw Error('Open the requested app and try again.');
  const nativeApp = running.objectAtIndex(0), pid = Number(nativeApp.processIdentifier);
  const app = $.AXUIElementCreateApplication(pid);
  $.AXUIElementSetMessagingTimeout(app, 0.10);
  let deadline = Date.now() + 3500;
  let visited = 0;
  const norm = v => String(v || '').normalize('NFKC').replace(/[\u200e\u200f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function check() { if (Date.now() > deadline) throw Error('The app took too long to expose its controls.'); }
  function attr(node, key) {
    check(); const out = Ref();
    if ($.AXUIElementCopyAttributeValue(node, $(key), out)) return null;
    return ObjC.castRefToObject(out[0]);
  }
  function text(node, key) {
    const out = attr(node, key); if (out === null) return '';
    const plain = ObjC.unwrap(out);
    return typeof plain === 'string' || typeof plain === 'boolean' ? plain : typeof plain === 'number' ? String(plain) : '';
  }
  function children(node) {
    const nodes = attr(node, 'AXChildren'), result = [];
    if (nodes) for (let i = 0; i < Number(nodes.count); i++) result.push(nodes.objectAtIndex(i));
    return result;
  }
  function info(node, path) {
    const subrole = text(node, 'AXSubrole');
    return {handle: path, role: text(node, 'AXRole'), subrole,
      title: text(node, 'AXTitle'), description: text(node, 'AXDescription'),
      identifier: text(node, 'AXIdentifier'), placeholder: text(node, 'AXPlaceholderValue'),
      value: subrole === 'AXSecureTextField' ? '' : text(node, 'AXValue'),
      enabled: text(node, 'AXEnabled') !== false};
  }
  function scan(node, path, result, depth) {
    if (++visited > 1600 || depth > 48) throw Error('The app’s visible control tree is too large. Open a simpler view and try again.');
    if (text(node, 'AXVisible') === false || text(node, 'AXHidden') === true) return;
    const data = info(node, path);
    if (data.title || data.description || data.identifier || data.placeholder || data.value !== '' ||
        ['AXTextField', 'AXTextArea', 'AXSearchField', 'AXRow', 'AXCell', 'AXList', 'AXTable', 'AXOutline'].includes(data.role)) result.push(data);
    children(node).forEach((child, i) => scan(child, path + '.' + i, result, depth + 1));
  }
  function frontWindow() {
    let window = null;
    for (let attempt = 0; attempt < 14; attempt++) {
      window = attr(app, 'AXFocusedWindow') || attr(app, 'AXMainWindow');
      if (!window) {
        const windows = attr(app, 'AXWindows');
        if (windows && Number(windows.count) === 1) window = windows.objectAtIndex(0);
      }
      if (window) break;
      nativeApp.activateWithOptions(2);
      delay(.1);
    }
    if (!window) throw Error('Open a window in the requested app and try again.');
    deadline = Date.now() + 3500;
    return window;
  }
  function snapshot(root) { visited = 0; const nodes = []; scan(root, '0', nodes, 0); return nodes; }
  function resolve(root, target) {
    const path = String(target.handle).split('.').map(Number);
    if (path.shift() !== 0 || path.some(i => !Number.isInteger(i) || i < 0)) throw Error('Invalid control path.');
    let node = root;
    for (const index of path) { node = children(node)[index]; if (!node) throw Error('The app’s layout changed. Inspect it again.'); }
    const actual = info(node, target.handle);
    if (text(node, 'AXVisible') === false || text(node, 'AXHidden') === true) throw Error('The requested control is no longer visible.');
    for (const key of ['role', 'identifier', 'title', 'description'])
      if (actual[key] !== target[key]) throw Error('The requested control changed. Inspect the app again.');
    return node;
  }
  if (request.operation === 'inspect') {
    const root = frontWindow();
    return JSON.stringify({window: text(root, 'AXTitle'), controls: snapshot(root)});
  }
  if (request.operation === 'show_search') {
    const root = frontWindow(), controls = snapshot(root);
    const search = controls.filter(n => n.enabled && n.subrole !== 'AXSecureTextField' &&
      ['AXTextField', 'AXTextArea', 'AXSearchField', 'AXComboBox'].includes(n.role) &&
      (n.role === 'AXSearchField' || n.subrole === 'AXSearchField' || /search|find/i.test([n.title, n.description, n.identifier, n.placeholder].join(' '))));
    if (search.length === 1) {
      const node = resolve(root, search[0]);
      $.AXUIElementSetAttributeValue(node, $('AXFocused'), $(true));
      return '{}';
    }
    const buttons = controls.filter(n => n.enabled && ['AXButton', 'AXMenuButton'].includes(n.role) &&
      ['search', 'find'].some(label => [n.title, n.description, n.identifier].some(value => norm(value) === label)));
    if (buttons.length === 1) {
      if ($.AXUIElementPerformAction(resolve(root, buttons[0]), $('AXPress'))) throw Error('The app could not open its Search control.');
      return '{}';
    }
    const bar = attr(app, 'AXMenuBar');
    const menus = [];
    // Closed menus report AXVisible=false. Their known Search menu items still
    // support AXPress; do not apply the window visibility filter to menu trees.
    let menuCount = 0;
    function menuItems(node, depth) {
      check();
      if (++menuCount > 1000 || depth > 12) return;
      const role = text(node, 'AXRole');
      if (role === 'AXMenuItem') menus.push({node, title: text(node, 'AXTitle'), enabled: text(node, 'AXEnabled') !== false});
      children(node).forEach(child => menuItems(child, depth + 1));
    }
    // Omit Apple's Recent Items menu; inspect only the app's own menus.
    children(bar).slice(1).forEach(menu => menuItems(menu, 0));
    const labels = ['search', 'find…', 'find...', 'find', 'search notes', 'search all notes'];
    let chosen = null;
    for (const label of labels) {
      const matches = menus.filter(n => n.enabled && norm(n.title) === label);
      if (matches.length === 1) { chosen = matches[0]; break; }
    }
    if (!chosen) throw Error('This app has no unambiguous Search control. Open its search view, then try again.');
    if ($.AXUIElementPerformAction(chosen.node, $('AXPress'))) throw Error('The app could not open Search.');
    return '{}';
  }
  const root = frontWindow();
  const node = resolve(root, request.node);
  if (request.operation === 'press') {
    if ($.AXUIElementPerformAction(node, $('AXPress'))) throw Error('This control does not support a native click.');
  } else if (request.operation === 'set_value' || request.operation === 'type_value') {
    const current = info(node, request.node.handle);
    if (current.subrole === 'AXSecureTextField') throw Error('Password fields must be filled directly by you.');
    if (current.value !== request.node.value) throw Error('The field changed. Inspect it again before typing.');
    if (!['AXTextField', 'AXTextArea', 'AXSearchField', 'AXComboBox'].includes(current.role)) throw Error('The selected control is not a text field.');
    if (typeof request.value !== 'string' || request.value.length > 5000 || /[\x00-\x1f]/.test(request.value)) throw Error('Use single-line text of at most 5,000 characters.');
    if (request.operation === 'type_value') {
      nativeApp.activateWithOptions(2);
      $.AXUIElementSetAttributeValue(node, $('AXFocused'), $(true));
      delay(.08);
      const events = Application('System Events');
      function guard(expected) {
        const front = $.NSWorkspace.sharedWorkspace.frontmostApplication;
        const focused = attr(app, 'AXFocusedUIElement');
        if (!front || Number(front.processIdentifier) !== pid || !focused || !$.CFEqual(focused, node))
          throw Error('The app or text field lost focus. No further text was typed.');
        if (text(node, 'AXValue') !== expected) throw Error('The field changed while typing. No further text was typed.');
      }
      guard(current.value);
      events.keystroke('a', {using: 'command down'});
      guard(current.value);
      events.keyCode(51);
      delay(.05);
      guard('');
      if (request.value) events.keystroke(request.value);
      delay(.12);
    } else if ($.AXUIElementSetAttributeValue(node, $('AXValue'), $(request.value)))
      throw Error('This app does not support native text entry in that field.');
    if (text(node, 'AXValue') !== request.value) throw Error('The app did not retain the requested text.');
  } else throw Error('Unsupported desktop operation.');
  return '{}';
}
