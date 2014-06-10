// Gui State
// =========
self.pageLinks = [];
self.userLinks = [];
self.searchLinks = [];
self.searchResults = [];
self.selectedResult = false;
self.searchformEl = document.querySelector('#searchform');
self.searchresultsEl = document.querySelector('#searchresults');
self.pageLinksEl = document.querySelector('#page-links');
self.userLinksEl = document.querySelector('#user-links');

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
self.searchLinks = [
	{ href: 'https://layer1.io', rel: 'service', title: 'First name greatest. Last name ever.', query: 'greatest ever' }
].concat(JSON.parse('[{"rel":"search","type":"application/opensearchdescription+xml","href":"https://github.com/opensearch.xml","title":"GitHub"},{"rel":"fluid-icon","href":"https://github.com/fluidicon.png","title":"GitHub"},{"rel":"apple-touch-icon","sizes":"57x57","href":"https://github.com/apple-touch-icon-114.png"},{"rel":"apple-touch-icon","sizes":"114x114","href":"https://github.com/apple-touch-icon-114.png"},{"rel":"apple-touch-icon","sizes":"72x72","href":"https://github.com/apple-touch-icon-144.png"},{"rel":"apple-touch-icon","sizes":"144x144","href":"https://github.com/apple-touch-icon-144.png"},{"rel":"assets","href":"https://assets-cdn.github.com/"},{"rel":"conduit-xhr","href":"https://ghconduit.com:25035/"},{"rel":"xhr-socket","href":"https://github.com/_sockets"},{"rel":"icon","type":"image/x-icon","href":"https://assets-cdn.github.com/favicon.ico"},{"href":"https://assets-cdn.github.com/assets/github-1aeb426322c64c12b92d56bda5b110fc1093f75e.css","media":"all","rel":"stylesheet","type":"text/css"},{"href":"https://assets-cdn.github.com/assets/github2-b2cccfcac1a522b6ce675606f61388d36bf2c080.css","media":"all","rel":"stylesheet","type":"text/css"},{"href":"https://github.com/pfraze/machine/commits/master.atom?token=1270099__eyJzY2…LCJleHBpcmVzIjoyOTgwMjczODIxfQ==--e35b1db938b5551dee46d2ad30f15bdd93d8b2c2","rel":"alternate","title":"Recent Commits to machine:master","type":"application/atom+xml"}]'));
self.searchLinks.forEach(function(link) {
	Object.defineProperty(link, 'ATTRSTRING', { value: escapeHTML(renderAttribs(link)) });
});

// Business Logic
// ==============
var isUrlRegex = /\B\.\B/; // a dot in a word, like twitter.com or profile.png
function selectResult(i) {
	self.selectedResult = i;

	try { self.searchresultsEl.querySelector('.selected').classList.remove('selected'); }
	catch (e) {}

	if (selectedResult !== false) {
		try {
			var linkEls = self.searchresultsEl.querySelectorAll('.link');
			linkEls[self.selectedResult].classList.add('selected');
		} catch (e) {}
	}
}
function doSearch(e) {
	if (e) {
		e.preventDefault();
	}

	// Get query
	var input = self.searchformEl.querySelector('input');
	if (!input.value) {
		document.body.classList.remove('searching');
		return;
	}
	var tokens = RegExp.quote(input.value||'').split(' ');
	tokens.sort(function(a,b) { return b.length - a.length; }); // put longest first so substrings dont outperform them

	// Run query
	var hit;
	self.searchResults = [];
	// var query = new RegExp('(^|\\b)(' + tokens.join('|') + ')(?=[^A-z0-9\\:]|$)', 'gi');
	var query = new RegExp('(' + tokens.join('|') + ')', 'gi');
	for (var i=0; i < self.searchLinks.length; i++) {
		var numMatchingChars = 0;
		var hitTokens = {};
		var newStr = self.searchLinks[i].ATTRSTRING.replace(query, function(matchingTerm) {
			if (!hitTokens[matchingTerm]) {
				numMatchingChars += matchingTerm.length;
				if (isUrlRegex.test(matchingTerm)) {
					numMatchingChars += matchingTerm.length; // urls and filenames count double
				}
				hitTokens[matchingTerm] = true;
			}
			return '<b>'+matchingTerm+'</b>';
		});
		if (numMatchingChars) {
			console.log(numMatchingChars, self.searchLinks[i].ATTRSTRING);
			self.searchResults.push({
				link: self.searchLinks[i],
				numMatchingChars: numMatchingChars,
				str: newStr
			});
		}
	}

	document.body.classList.add('searching');
	if (self.searchResults.length) {
		// Rank and render
		self.searchResults.sort(function(a, b) { return b.numMatchingChars - a.numMatchingChars; });
		self.searchresultsEl.innerHTML = self.searchResults.map(function(hit) {
			var link = hit.link;
			var href = escapeHTML(link.href||'');
			var title = escapeHTML(link.title||link.href||'');
			return '<div class="link">' +
				'<h4><a href="'+href+'" data-expand="'+i+'">'+title+'</a></h4>' +
				'<div class="details"><p>'+hit.str+'</p></div>' +
			'</div>';
		}).join('');
	} else {
		self.searchresultsEl.innerHTML = '<p>No matches</p>';
	}
}

