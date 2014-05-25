var sec = require('../security');
var mimetypes = require('../mimetypes');
var util = require('../util');
var feedcfg = require('./feedcfg');
var cache = require('./cache');

module.exports = {
	setup: setup,
	render: render
};

var _media_links = null;
var _active_renderer_links = null;
var _active_program_links = null;
var _agent_link = null;
var _default_agent_link = { href: '#gui/defagent', rel: 'layer1.io/agent' };
var _active_agent = null;
var _mode;/*
_mode = "list";  // rendering all items with 1 view each
_mode = "item";  // 1 item in "context," rendering views on right
*/
var _sortReversed = true; // chronological or reverse-chrono?
var _fetchproxy = local.client('/').service('.fetch', { rel: 'layer1.io/proxy' });
function setup(mediaLinks) {
	_media_links = mediaLinks;
	render('list'); // rendering all items with 1 view each

	// Setup program editor
	var $input = $('#program-input');
	$input.on('focus', onProgramInputFocus);
	$input.on('blur', onProgramInputBlur);
	$input.on('keyup', onProgramInputKeyup);
	$input.on('change', onProgramInputChange);
	$('#run-program-btn').on('click', onRunProgramButtonClick);

	// Setup agent view
	var $agentView = $('#agent-view');
	$agentView.on('request', onViewRequest);
}

// Services
local.at('#gui/program', function(req, res, worker) {
	// Headers
	res.link([
		{ href: '#', rel: 'service via layer1.io/page' },
		{ href: '#gui/program', rel: 'self collection layer1.io/program' }
	].concat(_active_program_links));

	if (req.HEAD || req.GET) {
		res.s204().end();
	} else {
		res.s405().Allow('HEAD, GET').end();
	}
});
local.at('#gui/defagent', function(req, res, worker) {
	res.link('#gui/defagent', 'self service layer1.io/agent');
	if (req.HEAD || !req.params.target) return res.s204().end();
	HEAD(req.params.target)
		.then(function(res2) {
			var html = res2.links.query('item').map(function(link) {
				var title = util.escapeHTML(link.title || link.id || '');
				var type = util.escapeHTML(link.type || '');
				var href = util.escapeHTML(link.href || '');
				return [
					'<p>',
						title, ' ',
						(type) ? ('<span class="label label-default">'+type+'</span>') : '', ' ',
						'<a href="'+href+'" target="_blank">', href, '</a>',
					'</p>'
				].join('');
			}).join('');
			res.s200().html(html).end();
		})
		.fail(function(res2) {
			res2.pipe(res);
		});
});
local.at('#gui/testagent', function(req, res, worker) {
	res.link('#gui/testagent', 'self service layer1.io/agent');
	if (req.HEAD || !req.params.target) return res.s204().end();
	HEAD(req.params.target)
		.then(function(res2) {
			res.s200().html('test').end();
		})
		.fail(function(res2) {
			res2.pipe(res);
		});
});
local.at('#gui/testagent2', function(req, res, worker) {
	res.link('#gui/testagent2', 'self service layer1.io/agent');
	if (req.HEAD || !req.params.target) return res.s204().end();
	HEAD(req.params.target)
		.then(function(res2) {
			res.s200().html('test2').end();
		})
		.fail(function(res2) {
			res2.pipe(res);
		});
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
		// tear down program mode
		$('#program-view').hide();

		// setup list mode
		$('#list-views').show();
		// renderListViews();
		break;

	case 'program':
		// tear down list mode
		$('#list-views').hide();

		// setup program mode
		$('#program-view').show();

		// extract queries
		var queries = extractProgramQueries($('#program-input').val());
		console.debug('Extracted the following queries from your posted program:', queries);

		// resolve all queries
		var links = resolveProgramQueries(queries)
		console.debug('Queries resolved to:', links);
		links = local.processLinks(links);

		// Run new program
		setActiveProgramLinks(links);
		runAgent(links.get('layer1.io/agent') || _default_agent_link);

		break;
	}

	// show index nav
	renderIndexSidenav();
}

