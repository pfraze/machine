var sec = require('../security');
var util = require('../util');
var feedcfg = require('./feedcfg');

module.exports = {
	setup: setup,
	render: render,
	selectItem: selectItem
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
		return false;
	});
}

function render(layout) {
	if (layout == _layout) return;
	_layout = layout;
	switch (_layout) {
		case 'content':
			// tear down meta view
			$(document.body).off('click', onClickMetaView);
			$('#meta-views').hide();

			// setup content view
			$('#content-views').removeClass('col-xs-3').addClass('col-xs-10');
			renderContentFeed();
			break;

		case 'meta':
			// tear down content view
			$('#content-views').removeClass('col-xs-10').addClass('col-xs-3');

			// setup meta view
			$('#meta-views').show();
			$(document.body).on('click', onClickMetaView);
			renderMetaFeed();

			// select first item
			if ($('.directory-links-list .directory-item-slot.selected').length === 0) {
				$('.directory-links-list .directory-item-slot:first-child').addClass('selected');
			}
			renderSelectionViews();
			break;
	}
}

function selectItem(index) {
	$('.directory-links-list .selected').removeClass('selected');
	$('.directory-links-list .directory-item-slot:nth-child('+index+')').addClass('selected');
	render('meta');
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
		var title = util.escapeHTML(mediaLink.title || mediaLink.id || prettyHref(mediaLink.href));
		var $slot =  $(
			'<div id="slot-'+mediaLinkIndex+'" class="directory-item-slot">'+
				'<a class="title" href="#feed/'+mediaLinkIndex+'" method="SELECT">'+title+'</a>'+
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
		var title = util.escapeHTML(mediaLink.title || mediaLink.id || prettyHref(mediaLink.href));
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
	return false;
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
		$view.html(sec.sanitizeHtml(view, '#'+$view.attr('id')));
	});
	return req;
}

// helper
function prettyHref(href) {
	var hrefd = local.parseUri(href);
	return hrefd.authority + hrefd.relative;
}