// Gui Events
// ==========
self.searchformEl.addEventListener('submit', doSearch);
self.searchformEl.querySelector('input').addEventListener('keydown', function(e) {
	if (e.keyIdentifier == 'Up' || e.keyIdentifier == 'Down') {
		// Interrupt event
		e.preventDefault();
		e.stopPropagation();
	}
	if (e.keyIdentifier == 'Down') {
		// Moving cursor to results
		e.target.blur();

		// Rerun with new content
		doSearch();
		selectResult(0);
	}
});
document.body.addEventListener('click', function(e) {
	if (e.target.findParentNode('#searchresults') === null) { document.body.classList.remove('searching'); }
});
document.body.addEventListener('keydown', function(e) {
	if (self.selectedResult !== false) {
		e.preventDefault();
		e.stopPropagation();

		var inputEl = self.searchformEl.querySelector('input');
		switch (e.keyIdentifier) {
			case 'Down':
				if (self.searchResults[self.selectedResult + 1]) {
					selectResult(self.selectedResult + 1);
				}
				break;
			case 'Up':
				if (self.searchResults[self.selectedResult - 1]) {
					selectResult(self.selectedResult - 1);
				} else {
					// Moving cursor back to search input
					selectResult(false);
					inputEl.focus();
					moveCursorToEnd(inputEl);
				}
				break;
			default:
				// Moving cursor back to search input
				selectResult(false);
				inputEl.focus();
				moveCursorToEnd(inputEl);

				// Replay command on the input
				redispatchKeyboardEvent(inputEl, e);
				break;
		}
	}
});
self.userLinksEl.addEventListener('click', function(e) { onLinkClick(e, self.userLinks); });
self.pageLinksEl.addEventListener('click', function(e) { onLinkClick(e, self.pageLinks); });
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
			if (response.pageLinks) self.pageLinks = response.pageLinks;
			if (response.userLinks) self.userLinks = response.userLinks;
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
	self.userLinksEl.innerHTML = self.userLinks.map(renderLink).join('');
	self.pageLinksEl.innerHTML = self.pageLinks.map(renderLink).join('');
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

// Utils
// =====
// http://stackoverflow.com/questions/13987380/how-to-to-initialize-keyboard-event-with-given-char-keycode-in-a-chrome-extensio
function redispatchKeyboardEvent(element, orig) {
	var event = document.createEvent('KeyboardEvents');
    event.initKeyboardEvent(
        /* type         */ orig.type,
        /* bubbles      */ true,
        /* cancelable   */ true,
        /* view         */ window,
        /* keyIdentifier*/ orig.keyIdentifier,
        /* keyLocation  */ orig.keyLocation,
        /* ctrlKey      */ orig.ctrlKey,
        /* altKey       */ orig.altKey,
        /* shiftKey     */ orig.shiftKey,
        /* metaKey      */ orig.metaKey,
        /* altGraphKey  */ orig.altGraphKey
    );
    // Define custom values
    // This part requires the script to be run in the page's context
    var getterCode = {get: function() {return charCode}};
    var getterChar = {get: function() {return String.fromCharCode(charCode)}};
    Object.defineProperties(event, {
        charCode: getterCode,
        which: getterChar,
        keyCode: getterCode, // Not fully correct
        key: getterChar,     // Not fully correct
        char: getterChar
    });

    element.dispatchEvent(event);
}

// http://css-tricks.com/snippets/javascript/move-cursor-to-end-of-input/
function moveCursorToEnd(el) {
    if (typeof el.selectionStart == "number") {
        el.selectionStart = el.selectionEnd = el.value.length;
    } else if (typeof el.createTextRange != "undefined") {
        el.focus();
        var range = el.createTextRange();
        range.collapse(false);
        range.select();
    }
}