function resolveProgramQueries(queries) {
	return queries.map(function(query) {
		var link = feedcfg.findLink(query);
		if (!link) {
			// :TODO: how is this handled?
			console.error('Query failed:', query);
			return null;
		}
		return link;
	});
}

function setActiveProgramLinks(links) {
	_active_program_links = links;
}

function runAgent(link) {
	// Prep output region
	_agent_link = link;
	var $view = $('#agent-view');
	$view.data('view', link.href);

	// Set active agent client and GET the view
	_active_agent = local.client(link.href);
	var req = _active_agent.GET({ target: 'http://page#gui/program' })
		.always(renderViewRes.bind(null, $view));
}

function renderListViews() {
	var $list = $('#list-views');
	$list.empty(); // clear out
	$('#url-input').val('');

	function renderView(mediaLinkIndex, mediaLink, rendererLink) {
		var title = util.escapeHTML(mediaLink.title || mediaLink.id || prettyHref(mediaLink.href));
		var mediaHref = util.escapeHTML(mediaLink.href);
		var rendererHref = util.escapeHTML(rendererLink.href);
		var $slot =  $(
			'<div id="slot-'+mediaLinkIndex+'" class="directory-item-slot">'+
				'<a class="title" href="'+mediaHref+'" target="_blank"><b class="glyphicon glyphicon-file"></b>'+title+'</a>'+
				'<div id="view-'+mediaLinkIndex+'" class="view" data-view="'+rendererHref+'">Loading...</div>'+
			'</div>'
		);
		$list.append($slot);
		$slot.find('.view').on('request', onViewRequest);
		_active_renderer_links[rendererLink.href] = rendererLink;

		var renderRequest = { method: 'GET', url: rendererLink.href, params: { target: '#feed/'+mediaLinkIndex } };
		viewDispatch(renderRequest, rendererLink, $slot.find('.view'));
	}

	_active_renderer_links = {};
	for (var i = 0; i < _media_links.length; i++) {
		var mediaLinkIndex = (_sortReversed) ? (_media_links.length - i - 1) : i;
		var mediaLink = _media_links[mediaLinkIndex];
		var rendererLink = feedcfg.findRenderer(mediaLink);

		renderView(mediaLinkIndex, mediaLink, rendererLink);
	}
}

function renderViewRes($view, res) {
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

function renderProgramLoadErrors(ress) {
	// :TODO:
	console.error('One of the bitches failed');

			/*if (res instanceof local.IncomingResponse) {
				$views.html('<h4>Error: '+util.escapeHTML(res.status||0)+' '+util.escapeHTML(res.reason||'')+'</h4>');
			} else {
				$views.html('<h4>Error: '+res.toString()+'</h4>');
			}*/
	throw ress;
}

function extractProgramQueries() {
	var $input = $('#program-input');
	var program = $input.val();
	return program.split('\n') // expect each line to be a url
		.map(function(str) { return str.trim(); })
		.filter(function(str) { return !!str; });
}

function autoSizeProgramInput() {
	var $input = $('#program-input');
	$input.prop('rows', Math.max($input.val().split('\n').length, 2)); // lazy alg
}

function onProgramInputFocus(e) {
	// Auto-expand
	autoSizeProgramInput();
}

function onProgramInputBlur(e) {
}

function onProgramInputKeyup(e) {
	// Auto-expand
	autoSizeProgramInput();
}

function onProgramInputChange(e) {
	console.log('TODO');
}

function onRunProgramButtonClick() {
	render('program');
}

function onViewRequest(e) {
	var $view = $(this);
	var href = $view.data('view');
	var link = ($view.attr('id') == 'agent-view') ? _agent_link : _active_renderer_links[href];
	viewDispatch(e.originalEvent.detail, link, $view);
	return false;
}

// Helper to send requests to a renderer or from its rendered views
// - req: obj, the request
// - rendererLink: obj, the link to the view origin
// - $view: jquery element, the view element
function viewDispatch(req, rendererLink, $view) {
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
	req.end(body).always(renderViewRes.bind(null, $view));
	return req;
}

// helper
function prettyHref(href) {
	var hrefd = local.parseUri(href);
	return hrefd.authority + hrefd.relative;
}