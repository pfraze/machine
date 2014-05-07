(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var globals = require('./globals');

module.exports = {
	setup: function() {
		if (globals.session.user) {
			$('.profile-btn').text(globals.session.user).css('display', 'inline-block');
			$('.show-on-authed').show();
			$('.auth-btn').text('Logout').on('click', function() {
				// :TODO:
			});
		} else {
			$('.auth-btn').removeClass('btn-default').addClass('btn-success').on('click', function() {
				// :TODO:
			});
		}

		if (globals.session.isPageAdmin) {
			$('.show-on-admin').show();
		}
	}
};
},{"./globals":6}],2:[function(require,module,exports){
var util = require('../util');

module.exports = {
	setup: function() {},
	get: function() { return _cfg; },
	findRenderers: findRenderers,
	findRenderer: findRenderer
};

// The active feed config
var _cfg = {
	renderers: local.util.table(
		['href',           'rel',                'title', 'for'],
		'#thing-renderer', 'layer1.io/renderer', 'Thing', 'schema.org/Thing',
		'#about-renderer', 'layer1.io/renderer', 'About', 'stdrel.com/media'
		// rel(contains)stdrel.com/media,type(starts)text(or)application
		// href(protocol_is)https,href(domain_is)
	)
};

function findRenderers(targetLink, maxMatches) {
	var matches = [];
	for (var i=0; i < _cfg.renderers.length; i++) {
		var g = _cfg.renderers[i];
		if (!g.for) continue;
		if (typeof g.for == 'string' && g.for[0] == '{' || g.for[0] == '[' || g.for[0] == '"') {
			try { g.for = JSON.parse(g.for); }
			catch (e) {}
		}
		if (local.queryLink(targetLink, g.for)) {
			matches.push(g);
			if (matches.length >= maxMatches)
				return matches;
		}
	}
	return matches;
}

function findRenderer(targetLink) {
	return findRenderers(targetLink, 1)[0];
}
},{"../util":11}],3:[function(require,module,exports){
var sec = require('../security');
var util = require('../util');
var feedcfg = require('./feedcfg');

module.exports = {
	setup: setup,
	renderMetaFeed: renderMetaFeed,
	renderSelectionViews: renderSelectionViews
};

var _mediaLinks;
var _activeRendererLinks;
var _layout; // meta: titles on left, selected item renders views on right
             // content: views are rendered in a vertical stack
var _sortReversed; // chronological or reverse-chrono?
function setup(mediaLinks) {
	_mediaLinks = mediaLinks;
	_activeRendererLinks = null;
	_sortReversed = true; // default newest to oldest
	render('content'); // default show content inline

	// :DEBUG:
	$('#toggle-layout').on('click',function() {
		render(_layout == 'content' ? 'meta' : 'content');
	});
}

function render(layout) {
	_layout = layout;
	switch (_layout) {
		case 'content':
			// tear down meta view
			$(document.body).off('click', onClickMetaView);
			$('#meta-views').hide();

			// setup content view
			$('#content-views').removeClass('col-xs-3').addClass('col-xs-11');
			renderContentFeed();
			break;

		case 'meta':
			// tear down content view
			$('#content-views').removeClass('col-xs-11').addClass('col-xs-3');

			// setup meta view
			$('#meta-views').show();
			$(document.body).on('click', onClickMetaView);
			renderMetaFeed();

			// select first item
			$('.directory-links-list .directory-item-slot:first-child').addClass('selected');
			renderSelectionViews();
			break;
	}
}

function renderContentFeed() {
	var $list = $('.directory-links-list');
	$list.empty(); // clear out

	var lastDate = new Date(0);
	function renderDateLine(mediaLink) {
		var then = new Date(+mediaLink.created_at);
		if (isNaN(then.valueOf())) then = lastDate;

		if (then.getDay() != lastDate.getDay() || (lastDate.getYear() == 69 && then.getYear() != 69)) {
			// add date entry
			$list.append(
				'<div class="directory-time">'+
					then.getFullYear()+'/'+(then.getMonth()+1)+'/'+then.getDate()+
				'</div>'
			);
		}
		lastDate = then;
	}

	function renderView(mediaLinkIndex, mediaLink, rendererLink) {
		var title = util.escapeHTML(mediaLink.title || mediaLink.id || 'Untitled');
		var $slot =  $(
			'<div id="slot-'+mediaLinkIndex+'" class="directory-item-slot">'+
				'<span class="title">'+title+'</span>'+
				'<div id="view-'+mediaLinkIndex+'" class="view" data-view="'+rendererLink.href+'">Loading...</div>'+
			'</div>'
		);
		$list.append($slot);
		$slot.on('request', onViewRequest);
		_activeRendererLinks[rendererLink.href] = rendererLink;

		var renderRequest = { method: 'GET', url: rendererLink.href, params: { target: '#feed/'+mediaLinkIndex } };
		rendererDispatch(renderRequest, rendererLink, $slot.find('.view'));
	}

	_activeRendererLinks = {};
	for (var i = 0; i < _mediaLinks.length; i++) {
		var mediaLinkIndex = (_sortReversed) ? (_mediaLinks.length - i - 1) : i;
		var mediaLink = _mediaLinks[mediaLinkIndex];
		var rendererLink = feedcfg.findRenderer(mediaLink);

		renderDateLine(rendererLink);
		renderView(mediaLinkIndex, mediaLink, rendererLink);
	}
}

function renderMetaFeed() {
	var $list = $('.directory-links-list');
	$list.empty(); // clear out

	var lastDate = new Date(0);
	function renderDateLine(mediaLink) {
		var then = new Date(+mediaLink.created_at);
		if (isNaN(then.valueOf())) then = lastDate;

		if (then.getDay() != lastDate.getDay() || (lastDate.getYear() == 69 && then.getYear() != 69)) {
			// add date entry
			$list.append(
				'<div class="directory-time">'+
					then.getFullYear()+'/'+(then.getMonth()+1)+'/'+then.getDate()+
				'</div>'
			);
		}
		lastDate = then;
	}

	function renderView(mediaLinkIndex, mediaLink, rendererLink) {
		var title = util.escapeHTML(mediaLink.title || mediaLink.id || 'Untitled');
		$list.append('<div id="slot-'+mediaLinkIndex+'" class="directory-item-slot"><span class="title">'+title+'</span></div>');
	}

	for (var i = 0; i < _mediaLinks.length; i++) {
		var mediaLinkIndex = (_sortReversed) ? (_mediaLinks.length - i - 1) : i;
		var mediaLink = _mediaLinks[mediaLinkIndex];
		var rendererLink = feedcfg.findRenderer(mediaLink);

		renderDateLine(rendererLink);
		renderView(mediaLinkIndex, mediaLink, rendererLink);
	}
}

function renderSelectionViews() {
	// Get selected item
	var $sel = $('.directory-links-list .selected');
	var mediaLinkIndex = $sel[0].id.slice(5);
	var mediaLink = _mediaLinks[mediaLinkIndex];
	if (!mediaLink) { console.error('Media link not found for selection'); return; }

	// Gather views for the selection
	_activeRendererLinks = {};
	var matches = feedcfg.findRenderers(mediaLink);
	for (var j=0; j < matches.length; j++) {
		_activeRendererLinks[matches[j].href] = matches[j];
	}

	// Create view spaces
	var $views = $('#meta-views');
	$views.empty();
	var i = 0;
	for (var href in _activeRendererLinks) {
		var rendererLink = _activeRendererLinks[href];

		var $view = createViewEl(rendererLink);
		$views.append($view);
		$view.on('request', onViewRequest);

		var renderRequest = { method: 'GET', url: href, params: { target: '#feed/'+mediaLinkIndex } };
		rendererDispatch(renderRequest, rendererLink, $view);
	}
}

// create div for view
function createViewEl(rendererLink) {
	return $('<div class="view" data-view="'+rendererLink.href+'">Loading...</div>');
}

function onViewRequest(e) {
	var $view = $(this);
	var href = $view.data('view');
	rendererDispatch(e.detail, _activeRendererLinks[href], $view);
}

function onClickMetaView(e) {
	if (_layout != 'meta')
		return; // only applies to meta view

	// select slot if target is a slot
	var slotEl = local.util.findParentNode.byClass(e.target, 'directory-item-slot');
	if (slotEl) {
		$('.directory-links-list .selected').removeClass('selected');
		slotEl.classList.add('selected');

		renderSelectionViews();
	}
	return false;
}

// Helper to send requests to a renderer or from its rendered views
// - req: obj, the request
// - rendererLink: obj, the link to the renderer
// - $view: jquery element, the view element
function rendererDispatch(req, rendererLink, $view) {
	var reqUrld      = local.parseUri(req.url);
	var reqDomain    = reqUrld.protocol + '://' + reqUrld.authority;
	var rendererUrld   = local.parseUri(rendererLink.href);
	var rendererDomain = rendererUrld.protocol + '://' + rendererUrld.authority;

	// audit request
	// :TODO: must be to renderer

	// prep request
	var body = req.body;
	delete req.body;
	req = new local.Request(req);

	if (!req.headers.Accept) { req.Accept('text/html, */*'); }

	if (!local.isAbsUri(req.headers.url)) {
		req.headers.url = local.joinUri(rendererDomain, req.headers.url);
	}

	// dispatch
	req.bufferResponse();
	req.end(body).always(function(res) {
		// output final response to GUI
		var view = res.body;
		if (view) {
			view = (view && typeof view == 'object') ? JSON.stringify(view) : (''+view);
		} else {
			var reason;
			if (res.reason) { reason = res.reason; }
			else if (res.status >= 200 && res.status < 400) { reason = 'success'; }
			else if (res.status >= 400 && res.status < 500) { reason = 'bad request'; }
			else if (res.status >= 500 && res.status < 600) { reason = 'error'; }
			view = reason + ' <small>'+res.status+'</small>';
		}

        // sanitize
		$view.html(sec.sanitizeRendererView(view, '#'+$view.attr('id')));
	});
	return req;
}
},{"../security":10,"../util":11,"./feedcfg":2}],4:[function(require,module,exports){
var globals = require('../globals');
var util = require('../util');
var gui = require('./gui');
var mediaLinks = local.queryLinks(document, 'stdrel.com/media');

// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();
require('../http-headers').setup();
require('./feedcfg').setup();
require('./renderers'); // :DEBUG:

// ui
gui.setup(mediaLinks);

// :TEMP:
local.at('#todo', function(req, res) { alert('Todo'); res.s204().end(); });


// server starting-point
function auth(req, res, worker) {
	// check action id
	req.actid = extractActId(req);
	if (req.actid === false) {
		res.s401('must reuse Authorization header in incoming request for all outgoing requests').end();
		return false;
	}
	// :TODO:
	req.act = null;// executor.get(worker ? worker.getUrl() : true, req.actid); // worker DNE, req came from page so allow
	if (!req.act) {
		res.s403('invalid actid - expired or not assigned to this worker').end();
		return false;
	}
	return true;
}

// toplevel
local.at('#', function (req, res, worker) {
	res.link(
		['href',    'id',      'rel',                       'title'],
		'#',        undefined, 'self service via',          'Host Page',
		'#target',  'target',  'service layer1.io/target',  'Target for Rendering',
		'#feed',    'feed',    'service layer1.io/feed',    'Current Feed',
		'#service', 'service', 'service layer1.io/service', 'Layer1 Toplevel Service'
	);
	res.s204().end();
});

// feed items
local.at('#feed/?(.*)', function (req, res, worker) {
	// :TODO:
	// if (!auth(req, res, worker)) return;
	var itemid = req.pathd[1];

	if (itemid) {
		if (!mediaLinks[itemid]) { return res.s404().end(); }
		var link = local.util.deepClone(mediaLinks[itemid]);
		res.link(
			['href', 'id',      'rel',                       'title'],
			'/',     undefined, 'service via',               'Host Page',
			'/feed', 'feed',    'up service layer1.io/feed', 'Current Feed'
		);
		serveItem(req, res, link);
	}
	else {
		var links = local.util.deepClone(mediaLinks);
		res.link(
			['href', 'id',      'rel',                         'title'],
			'/',     undefined, 'up service via',              'Host Page',
			'/feed', 'feed',    'self service layer1.io/feed', 'Current Feed'
		);
		serveCollection(req, res, links);
	}
});

// service proxy
local.at('#service', function (req, res, worker) {
	if (!auth(req, res, worker)) return;
	// :TODO:
	res.s501().end();
});

// collection behavior
function serveCollection(req, res, links, opts) {
	opts = opts || {};
	var uris = {};

	// set headers
	res.link(links);

	// :TODO: check permissions

	// route method
	if (req.HEAD) return res.s204().end();
	if (req.GET)  return res.s204().end(); // :TODO:
	if (req.POST) {
		var post = globals.pageClient
			.POST(req.params)
			.ContentType(req.ContentType)
			.then(function(res2) {
				res.Location(res2.Location);
				res.s201('created').end();
			}, function(res2) { res2.pipe(res); });
		req.pipe(post);
		return;
	}

	res.Allow('HEAD, GET, POST');
	res.s405('bad method').end();
}

// item behavior
function serveItem(req, res, link, opts) {
	opts = opts || {};
	// update link references to point to this service
	var url = link.href;
	link.rel = 'self '+link.rel;

	// set headers
	res.link(link);

	// :TODO: check permissions

	// route method
	if (req.HEAD) return res.s204().end();
	if (req.GET) return GET(url, req.params).Accept(req.Accept).pipe(res);
	res.Allow('HEAD, GET');
	res.s405('bad method').end();
}

// helper
function extractActId(req) {
	var auth = req.Authorization;
	if (!auth) return false;

	var parts = auth.split(' ');
	if (parts[0] != 'Action' || !parts[1]) return false;

	return +parts[1] || false;
}
},{"../auth":1,"../globals":6,"../http-headers":7,"../pagent":8,"../util":11,"./feedcfg":2,"./gui":3,"./renderers":5}],5:[function(require,module,exports){
var util = require('../util');

// Thing renderer
local.at('#thing-renderer', function(req, res) {
	GET(req.params.target).always(function(res2) {
		res.s200().ContentType('html');
		var desc = [];
		var url = (res2.body.url) ? util.escapeHTML(res2.body.url) : '#';
		if (res2.body.description) { desc.push(util.escapeHTML(res2.body.description)); }
		if (res2.body.url) { desc.push('<a href="'+url+'">Link</a>'); }
		var html = [
			'<div class="media">',
				'<div class="media-body">',
					'<h4 class="media-heading">'+util.escapeHTML(res2.body.name)+'</h4>',
					((desc.length) ? '<p>'+desc.join('<br>')+'</p>' : ''),
				'</div>',
			'</div>'
		].join('');
		res.end(html);
	});
});
// Default renderer
local.at('#about-renderer', function(req, res) {
	HEAD(req.params.target)
		.always(function(res2) {
			var selfLink = res2.links.first('self');
			if (!selfLink) {
				return res.s502().ContentType('html').end('Bad target');
			}

			res.s200().ContentType('html');
			var html = '';

			// :DEBUG:
			html += '<style>.foo { font-weight: bold }</style>';
			html += '<p class="foo" style="color: orange">foo!</p>';

			if (selfLink.rel == 'self stdrel.com/media') {
				var mime = selfLink.type || 'text/plain';
				if (mime == 'text/plain') mime = 'plain-text';
				else mime = mime.split('/')[1];
				html += '<p>Raw media ('+mime+') - nothing else is known about this file.</p>';
			} else if (selfLink.is('stdrel.com/rel')) {
				html += '<p>This is a "relation type." It explains how a location on the Web behaves, and is the basis of Layer1\'s structure.</p>';
			}

			if (selfLink.id) { html += '<small class="text-muted">ID</small> '+util.escapeHTML(selfLink.id)+'<br>'; }
			if (selfLink.rel) {
				html += '<small class="text-muted">TYPE</small> '+util.decorateReltype(selfLink.rel);
				if (selfLink.type) { html += ' '+util.escapeHTML(selfLink.type); }
				html += '<br>';
			}
			if (selfLink.href) { html += '<small class="text-muted">HREF</small> <a href="'+util.escapeHTML(selfLink.href)+'" target=_blank>'+util.escapeHTML(selfLink.href)+'</a><br>'; }
			if (selfLink.created_at) { html += '<small class="text-muted">ADDED</small> '+((new Date(+selfLink.created_at)).toLocaleTimeString())+'<br>'; }

			res.end(html);
		});
});
},{"../util":11}],6:[function(require,module,exports){
var hostClient = local.client(window.location.protocol + '//' + window.location.host);
window.globals = module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	pageClient:       local.client(window.location.toString()),
	hostClient:       hostClient,
	authClient:       hostClient.service('auth'),
	meClient:         hostClient.item('.me'),
	fetchProxyClient: hostClient.service('.fetch'),
};
},{}],7:[function(require,module,exports){
module.exports = { setup: setup };
function setup() {
	local.httpHeaders.register('pragma',
		function serialize_pragma(obj) {
			var str, strs = [];
			for (var k in obj) {
				str = k;
				if (obj[k] !== true) {
					str += '="'+obj[k]+'"';
				}
				strs.push(str);
			}
			return strs.join(' ');
		},
		function parse_pragma(str) {
			//             "key"     "="      \""val\""    "val"
			//         -------------- -       ---------   -------
			var re = /([\-a-z0-9_\.]+)=?(?:(?:"([^"]+)")|([^;\s]+))?/g;
			var match, obj = {};
			while ((match = re.exec(str))) {
				obj[match[1]] = match[2] || match[3];
			}
			return obj;
		}
	);
}
},{}],8:[function(require,module,exports){
// Page Agent (PAgent)
// ===================
// Standard page behaviors
var util = require('./util');

function setup() {
	// Request events
	try { local.bindRequestEvents(document.body); }
	catch (e) { console.error('Failed to bind body request events.', e); }
	document.body.addEventListener('request', function(e) {
		console.log('toplevel request event', e); // :TODO:
		dispatchRequest(e.detail);
	});
}

function dispatchRequest(req, $region, $target) {
	var body = req.body; delete req.body;

	req = new local.Request(req);
	if (!req.headers.Accept) { req.Accept('text/html, */*'); }

	// Relative link? Make absolute
	if (!local.isAbsUri(req.headers.url)) {
		var baseurl = (window.location.protocol + '//' + window.location.host);
		req.headers.url = local.joinUri(baseurl, req.headers.url);
	}

	return local.dispatch(req).end(body);
}


module.exports = {
	setup: setup,
	dispatchRequest: dispatchRequest
};
},{"./util":11}],9:[function(require,module,exports){
// Policies for HTML rendered from untrusted sources
var policies = {

	// HTML Policies
	// =============
	allowedHtmlTags: [ // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/HTML5_element_list
		// metadata
		'style',

		// sections
		'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'header', 'footer', 'section', 'nav', 'article', 'aside', 'address',

		// grouping
		'hr', 'p', 'pre', 'blockquote',
		'ol', 'ul', 'li', 'dl', 'dt', 'dd',
		'figure', 'figcaption',
		'div',

		// text-level semantics
		'a', 'em', 'strong', 'small', 's',
		'cite', 'q', 'dfn', 'abbr',
		'data', 'time', 'code', 'var', 'samp', 'kbd',
		'sub', 'sup', 'i', 'b', 'u',
		'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo',
		'span', 'br', 'wbr',

		// edits
		'ins', 'del',

		// embedded content
		'img', 'video', 'audio', 'source', 'track',

		// tabular data
		'table', 'caption', 'colgroup', 'col',
		'tbody', 'thead', 'tfoot',
		'tr', 'td', 'th',

		// forms
		'form', 'fieldset', 'legend',
		'label', 'input', 'button', 'select',
		'datalist', 'optgroup', 'option',
		'textarea', 'keygen', 'output',
		'progress', 'meter'
	],
	disallowedClasses: [
		// Boostrap
		// because of position: fixed or position: absolute
		'affix', 'dropdown-backdrop', 'navbar-fixed-top', 'navbar-fixed-bottom',
		'modal', 'modal-backdrop',
		'carousel-control', 'carousel-indicators',
		'next', 'prev', // these are from .carousel-inner > .next

		// Custom
		'addlink-panel', 'config-panel'
	],
	urlsPolicy: function(url) { return url; }, // allow all
	tokensPolicy: function(token) {
		if (policies.disallowedClasses.indexOf(token) == -1) {
			return token;
		}
		console.warn('Removed disallowed id/class:', token);
	},
	htmlTagPolicy: function(tagName, attribs) {
		if (policies.allowedHtmlTags.indexOf(tagName) !== -1) {
			return {
				attribs: window.html.sanitizeAttribs(tagName, attribs, policies.urlsPolicy, policies.tokensPolicy)
			};
		} else {
			console.warn('Removed disallowed tag:', tagName);
		}
	},

	// CSS Policies
	// ============
	cssPropertyPolicy: function(decl) {
		var is = function(str) { return decl.property == str; };
		var starts = function(str) { return decl.property.indexOf(str) === 0; };
		var contains = function(str) { return decl.property.indexOf(str) !== -1; };

		if (contains('@')) return false;
		if (starts('background')) return true;
		if (starts('border')) return true;
		if (is('box-shadow')) return true;
		if (is('clear')) return true;
		if (is('color')) return true;
		if (is('content')) return true;
		if (is('display')) return true;
		if (is('direction')) return true;
		if (is('display')) return true;
		if (is('float')) return true;
		if (starts('font')) return true;
		if (is('height')) return true;
		if (is('letter-spacing')) return true;
		if (is('line-height')) return true;
		if (starts('list-style')) return true;
		if (starts('margin')) return true;
		if (starts('max-')) return true;
		if (starts('min-')) return true;
		if (is('opacity')) return true;
		if (starts('outline')) return true;
		if (starts('overflow')) return true;
		if (starts('padding')) return true;
		if (is('pointer-events')) return true;
		if (is('resize')) return true;
		if (is('table-layout')) return true;
		if (starts('text-')) return true;
		if (is('vertical-align')) return true;
		if (is('visibility')) return true;
		if (is('white-space')) return true;
		if (is('width')) return true;
		if (starts('word-')) return true;

		return false;
	},
	cssValuePolicy: function(decl) {
		var is = function(str) { return decl.value == str; };
		var starts = function(str) { return decl.value.indexOf(str) === 0; };
		var contains = function(str) { return decl.value.indexOf(str) !== -1; };

		if (contains('url')) return false;

		return true;
	}
};
module.exports = policies;
},{}],10:[function(require,module,exports){
var policies = require('./security-policies');

module.exports = {
	sanitizeRendererView: function(html, selectorPrefix) {
		var sanitize = makeHtmlSanitizer(
			policies.htmlTagPolicy,
			sanitizeStyles.bind(
				null,
				selectorPrefix,
				policies.cssPropertyPolicy,
				policies.cssValuePolicy
			)
		);

		var outputArray = [];
		sanitize(html, outputArray);
		return outputArray.join('');
	},
	sanitizeStyles: sanitizeStyles
};

// HTML sanitation
// ===============
var ampRe = /&/g;
var looseAmpRe = /&([^a-z#]|#(?:[^0-9x]|x(?:[^0-9a-f]|$)|$)|$)/gi;
var ltRe = /[<]/g;
var gtRe = />/g;
var quotRe = /\"/g;
function escapeAttrib(s) {
	return ('' + s).replace(ampRe, '&amp;').replace(ltRe, '&lt;')
		.replace(gtRe, '&gt;').replace(quotRe, '&#34;');
}

// Returns a function that strips unsafe tags and attributes from html.
// - `tagPolicy`: function(string, [string]) -> [string]
//   - A function that takes (tagName, attribs[]), where
//     - `tagName` is a key in html4.ELEMENTS
//     - `attribs` is an array of alternating attribute names and values.
//   - Should return a record (as follows) or null to delete the element.
//   - Can modify the attribs array
//   - Returned record:
//     - `attribs`: (required) Sanitized attributes array.
//     - `tagName`: Replacement tag name.
function makeHtmlSanitizer(tagPolicy, styleSanitizer) {
	var lastTag;
	var stack;
	var ignoring;
	var emit = function (text, out) {
		if (!ignoring) {
			if (lastTag == 'style' && styleSanitizer) {
				text = styleSanitizer(text);
			}
			out.push(text);
		}
	};
	return window.html.makeSaxParser({
		'startDoc': function(_) {
			stack = [];
			ignoring = false;
		},
		'startTag': function(tagNameOrig, attribs, out) {
			if (ignoring) { return; }
			if (!window.html4.ELEMENTS.hasOwnProperty(tagNameOrig)) { return; }
			var eflagsOrig = window.html4.ELEMENTS[tagNameOrig];
			if (eflagsOrig & window.html4.eflags['FOLDABLE']) {
				return;
			}

			var decision = tagPolicy(tagNameOrig, attribs);
			if (!decision) {
				ignoring = !(eflagsOrig & window.html4.eflags['EMPTY']);
				return;
			} else if (typeof decision !== 'object') {
				throw new Error('tagPolicy did not return object (old API?)');
			}
			if ('attribs' in decision) {
				attribs = decision['attribs'];
			} else {
				throw new Error('tagPolicy gave no attribs');
			}
			var eflagsRep;
			var tagNameRep;
			if ('tagName' in decision) {
				tagNameRep = decision['tagName'];
				eflagsRep = window.html4.ELEMENTS[tagNameRep];
			} else {
				tagNameRep = tagNameOrig;
				eflagsRep = eflagsOrig;
			}

			// If this is an optional-end-tag element and either this element or its
			// previous like sibling was rewritten, then insert a close tag to
			// preserve structure.
			if (eflagsOrig & window.html4.eflags['OPTIONAL_ENDTAG']) {
				var onStack = stack[stack.length - 1];
				if (onStack && onStack.orig === tagNameOrig &&
					(onStack.rep !== tagNameRep || tagNameOrig !== tagNameRep)) {
					out.push('<\/', onStack.rep, '>');
				}
			}

			if (!(eflagsOrig & window.html4.eflags['EMPTY'])) {
				stack.push({orig: tagNameOrig, rep: tagNameRep});
			}

			out.push('<', tagNameRep);
			for (var i = 0, n = attribs.length; i < n; i += 2) {
				var attribName = attribs[i],
				value = attribs[i + 1];
				if (value !== null && value !== void 0) {
					out.push(' ', attribName, '="', escapeAttrib(value), '"');
				}
			}
			out.push('>');

			lastTag = tagNameRep;

			if ((eflagsOrig & html4.eflags['EMPTY'])
				&& !(eflagsRep & html4.eflags['EMPTY'])) {
				// replacement is non-empty, synthesize end tag
				out.push('<\/', tagNameRep, '>');
			}
		},
		'endTag': function(tagName, out) {
			if (ignoring) {
				ignoring = false;
				return;
			}
			if (!window.html4.ELEMENTS.hasOwnProperty(tagName)) { return; }
			var eflags = window.html4.ELEMENTS[tagName];
			if (!(eflags & (window.html4.eflags['EMPTY'] | window.html4.eflags['FOLDABLE']))) {
				var index;
				if (eflags & window.html4.eflags['OPTIONAL_ENDTAG']) {
					for (index = stack.length; --index >= 0;) {
						var stackElOrigTag = stack[index].orig;
						if (stackElOrigTag === tagName) { break; }
						if (!(window.html4.ELEMENTS[stackElOrigTag] &
							  window.html4.eflags['OPTIONAL_ENDTAG'])) {
							// Don't pop non optional end tags looking for a match.
							return;
						}
					}
				} else {
					for (index = stack.length; --index >= 0;) {
						if (stack[index].orig === tagName) { break; }
					}
				}
				if (index < 0) { return; }  // Not opened.
				for (var i = stack.length; --i > index;) {
					var stackElRepTag = stack[i].rep;
					if (!(window.html4.ELEMENTS[stackElRepTag] &
						  window.html4.eflags['OPTIONAL_ENDTAG'])) {
						out.push('<\/', stackElRepTag, '>');
					}
				}
				if (index < stack.length) {
					tagName = stack[index].rep;
				}
				stack.length = index;
				out.push('<\/', tagName, '>');
			}
		},
		'pcdata': emit,
		'rcdata': emit,
		'cdata': emit,
		'endDoc': function(out) {
			for (; stack.length; stack.length--) {
				out.push('<\/', stack[stack.length - 1].rep, '>');
			}
		}
	});
}

// CSS Sanitiation
// ===============

function sanitizeStyles(selectorPrefix, propertyPolicy, valuePolicy, styles) {
	try {
		var ast = rework.parse(styles);
		removeUnsafeRules(ast, propertyPolicy, valuePolicy);
		if (selectorPrefix) {
			prefixSelectors(ast, selectorPrefix);
		}
		return rework.stringify(ast);
	} catch(e) {
		return '';
	}
}

function prefixSelectors(ast, prefix) {
	ast.stylesheet.rules.forEach(function(rule) {
		rule.selectors = rule.selectors.map(function(sel) { return prefix + ' ' + sel; });
	});
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/Reference
function removeUnsafeRules(ast, propertyPolicy, valuePolicy) {
	ast.stylesheet.rules.forEach(function(rule) {
		rule.declarations = rule.declarations.filter(function(decl) {
			if (!propertyPolicy(decl)) {
				console.warn('Stripping',decl,'due to unsafe property');
				return false;
			}
			if (!valuePolicy(decl)) {
				console.warn('Stripping',decl,'due to unsafe value');
				return false;
			}
			return true;
		});
	});
}
},{"./security-policies":9}],11:[function(require,module,exports){
var globals = require('./globals');

var lbracket_regex = /</g;
var rbracket_regex = />/g;
function escapeHTML(str) {
	return (''+str).replace(lbracket_regex, '&lt;').replace(rbracket_regex, '&gt;');
}

var quoteRegex = /"/g;
function escapeQuotes(str) {
	return (''+str).replace(quoteRegex, '&quot;');
}

var sanitizeHtmlRegexp = /<script(.*?)>(.*?)<\/script>/g;
function stripScripts (html) {
	// CSP stops inline or remote script execution, but we still want to stop inclusions of scripts on our domain
	// :TODO: this approach probably naive in some important way
	return html.replace(sanitizeHtmlRegexp, '');
}

function pad0(n, width, z) {
	// all glory to the hypnotoad
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function decorateReltype(str) {
	return str.split(' ').map(function(rel) {
		if (rel == 'up' || rel == 'self' || rel == 'current') return '';
		if (rel.indexOf('.') === -1) {
			return '<a href="http://www.iana.org/assignments/link-relations/link-relations.xhtml" target=_blank>'+rel+'</a>';
		}
		var href = (rel.indexOf(':') === -1) ? 'http://'+rel : rel;
		return '<a href="'+href+'" target=_blank>'+rel+'</a>';
	}).join(' ');
}

/*function renderResponse(req, res) {
	if (res.body !== '') {
		if (typeof res.body == 'string') {
			if (res.header('Content-Type').indexOf('text/html') !== -1)
				return res.body;
			if (res.header('Content-Type').indexOf('image/') === 0) {
				return '<img src="'+req.url+'">';
				// :HACK: it appears that base64 encoding cant occur without retrieving the data as a binary array buffer
				// - this could be done by first doing a HEAD request, then deciding whether to use binary according to the reported content-type
				// - but that relies on consistent HEAD support, which is unlikely
				// return '<img src="data:'+res.header('Content-Type')+';base64,'+btoa(res.body)+'">';
			}
			if (res.header('Content-Type').indexOf('javascript') !== -1)
				return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+escapeHTML(res.body)+'</code></pre>';
			return '<pre>'+escapeHTML(res.body)+'</pre>';
		} else {
			return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+escapeHTML(JSON.stringify(res.body))+'</code></pre>';
		}
	}
	return res.status + ' ' + res.reason;
}*/

function serializeRawMeta(obj) {
	var parts = [];
	for (var k in obj) {
		if (k == 'href') continue;
		parts.push(k+': '+obj[k]);
	}
	return parts.join('\n');
}

function parseRawMeta(str) {
	var obj = {};
	var re = /^([^:]*): ?(.*)/;
	str.split('\n').forEach(function(line, i) {
		var parse = re.exec(line);
		if (!parse) throw {line: 5, error: 'Bad line'};
		obj[parse[1]] = parse[2];
	});
	return obj;
}

var lookupReq;
var lookupAttempts;
function fetch(url, useHead) {
	if (url === null) {
		if (lookupReq) lookupReq.close();
		lookupAttempts = null;
		return;
	}

	var method = (useHead) ? 'HEAD' : 'GET';
	var p = local.promise();
	var urld = local.parseUri(url);
	if (!urld || !urld.authority) {
		p.fulfill(false); // bad url, dont even try it!
		return p;
	}

	var triedProxy = false;
	var attempts = lookupAttempts = [new local.Request({ method: method, url: url, binary: true })]; // first attempt, as given
	if (!urld.protocol) {
		// No protocol? Two more attempts - 1 with https, then one with plain http
		attempts.push(new local.Request({ method: method, url: 'https://'+urld.authority+urld.relative, binary: true }));
		attempts.push(new local.Request({ method: method, url: 'http://'+urld.authority+urld.relative, binary: true }));
	}

	function makeAttempt() {
		if (lookupReq) lookupReq.close();
		if (lookupAttempts != attempts) { // have we started a new set of attempts?
			console.log('Aborting lookup attempts');
			return;
		}
		lookupReq = attempts.shift();
		lookupReq.bufferResponse().end().always(handleAttempt);
	}
	makeAttempt();

	function handleAttempt(res) {
		if (res.status >= 200 && res.status < 300) {
			p.fulfill(res); // Done!
		} else if (!attempts.length && res.status === 0 && !triedProxy) {
			// May be a CORS issue, try the proxy
			triedProxy = true;
			globals.fetchProxyClient.resolve({ nohead: true }).always(function(proxyUrl) {
				if (!urld.protocol) {
					if (useHead) {
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative } }));
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative } }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					} else {
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					}
				} else {
					if (useHead) {
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, params: { url: url } }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, params: { url: url }, binary: true }));
					} else {
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, params: { url: url }, binary: true }));
					}
				}
				makeAttempt();
			});
		} else {
			// No dice, any attempts left?
			if (attempts.length) {
				makeAttempt(); // try the next one
			} else {
				p.fulfill(res); // no dice
			}
		}
	}

	return p;
}

module.exports = {
	escapeHTML: escapeHTML,
	makeSafe: escapeHTML,
	escapeQuotes: escapeQuotes,
	stripScripts: stripScripts,
	decorateReltype: decorateReltype,
	// renderResponse: renderResponse,

	pad0: pad0,

	serializeRawMeta: serializeRawMeta,
	parseRawMeta: parseRawMeta,

	fetch: fetch,
	fetchMeta: function(url) { return fetch(url, true); }
};
},{"./globals":6}]},{},[4])