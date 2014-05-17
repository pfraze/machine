var sec = require('../security');
var mimetypes = require('../mimetypes');
var util = require('../util');
var feedcfg = require('./feedcfg');
var cache = require('./cache');

module.exports = {
	setup: setup,
	render: render
};

var _mediaLinks;
var _activeRendererLinks;
var _mode;/*
_mode = "list";  // rendering all items with 1 view each
_mode = "item";  // 1 item in "context," rendering views on right
*/
var _itemModeUrl; // target of the item mode
var _itemReq; // current item - a request
var _sortReversed; // chronological or reverse-chrono?
function setup(mediaLinks) {
	_mediaLinks = mediaLinks;
	_activeRendererLinks = null;
	_sortReversed = true; // default newest to oldest
	render('list'); // rendering all items with 1 view each

	// :DEBUG:
	$('.reset-layout').on('click',function() {
		render('list');
		return false;
	});
}

// Services
local.at('#gui/context', function(req, res, worker) {
	if (worker) return res.s403('forbidden').end();

	if (req.PUT) {
		return req.buffer(function() {
			// Check we got a URL
			var url = req.params.url || req.body.url;
			if (!url) {
				return res.s400('`url` required in params or json').end();
			}

			// Switch into item mode
			render('item', { url: url });
			return res.s204().end();
		});
	}
	res.Allow('PUT');
	res.s405('bad method').end();
});
local.at('#gui/index', function(req, res, worker) {
	if (worker) return res.s403('forbidden').end();

	if (req.PUT) {
		return req.buffer(function() {
			// Check we got a URL
			var url = req.params.url || req.body.url;
			if (!url) {
				return res.s400('`url` required in params or json').end();
			}

			// Set index and re-render
			feedcfg.setIndex({ href: url });
			render();
			res.s204().end();
		});
	}
	res.Allow('PUT');
	res.s405('bad method').end();
});


function render(mode, opts) {
	opts = opts || {};
	_mode = mode || _mode;
	switch (_mode) {
	case 'list':
		// tear down item mode
		$('#item-views').hide();
		$('.reset-layout').hide();

		// setup list mode
		$('#list-views').show();
		renderListViews();
		break;

	case 'item':
		// tear down list mode
		$('#list-views').hide();

		// setup item mode
		$('#item-views').show();
		$('.reset-layout').show();
		_itemModeUrl = opts.url || _itemModeUrl;
		if (_itemModeUrl.indexOf(window.location.origin) === 0 || _itemModeUrl.indexOf('#') !== -1) {
			// current host or virtual, fetch directly
			_itemReq = GET(_itemModeUrl);
		} else {
			// public web, use fetch proxy
			_itemReq = GET(window.location.host + '/.fetch', { url: _itemModeUrl });
		}
		_itemReq.Accept('application/json, text/html, */*');
		cache.add(opts.url, _itemReq);
		renderItemViews();
		break;
	}

	// show index nav
	renderIndexSidenav();
}

function renderListViews() {
	var $list = $('#list-views');
	$list.empty(); // clear out
	$('#url-input').val('');

	function renderView(mediaLinkIndex, mediaLink, rendererLink) {
		var title = util.escapeHTML(mediaLink.title || mediaLink.id || prettyHref(mediaLink.href));
		var $slot =  $(
			'<div id="slot-'+mediaLinkIndex+'" class="directory-item-slot">'+
				'<a class="title" method="PUT" href="#gui/context?url='+mediaLink.href+'"><b class="glyphicon glyphicon-file"></b>'+title+'</a>'+
				'<div id="view-'+mediaLinkIndex+'" class="view" data-view="'+rendererLink.href+'">Loading...</div>'+
			'</div>'
		);
		$list.append($slot);
		$slot.find('.view').on('request', onViewRequest);
		_activeRendererLinks[rendererLink.href] = rendererLink;

		var renderRequest = { method: 'GET', url: rendererLink.href, params: { target: '#feed/'+mediaLinkIndex } };
		rendererDispatch(renderRequest, rendererLink, $slot.find('.view'));
	}

	_activeRendererLinks = {};
	for (var i = 0; i < _mediaLinks.length; i++) {
		var mediaLinkIndex = (_sortReversed) ? (_mediaLinks.length - i - 1) : i;
		var mediaLink = _mediaLinks[mediaLinkIndex];
		var rendererLink = feedcfg.findRenderer(mediaLink);

		renderView(mediaLinkIndex, mediaLink, rendererLink);
	}
}

