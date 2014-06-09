// Gui State
// =========
var _pageLinks = [];
var _userLinks = [];
var _searchformEl = document.querySelector('#searchform');
var _pageLinksEl = document.querySelector('#page-links');
var _userLinksEl = document.querySelector('#user-links');

// Prototype mods
// ==============
Element.prototype.findParentNode = function(cls) {
	var node = this;
	while (node = node.parentNode) {
		if (node.classList.contains(cls)) {
			return node;
		}
	}
	return null;
};

// Gui Events
// ==========
_searchformEl.addEventListener('submit', function(e) {
	e.preventDefault();
	var input = _searchformEl.querySelector('input');
	// :TODO:
	input.value = '';
});
_userLinksEl.addEventListener('click', function(e) { onLinkClick(e, _userLinks); });
_pageLinksEl.addEventListener('click', function(e) { onLinkClick(e, _pageLinks); });
function onLinkClick(e, links) {
	e.preventDefault();
	var expandLink = links[e.target.dataset.expand];
	if (expandLink) {
		e.target.findParentNode('link').classList.toggle('expanded');
	}
	var removeLink = links[e.target.dataset.remove];
	if (removeLink) {
		e.target.findParentNode('link').classList.add('removed');
		// :TODO: disable in list
	}
	var restoreLink = links[e.target.dataset.restore];
	if (restoreLink) {
		e.target.findParentNode('link').classList.remove('removed');
		// :TODO: enable in list
	}
}

// Messaging
// =========
function postContentScript(msg) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id, msg, function(response) {
			if (response.pageLinks) _pageLinks = response.pageLinks;
			if (response.userLinks) _userLinks = response.userLinks;
			if (response.pageLinks || response.userLinks) render();
		});
	});
}

// Init
// ====
postContentScript({ getLinks: true });

// Rendering
// =========
function render() {
	_userLinksEl.innerHTML = _userLinks.map(renderLink).join('');
	_pageLinksEl.innerHTML = _pageLinks.map(renderLink).join('');
}
function renderLink(link, i) {
	var href    = escapeHTML(link.href);
	var title   = escapeHTML(link.title||link.href);
	var query   = escapeHTML(link.query||'');
	var attribs = escapeHTML(renderAttribs(link));
	return [
		'<div class="link">',
			'<h4><a href="#" data-expand="'+i+'">'+title+'</a></h4>',
			((query) ? '<p><em>'+query+'</em></p>' : ''),
			'<div class="details">',
				'<p>'+attribs+'</p>',
				'<p>',
					'<a href="#" data-remove="'+i+'">remove</a><a href="#" data-restore="'+i+'">restore</a>',
				'</p>',
			'</div>',
		'</div>'
	].join('');
}
function renderAttribs(link) {
	var html = [];
	for (var k in link) {
		if (link[k] === true) {
			html.push(k);
		} else if (typeof link[k] == 'string' && link[k].indexOf(' ') !== -1) {
			html.push(k + ': "' + link[k] + '"');
		} else {
			html.push(k + ': ' + link[k]);
		}
	}
	return html.join(', ');
}
var entityMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"/": '&#x2F;'
 };
function escapeHTML(str) {
	return String(str).replace(/[&<>"'\/]/g, function (s) {
		return entityMap[s];
	});
}