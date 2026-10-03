// Fixed, bounded macOS Accessibility operations. Request values are JSON data.
ObjC.import('ApplicationServices');
ObjC.import('AppKit');

function run(argv) {
  const request = JSON.parse(argv[0]);
  const trusted = Boolean($.AXIsProcessTrusted());
  if (request.operation === 'permissions') return JSON.stringify({accessibility: trusted});
  if (!trusted) throw Error('APPLE_ACCESSIBILITY_REQUIRED');
  const running = $.NSRunningApplication.runningApplicationsWithBundleIdentifier($(request.bundle_id));
  if (Number(running.count) !== 1) throw Error('Open the requested app and try again.');
  const app = $.AXUIElementCreateApplication(Number(running.objectAtIndex(0).processIdentifier));
  $.AXUIElementSetMessagingTimeout(app, 0.10);
  const deadline = Date.now() + 2500;
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
    return typeof plain === 'string' || typeof plain === 'boolean' ? plain : '';
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
    if (++visited > 900 || depth > 24) throw Error('The app’s visible control tree is too large. Open a simpler view and try again.');
    if (text(node, 'AXVisible') === false || text(node, 'AXHidden') === true) return;
    const data = info(node, path);
    if (data.title || data.description || data.identifier || data.placeholder || ['AXTextField', 'AXTextArea', 'AXSearchField'].includes(data.role)) result.push(data);
    children(node).forEach((child, i) => scan(child, path + '.' + i, result, depth + 1));
  }
  function frontWindow() {
    let window = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      window = attr(app, 'AXFocusedWindow') || attr(app, 'AXMainWindow');
      if (!window) {
        const windows = attr(app, 'AXWindows');
        if (windows && Number(windows.count) === 1) window = windows.objectAtIndex(0);
      }
      if (window) break;
      running.objectAtIndex(0).activateWithOptions(2);
      delay(.1);
    }
    if (!window) throw Error('Open a window in the requested app and try again.');
    return window;
  }
  function snapshot(root) { const nodes = []; scan(root, '0', nodes, 0); return nodes; }
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
      /search|find/i.test([n.title, n.description, n.identifier, n.placeholder].join(' ')));
    if (search.length === 1) {
      const node = resolve(root, search[0]);
      $.AXUIElementSetAttributeValue(node, $('AXFocused'), $(true));
      return '{}';
    }
    const bar = attr(app, 'AXMenuBar');
    const menus = [];
    // Omit Apple's Recent Items menu; only inspect this application's menus.
    children(bar).slice(1).forEach((menu, i) => scan(menu, 'm.' + i, menus, 0));
    const labels = ['search', 'find…', 'find...', 'find', 'search notes', 'search all notes'];
    let chosen = null;
    for (const label of labels) {
      const matches = menus.filter(n => n.role === 'AXMenuItem' && n.enabled && norm(n.title) === label);
      if (matches.length === 1) { chosen = matches[0]; break; }
    }
    if (!chosen) throw Error('This app has no unambiguous Search control. Open its search view, then try again.');
    let node = children(bar).slice(1)[Number(chosen.handle.split('.')[1])];
    for (const index of chosen.handle.split('.').slice(2).map(Number)) node = children(node)[index];
    if ($.AXUIElementPerformAction(node, $('AXPress'))) throw Error('The app could not open Search.');
    return '{}';
  }
  const root = frontWindow();
  const node = resolve(root, request.node);
  if (request.operation === 'press') {
    if ($.AXUIElementPerformAction(node, $('AXPress'))) throw Error('This control does not support a native click.');
  } else if (request.operation === 'set_value') {
    const current = info(node, request.node.handle);
    if (current.subrole === 'AXSecureTextField') throw Error('Password fields must be filled directly by you.');
    if (current.value !== request.node.value) throw Error('The field changed. Inspect it again before typing.');
    if ($.AXUIElementSetAttributeValue(node, $('AXValue'), $(request.value)))
      throw Error('This app does not support native text entry in that field.');
    if (text(node, 'AXValue') !== request.value) throw Error('The app did not retain the requested text.');
  } else throw Error('Unsupported desktop operation.');
  return '{}';
}
