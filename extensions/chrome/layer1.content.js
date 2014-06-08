console.log('Layer 1 extension loaded');

// Overlay state
// =============
var _origin = chrome.extension.getURL('').slice(0, -1); // slice off trailing slash
var _overlay = {
	open: false,
	iframe: null
};
_overlay.iframe = document.createElement('iframe');
_overlay.iframe.id = 'layer1-overlay';
_overlay.iframe.src =  chrome.extension.getURL('layer1.overlay.html');
_overlay.iframe.seamless = true;
document.body.appendChild(_overlay.iframe);

// Load assets
// ===========
function injectScript(src, cb) {
	var s = document.createElement('script');
	s.src = chrome.extension.getURL(src);
	if (cb) s.onload = cb;
	(document.head||document.documentElement).appendChild(s);
}
function injectStyle(href, cb) {
	var s = document.createElement('link');
	s.href = chrome.extension.getURL(href);
	s.rel = 'stylesheet';
	s.type = 'text/css';
	if (cb) s.onload = cb;
	(document.head||document.documentElement).appendChild(s);
}
injectStyle('layer1.content.css');

// Keyboard shortcuts
// ==================
document.addEventListener('keydown', function(e) {
	if (e.shiftKey && e.ctrlKey && e.keyIdentifier == 'Down') {
		openOverlay();
	}
});

// Messaging
// =========
window.addEventListener('message', function(e) {
	if (e.origin != _origin) return;
	if (e.data.close) {
		closeOverlay();
	}
});
function sendMessage(msg) {
	_overlay.iframe.contentWindow.postMessage(msg, _origin);
}

// Overlay Methods
// ===============
var lastOverflow;
function openOverlay() {
	if (!_overlay.open) {
		console.log('Opening overlay');

		lastOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		_overlay.iframe.style.display = 'block';
		_overlay.open = true;
		sendMessage({ open: true });
	}
}
function closeOverlay() {
	if (_overlay.open) {
		console.log('Closing overlay');

		document.body.style.overflow = lastOverflow;
		document.body.setAttribute('tabindex', '-1');
		document.body.focus();

		_overlay.iframe.style.display = 'none';
		_overlay.open = false;
	}
}