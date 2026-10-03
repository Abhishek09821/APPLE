// Static native Accessibility bridge. All user text arrives as JSON argv data.
// Each invocation is bounded and cancellable by its parent subprocess.
ObjC.import('ApplicationServices');

function run(argv) {
  const pid = Number(argv[0]);
  const request = JSON.parse(argv[1]);
  if (!Number.isInteger(pid) || pid <= 0) throw Error('Invalid WhatsApp process.');
  if (!$.AXIsProcessTrusted()) throw Error('APPLE_ACCESSIBILITY_REQUIRED');
  const app = $.AXUIElementCreateApplication(pid);
  $.AXUIElementSetMessagingTimeout(app, 0.12);
  let deadline = Date.now() + 2200;
  let count = 0;
  function check() {
    if (Date.now() > deadline) throw Error('WhatsApp took too long to expose its controls. Try again.');
  }
  function attr(node, key) {
    check();
    const value = Ref();
    const error = $.AXUIElementCopyAttributeValue(node, $(key), value);
    return error ? null : ObjC.castRefToObject(value[0]);
  }
  function scalar(node, key) {
    const value = attr(node, key);
    if (value === null) return '';
    const plain = ObjC.unwrap(value);
    return typeof plain === 'string' || typeof plain === 'boolean' ? plain : '';
  }
  function norm(value) {
    return String(value || '').normalize('NFKC').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function children(node) {
    const items = attr(node, 'AXChildren');
    const result = [];
    if (items) for (let i = 0; i < Number(items.count); i++) result.push(items.objectAtIndex(i));
    return result;
  }
  function visit(node, path, depth) {
    if (++count > 1600 || depth > 28) throw Error('WhatsApp’s control layout is too large to verify safely.');
    const item = {handle: path, role: scalar(node, 'AXRole'), title: scalar(node, 'AXTitle'),
      description: scalar(node, 'AXDescription'), value: scalar(node, 'AXValue'),
      placeholder: scalar(node, 'AXPlaceholderValue'), identifier: scalar(node, 'AXIdentifier'),
      enabled: scalar(node, 'AXEnabled') !== false, selected: scalar(node, 'AXSelected') === true};
    item.children = children(node).map((child, i) => visit(child, path + '.' + i, depth + 1));
    return item;
  }
  function window() {
    let windows = attr(app, 'AXWindows');
    for (let i = 0; (!windows || Number(windows.count) === 0) && i < 3; i++) {
      Application('WhatsApp').activate(); delay(0.2);
      windows = attr(app, 'AXWindows');
    }
    if (!windows || Number(windows.count) !== 1) throw Error('Keep one WhatsApp window open and close its dialogs.');
    return windows.objectAtIndex(0);
  }
  function all(node) { return [node].concat(...children(node).map(all)); }
  function header(root) {
    return all(root).filter(n => scalar(n, 'AXIdentifier') === 'NavigationBar_HeaderViewButton');
  }
  function verifyRecipient(root) {
    if (!request.contact) return;
    const headers = header(root);
    function same(value) {
      const left = norm(value), right = norm(request.contact);
      const phone = /^\+?[1-9][0-9 ()\-]{6,22}$/;
      return left === right || (phone.test(left) && phone.test(right) && left.replace(/\D/g, '') === right.replace(/\D/g, ''));
    }
    if (headers.length !== 1 || !['AXTitle', 'AXDescription', 'AXValue'].some(k => same(scalar(headers[0], k))))
      throw Error('The WhatsApp recipient changed. No message was sent.');
  }
  function resolve(root, target) {
    const parts = String(target.handle).split('.').map(Number);
    if (parts.shift() !== 0 || parts.some(n => !Number.isInteger(n) || n < 0)) throw Error('Invalid WhatsApp control.');
    let node = root;
    for (const index of parts) {
      node = children(node)[index];
      if (!node) throw Error('WhatsApp’s layout changed. No message was sent.');
    }
    for (const [field, key] of [['role', 'AXRole'], ['identifier', 'AXIdentifier'], ['title', 'AXTitle'], ['description', 'AXDescription']]) {
      if (scalar(node, key) !== (target[field] || '')) throw Error('The selected WhatsApp control changed. No message was sent.');
    }
    return node;
  }
  if (request.operation === 'show_search') {
    const existing = all(window()).filter(n => scalar(n, 'AXIdentifier') === 'TokenizedSearchBar_TextView');
    if (existing.length === 1) {
      // The Search menu toggles Catalyst's search mode. Focusing an existing
      // field avoids switching filtering off on the second spoken request.
      const focused = $.AXUIElementSetAttributeValue(existing[0], $('AXFocused'), $(true));
      const pressed = $.AXUIElementPerformAction(existing[0], $('AXPress'));
      if (focused === 0 || pressed === 0) return '{}';
    }
    const menu = attr(app, 'AXMenuBar');
    const matches = all(menu).filter(n => norm(scalar(n, 'AXTitle')) === 'search');
    if (matches.length !== 1 || $.AXUIElementPerformAction(matches[0], $('AXPress')))
      throw Error('Open WhatsApp’s Chats tab and choose Search, then try again.');
    return '{}';
  }
  const root = window();
  if (request.operation === 'snapshot') return JSON.stringify(visit(root, '0', 0));
  verifyRecipient(root);
  const node = resolve(root, request.node);
  if (request.operation === 'set_value') {
    if (scalar(node, 'AXValue') !== request.node.value) throw Error('The WhatsApp draft changed. No message was sent.');
    const identifier = scalar(node, 'AXIdentifier');
    if (identifier === 'TokenizedSearchBar_TextView') {
      if (/[\x00-\x1f\x7f]/.test(request.value)) throw Error('Use a single contact name without control characters.');
      // Catalyst's search control is AXStaticText and has no settable AXValue.
      // Use text events only while that exact search field remains focused.
      const focused = attr(app, 'AXFocusedUIElement');
      if (!focused || scalar(focused, 'AXIdentifier') !== identifier) throw Error('Focus WhatsApp’s Search field and try again.');
      const events = Application('System Events');
      const processes = events.applicationProcesses.whose({bundleIdentifier: 'net.whatsapp.WhatsApp'});
      function requireSearchFocus() {
        if (processes.length !== 1 || !processes[0].frontmost()) throw Error('WhatsApp is not focused.');
        const current = attr(app, 'AXFocusedUIElement');
        if (!current || scalar(current, 'AXIdentifier') !== identifier) throw Error('WhatsApp’s Search focus changed.');
      }
      requireSearchFocus();
      events.keystroke('a', {using: 'command down'});
      requireSearchFocus();
      events.keyCode(51);
      delay(0.1);
      requireSearchFocus();
      events.keystroke(request.value);
    } else if ($.AXUIElementSetAttributeValue(node, $('AXValue'), $(request.value))) {
      throw Error('WhatsApp did not accept text in its message field. No message was sent.');
    }
  } else if (request.operation === 'press') {
    if (request.draft !== undefined) {
      const composers = all(root).filter(n => scalar(n, 'AXIdentifier') === 'ChatBar_ComposerTextView');
      if (composers.length !== 1 || scalar(composers[0], 'AXValue') !== request.draft)
        throw Error('The WhatsApp draft changed. No message was sent.');
    }
    if ($.AXUIElementPerformAction(node, $('AXPress'))) throw Error('WhatsApp could not activate the verified control.');
  } else throw Error('Unsupported WhatsApp operation.');
  return '{}';
}