function renderItemViews() {
	var itemUri = _itemModeUrl; // the views need to read from the right uri, so capture it now to account for possible state-changes during the async
	var $views = $('#item-views');
	var repaintTimeoutId = setTimeout($views.html.bind($views, '<h3>Fetching...</h3>'), 1500);
	$('#url-input').val(itemUri);
	_itemReq
		.then(function(res) {
			clearTimeout(repaintTimeoutId);

			var mediaLink = res.links.get('self');
			var linkIsAdded = false;
			if (!mediaLink) {
				mediaLink = {};
				res.links.push(mediaLink);
				linkIsAdded = true;
			}

			// Defaults
			if (!mediaLink.href) {
				mediaLink.href = itemUri;
			}
			if (!mediaLink.rel) mediaLink.rel = '';
			if (!local.queryLink(mediaLink, 'self')) {
				mediaLink.rel = 'self ' + mediaLink.rel;
			}
			if (!local.queryLink(mediaLink, 'stdrel.com/media')) {
				mediaLink.rel = 'stdrel.com/media ' + mediaLink.rel;
			}

			// Try to establish the mimetype
			if (!mediaLink.type) {
				var mimeType = res.ContentType;
				if (!mimeType) {
					mimeType = mimetypes.lookup(itemUri) || 'application/octet-stream';
				}
				var semicolonIndex = mimeType.indexOf(';');
				if (semicolonIndex !== -1) {
					mimeType = mimeType.slice(0, semicolonIndex); // strip the charset
				}
				mediaLink.type = mimeType;
			}

			// Now that link is settled, add to headers if needed
			if (linkIsAdded) {
				if (typeof res.Link == 'string') {
					res.Link = local.httpHeaders.serialize('link', [mediaLink]) + ((res.Link)?(','+res.Link):'');
				} else {
					if (!res.Link)
						res.Link = [];
					res.Link.push(mediaLink);
				}
			}

			// Gather views for the item
			_activeRendererLinks = {};
			var matches = feedcfg.findRenderers(mediaLink);
			for (var j=0; j < matches.length; j++) {
				_activeRendererLinks[matches[j].href] = matches[j];
			}

			// Create view spaces
			var i = 0;
			$views.empty();
			for (var href in _activeRendererLinks) {
				var rendererLink = _activeRendererLinks[href];

				var $view = createViewEl(rendererLink);
				$views.append($view);
				$view.on('request', onViewRequest);

				var renderRequest = { method: 'GET', url: href, params: { target: 'http://page#cache/'+itemUri } };
				rendererDispatch(renderRequest, rendererLink, $view);
			}
		})
		.fail(function(res) {
			if (res instanceof local.IncomingResponse) {
				$views.html('<h4>Error: '+util.escapeHTML(res.status||0)+' '+util.escapeHTML(res.reason||'')+'</h4>');
			} else {
				$views.html('<h4>Error: '+res.toString()+'</h4>');
			}
		});
}

function renderIndexSidenav() {
	var $nav = $('#index-sidenav');
	$nav.empty();
	feedcfg.get().indexLinks.forEach(function(indexLink) {
		var isActive = (indexLink.href == feedcfg.get().curIndex);
		$nav.append(
			'<li ' + (isActive?'class="active"':'') + '>' +
				'<a method=PUT href="#gui/index?url=' + encodeURIComponent(util.escapeHTML(indexLink.href)) + '">' +
					util.escapeHTML(indexLink.title || indexLink.id || indexLink.href) +
				'</a>' +
			'</li>'
		);
	});
}

// create div for view
function createViewEl(rendererLink) {
	return $('<div class="view" data-view="'+rendererLink.href+'"></div>');
}

function onViewRequest(e) {
	var $view = $(this);
	var href = $view.data('view');
	rendererDispatch(e.originalEvent.detail, _activeRendererLinks[href], $view);
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
	var rendererDomain = (rendererUrld.authority) ? (rendererUrld.protocol + '://' + rendererUrld.authority) : '';

	// audit request
	// :TODO: must be to renderer

	// prep request
	var body = req.body;
	delete req.body;
	req = new local.Request(req);

	if (!req.headers.Accept) { req.Accept('text/html, */*'); }

	if (!local.isAbsUri(req.headers.url)) {
		req.headers.url = local.joinRelPath(rendererUrld, req.headers.url);
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
		$view.html(sec.sanitizeHtml(view, '#'+$view.attr('id')));
	});
	return req;
}

// helper
function prettyHref(href) {
	var hrefd = local.parseUri(href);
	return hrefd.authority + hrefd.relative;
}