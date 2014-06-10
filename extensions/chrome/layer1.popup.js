// Gui State
// =========
self.pageLinks = [];
self.userLinks = [];
self.searchLinkSet = [];
self.searchResultSet = [];
self.selectedResult = false;
self.searchformEl = document.querySelector('#searchform');
self.linksEl = document.querySelector('#links');

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

// Business Logic
// ==============
var isUrlRegex = /\B\.\B/; // a dot in a word, like twitter.com or profile.png
function selectResult(i) {
	self.selectedResult = i;

	try { self.linksEl.querySelector('.selected').classList.remove('selected'); }
	catch (e) {}

	if (selectedResult !== false) {
		try {
			var linkEls = self.linksEl.querySelectorAll('.link');
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
		// Reset, render all links
		self.searchResultSet = self.searchLinkSet;
		self.linksEl.innerHTML = self.searchResultSet.map(renderLink).join('');
		return;
	}
	var tokens = RegExp.quote(input.value||'').split(' ').filter(function(str) { return str.trim().length; });
	tokens.sort(function(a,b) { return b.length - a.length; }); // put longest first so substrings dont outperform them

	// Run query
	var hit;
	self.searchResultSet = [];
	var query = new RegExp('(' + tokens.join('|') + ')', 'gi');
	for (var i=0; i < self.searchLinkSet.length; i++) {
		var score = 0;
		var hitTokens = {};

		// Score matching terms and wrap them in <b>s for newStr
		var newStr = self.searchLinkSet[i].ATTRSTRING.replace(query, function(matchingTerm) {
			// First hit in the link?
			if (!hitTokens[matchingTerm]) {
				// Score the match
				score += matchingTerm.length; // number of characters in the term
				if (isUrlRegex.test(matchingTerm)) {
					score += matchingTerm.length; // urls and filenames count double
				}
				hitTokens[matchingTerm] = true;
			}
			return '<b>'+matchingTerm+'</b>';
		});
		if (score) {
			// Store in results
			self.searchResultSet.push({
				index: i,
				link: self.searchLinkSet[i],
				score: score,
				str: newStr
			});
		}
	}

	if (self.searchResultSet.length) {
		// Rank and render
		self.searchResultSet.sort(function(a, b) { return b.score - a.score; });
		self.linksEl.innerHTML = self.searchResultSet.map(function(hit) {
			return renderLink(hit.link, hit.index, hit.str);
		}).join('');
	} else {
		self.linksEl.innerHTML = '<p>No matches</p>';
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
	if (e.target.findParentNode('#searchresultSet') === null) { document.body.classList.remove('searching'); }
});
document.body.addEventListener('keydown', function(e) {
	if (self.selectedResult !== false) {
		e.preventDefault();
		e.stopPropagation();

		var inputEl = self.searchformEl.querySelector('input');
		switch (e.keyIdentifier) {
			case 'Down':
				if (self.searchResultSet[self.selectedResult + 1]) {
					selectResult(self.selectedResult + 1);
				}
				break;
			case 'Up':
				if (self.searchResultSet[self.selectedResult - 1]) {
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
self.linksEl.addEventListener('click', function(e) {
	var removeLink = self.searchResultSet[e.target.dataset.remove];
	if (removeLink) {
		e.preventDefault();
		e.target.findParentNode('link').classList.add('removed');
		// :TODO: disable in list
	}
	var restoreLink = self.searchResultSet[e.target.dataset.restore];
	if (restoreLink) {
		e.preventDefault();
		e.target.findParentNode('link').classList.remove('removed');
		// :TODO: enable in list
	}
});

// Messaging
// =========
function postContentScript(msg) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id, msg, function(response) {
			console.log('got response', response);

			// :DEBUG:
			if (response.pageLinks) {
				// Searching links from the page (for now)
				self.searchLinkSet = response.pageLinks;
				self.searchLinkSet.forEach(function(link) {
					// Pre-create attributes string
					Object.defineProperty(link, 'ATTRSTRING', { value: escapeHTML(renderAttribs(link)) });
				});
				// Render all links
				self.searchResultSet = response.pageLinks;
				self.linksEl.innerHTML = self.searchResultSet.map(renderLink).join('');
			}
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
function renderLink(link, i, attrstring) {
	var href    = escapeHTML(link.href);
	var title   = escapeHTML(link.title||link.href);
	var query   = escapeHTML(link.query||'');
	var attribs = (typeof attrstring == 'string' && attrstring) ? attrstring : escapeHTML(renderAttribs(link));
	return [
		'<div class="link">',
			'<h4><a href="'+href+'" data-select="'+i+'">'+title+'</a></h4>',
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