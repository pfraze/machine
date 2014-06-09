// Gui State
// =========
var _pageLinks = [];
var _userLinks = [];
var _searchLinks = [];
var _searchformEl = document.querySelector('#searchform');
var _searchresultsEl = document.querySelector('#searchresults');
var _pageLinksEl = document.querySelector('#page-links');
var _userLinksEl = document.querySelector('#user-links');

// Prototype mods
// ==============
Element.prototype.findParentNode = function(cls) {
	var node = this;
	var isId = (cls[0] == '#');
	if (isId) cls = cls.slice(1);
	while (node = node.parentNode) {
		if (isId && node.id == cls) {
			return node;
		}
		else if (node.classList && node.classList.contains(cls)) {
			return node;
		}
	}
	return null;
};
RegExp.quote = function(str) {
    return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

// Helpers
// =======
var entityMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"/": '&#x2F;'
 };
function escapeHTML(str) {
	return String(str||'').replace(/[&<>"'\/]/g, function (s) {
		return entityMap[s];
	});
}

// :DEBUG:
// =======
var _searchLinks = [
	{ href: 'https://layer1.io', rel: 'service', title: 'First name greatest. Last name ever.', query: 'greatest ever' }
].concat(JSON.parse('[{"rel":"search","type":"application/opensearchdescription+xml","href":"https://github.com/opensearch.xml","title":"GitHub"},{"rel":"fluid-icon","href":"https://github.com/fluidicon.png","title":"GitHub"},{"rel":"apple-touch-icon","sizes":"57x57","href":"https://github.com/apple-touch-icon-114.png"},{"rel":"apple-touch-icon","sizes":"114x114","href":"https://github.com/apple-touch-icon-114.png"},{"rel":"apple-touch-icon","sizes":"72x72","href":"https://github.com/apple-touch-icon-144.png"},{"rel":"apple-touch-icon","sizes":"144x144","href":"https://github.com/apple-touch-icon-144.png"},{"rel":"assets","href":"https://assets-cdn.github.com/"},{"rel":"conduit-xhr","href":"https://ghconduit.com:25035/"},{"rel":"xhr-socket","href":"https://github.com/_sockets"},{"rel":"icon","type":"image/x-icon","href":"https://assets-cdn.github.com/favicon.ico"},{"href":"https://assets-cdn.github.com/assets/github-1aeb426322c64c12b92d56bda5b110fc1093f75e.css","media":"all","rel":"stylesheet","type":"text/css"},{"href":"https://assets-cdn.github.com/assets/github2-b2cccfcac1a522b6ce675606f61388d36bf2c080.css","media":"all","rel":"stylesheet","type":"text/css"},{"href":"https://github.com/pfraze/machine/commits/master.atom?token=1270099__eyJzY2…LCJleHBpcmVzIjoyOTgwMjczODIxfQ==--e35b1db938b5551dee46d2ad30f15bdd93d8b2c2","rel":"alternate","title":"Recent Commits to machine:master","type":"application/atom+xml"}]'));
_searchLinks.forEach(function(link) {
	Object.defineProperty(link, '__str', { value: escapeHTML(renderAttribs(link)) });
});

// Gui Events
// ==========
_searchformEl.addEventListener('submit', function(e) {
	e.preventDefault();

	// Get query
	var input = _searchformEl.querySelector('input');
	if (!input.value) {
		document.body.classList.remove('searching');
		return;
	}
	var tokens = RegExp.quote(input.value||'').split(' ');

	// Run query
	var hit, hits = [], hitStrings = [];
	// var query = new RegExp('(^|\\b)(' + tokens.join('|') + ')(?=[^A-z0-9\\:]|$)', 'gi');
	var query = new RegExp('(' + tokens.join('|') + ')', 'gi');
	for (var i=0; i < _searchLinks.length; i++) {
		var matches = 0;
		var newStr = _searchLinks[i].__str.replace(query, function(all) {
			matches++;
			return '<b>'+all+'</b>';
		});
		if (matches) {
			hits.push({
				link: _searchLinks[i],
				matches: matches,
				str: newStr
			});
		}
	}

	document.body.classList.add('searching');
	if (hits.length) {
		// Rank and render
		hits.sort(function(a, b) { return b.matches - a.matches; });
		_searchresultsEl.innerHTML = hits.map(function(hit) {
			var link = hit.link;
			var href = escapeHTML(link.href||'');
			var title = escapeHTML(link.title||link.href||'');
			return '<div class="link">' +
				'<h4><a href="'+href+'" data-expand="'+i+'">'+title+'</a></h4>' +
				'<div class="details"><p>'+hit.str+'</p></div>' +
			'</div>';
		}).join('');
	} else {
		_searchresultsEl.innerHTML = '<p>No matches</p>';
	}
});
document.body.addEventListener('click', function(e) {
	if (e.target.findParentNode('#searchresults') === null) { document.body.classList.remove('searching'); }
});
_userLinksEl.addEventListener('click', function(e) { onLinkClick(e, _userLinks); });
_pageLinksEl.addEventListener('click', function(e) { onLinkClick(e, _pageLinks); });
function onLinkClick(e, links) {
	var expandLink = links[e.target.dataset.expand];
	if (expandLink && e.button === 0) {
		e.preventDefault();
		e.target.findParentNode('link').classList.toggle('expanded');
	}
	var removeLink = links[e.target.dataset.remove];
	if (removeLink) {
		e.preventDefault();
		e.target.findParentNode('link').classList.add('removed');
		// :TODO: disable in list
	}
	var restoreLink = links[e.target.dataset.restore];
	if (restoreLink) {
		e.preventDefault();
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
			'<h4><a href="'+href+'" data-expand="'+i+'">'+title+'</a></h4>',
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