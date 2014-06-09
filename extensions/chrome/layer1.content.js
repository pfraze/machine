console.log('Layer 1 extension loaded');
var _pageLinks;
var _userLinks = [
	// :DEBUG:
	{ href: 'https://layer1.io', rel: 'service', title: 'First name greatest. Last name ever.', query: 'greatest ever' }
];

// Prototype mods
// ==============
NodeList.prototype.map = function(fn) { return Array.prototype.map.call(this, fn); };
NamedNodeMap.prototype.toObject = function() {
	var attrs = {};
	for (var i=0; i < this.length; i++) {
		attrs[this.item(i).name] = this.item(i).value;
	}
	return attrs;
};

// Injectors
// =========
function injectScript(src, cb) {
	var s = document.createElement('script');
	s.src = chrome.extension.getURL(src);
	if (cb) s.onload = cb;
	(document.head||document.documentElement).appendChild(s);
}
function injectLink(attrs, cb) {
	var link = document.createElement('link');
	for (var k in attrs) {
		link.setAttribute(k, attrs[k]);
	}
	if (cb) link.onload = cb;
	(document.head||document.documentElement).appendChild(link);
}
function scrubLink(attrs) { // currently not much use, since I cant run it before the scripts run
	var linkEls = document.getElementsByTagName('link');
	for (var i=0; i < linkEls.length; i++) {
		var match = true;
		for (var k in attrs) {
			if (linkEls[i].getAttribute(k) != attrs[k]) {
				match = false;
				break;
			}
		}
		if (match) {
			linkEls[i].parentNode.removeChild(linkEls[i]);
		}
	}
}

// Inject configured links
// =======================
_userLinks.forEach(injectLink);

// Extract page links
// ==================
document.addEventListener("DOMContentLoaded", function(event) {
	_pageLinks = document.querySelectorAll('head link, body link').map(getAttrs);
	console.log('page links', _pageLinks);
});
var dummyAnchorEl = document.createElement('a');
function getAttrs(el) {
	// Extract values
	var attrs = el.attributes.toObject();

	// Correct relative URLs
	if (attrs.href) {
		dummyAnchorEl.href = attrs.href;
		attrs.href = dummyAnchorEl.href;
	}

	return attrs;
}

// Messaging
// =========
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.getLinks) {
		console.log('getLinks');
		sendResponse({ userLinks: _userLinks, pageLinks: _pageLinks });
	}
});