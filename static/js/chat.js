;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Chat.ui Server
// ==============
var util = require('../util');
var pagent = require('./pagent');
var linkRegistry = require('./linkregistry');
var roomhostUA = local.agent('httpl://appcfg').follow({ rel: 'todo.com/rel/roomhost' });

var server = servware();
module.exports = server;

server.route('/', function(link, method) {
	link({ href: '/', rel: 'self service todo.com/rel/chatui', title: 'Local Chat UI' });

	method('HEAD', allowDocument, function() { return 204; });
	method('EMIT', allowDocument, validate, sendToChathost, clearInput, render);
	method('RECV', allowChatHost, validate, render);
});

server.route('/index/:id', function(link, method) {
	link({ href: '/', rel: 'up via service todo.com/rel/chatui', title: 'Local Chat UI' });
	link({ href: '/index/:id', rel: 'self item' });

	method('HEAD', allowDocument, function() { return 204; });
	method('ENABLE', allowDocument, toggleIndexEntryCB(true));
	method('DISABLE', allowDocument, toggleIndexEntryCB(false));
});

function allowDocument(req, res) {
	var origin = req.header('Origin');
	if (!origin) return true; // allow from document
	throw 403;
}

function allowChatHost(req, res) {
	var origin = req.header('Origin');
	if (!origin) return true; // allow from document
	return roomhostUA.resolve().then(function(url) {
		if (origin == url) return true; // allow chathost
		throw 403;
	});
}

function validate(req, res) {
	if (!req.body.msg) { throw [422, 'Must pass a json or form object with a `.msg` string.']; }
	return true;
}

function sendToChathost(req, res) {
	return roomhostUA.dispatch({ method: 'EMIT', body: req.body.msg }).then(function() { return true; });
}

function clearInput(req, res) {
	// :TODO: would be WAY better to do this with a 205 response that resets the originating form
	// but this works because EMIT can only come from the document
	$('#chat-in').val('');
	return true;
}

var urlRegex = /(\S+:\/\/\S+)/g;
function render(req, res) {
	// Extract URLs, convert to links and add to our page index
	var autoEnable = true; // :TODO: only if added by current user
	var msg = util.escapeQuotes(util.escapeHTML(req.body.msg))
		.replace(urlRegex, function(URL) {
			var entry = linkRegistry.loadUri(URL, autoEnable);
			return '<a href="'+URL+'" target="_blank">'+URL+'</a> <a class="label label-default" method="ENABLE" href="httpl://chat.ui/index/'+entry.id+'"><b class="glyphicon glyphicon-off"></b></a>';
		});

	// :TODO: username
	var user = 'pfraze';
	$('#chat-out').prepend([
		'<div class="chat-message"><strong>'+user+'</strong>: '+msg+'</div>',
	].join(''));
	return 204;
}

function toggleIndexEntryCB(show) {
	return function (req, res) {
		if (show) {
			linkRegistry.enableEntry(req.params.id);
		} else {
			linkRegistry.disableEntry(req.params.id);
		}
		return 204;
	};
}
},{"../util":7,"./linkregistry":2,"./pagent":5}],2:[function(require,module,exports){
/**
 * Link registry
 */

module.exports = {};
var linkRegistry = [];
local.util.mixinEventEmitter(module.exports);

var naReltypesRegex = /(^|\b)(self|via|up)(\b|$)/g;
module.exports.loadUri = function(uri, autoEnable) {
	// Create the entry
	var entry = {
		id: linkRegistry.length,
		uri: uri,
		links: [],
		active: false
	};
	linkRegistry.push(entry);

	// Fetch the URI
	local.HEAD(uri).always(function(res) {
		// Index the received self links
		var selfLinks = local.queryLinks(res, { rel: 'self' });
		if (!selfLinks.length) {
			// Default data
			selfLinks = [{ rel: 'todo.com/rel/media', href: uri }];
			if (res.header('Content-Type')) {
				selfLinks[0].type = res.header('Content-Type');
			}
		} else if (selfLinks.length > 10) {
			console.warn('Received '+selfLinks.length+' "self" links from '+uri+' - truncating to 10.');
			selfLinks.length = 10;
		}

		// Prep links
		selfLinks.forEach(function(link) {
			link['index-entry'] = entry.id;
			// Strip non-applicable reltypes
			link.rel = link.rel.replace(naReltypesRegex, '');
		});
		entry.links = selfLinks;

		// Autoenable
		if (autoEnable) {
			module.exports.enableEntry(entry.id);
		}
	});

	return entry;
};

module.exports.enableEntry = function(id) {
	if (linkRegistry[id] && !linkRegistry[id].active) {
		// Enable
		linkRegistry[id].active = true;
		module.exports.emit('add', linkRegistry[id]);

		// Update GUI
		var $btn = $('#chat-out [href="httpl://chat.ui/index/'+id+'"]');
		$btn.removeClass('label-default').addClass('label-primary').attr('method', 'DISABLE');
	}
};
module.exports.disableEntry = function(id) {
	if (linkRegistry[id] && linkRegistry[id].active) {
		// Disable
		linkRegistry[id].active = false;
		module.exports.emit('remove', linkRegistry[id]);

		// Update GUI
		var $btn = $('#chat-out [href="httpl://chat.ui/index/'+id+'"]');
		$btn.addClass('label-default').removeClass('label-primary').attr('method', 'ENABLE');
	}
};

module.exports.populateLinks = function(arr) {
	linkRegistry.forEach(function(entry) {
		if (!entry.active) return;
		entry.links.forEach(function(link) {
			arr.push(link);
		});
	});
};
},{}],3:[function(require,module,exports){
// Environment Setup
// =================
var pagent = require('./pagent.js');
local.logAllExceptions = true;
pagent.setup();

// Servers
local.addServer('worker-bridge', require('./worker-bridge.js'));
local.addServer('chat.ui', require('./chat.ui'));
local.addServer('mediastream.app', require('./mediastream.app'));

// httpl://appcfg
// - hosts an index for the application's dev-configged endpoints
(function() {
	var appcfg = servware();
	local.addServer('appcfg', appcfg);
	appcfg.route('/', function(link) {
		link({ href: 'httpl://roomhost.fixture', rel: 'todo.com/rel/roomhost', title: 'Chat Room Host' });
		link({ href: 'httpl://chat.ui', rel: 'todo.com/rel/chatui', title: 'Local Chat UI' });
	});
})();

// :TEMP: httpl://roomhost.fixture
(function() {
	var roomhost = servware();
	local.addServer('roomhost.fixture', roomhost);
	roomhost.route('/', function(link, method) {
		link({ href: '/', rel: 'self service todo.com/rel/roomhost', title: 'Chat Room Host' });
		method('EMIT', function() { return 200; });
	});
})();

// Configure via chat
local.dispatch({ method: 'RECV', url: 'httpl://chat.ui', body: { msg: 'Welcome! Let\'s get you setup. httpl://mediastream.app' } });
},{"./chat.ui":1,"./mediastream.app":4,"./pagent.js":5,"./worker-bridge.js":6}],4:[function(require,module,exports){
// MediaStream.app Server
// ======================
var util = require('../util');
var pagent = require('./pagent');
var linkRegistry = require('./linkregistry');

var server = servware();
module.exports = server;

server.route('/', function(link, method) {
	link({ href: '/', rel: 'self service todo.com/rel/agent todo.com/rel/agent/app', title: 'Media-stream' });
});
},{"../util":7,"./linkregistry":2,"./pagent":5}],5:[function(require,module,exports){
// Page Agent (PAgent)
// ===================
var util = require('../util');
var linkRegistry = require('./linkregistry');

var currentApp = false;
var activeApps = {}; // linkRegistryEntryId -> link object

function setup() {
	// Traffic logging
	local.setDispatchWrapper(function(req, res, dispatch) {
		var res_ = dispatch(req, res);
		res_.then(
			function() { console.log(req, res); },
			function() { console.error(req, res); }
		);
	});

	// Request events
	try { local.bindRequestEvents(document.body); }
	catch (e) { console.error('Failed to bind body request events.', e); }
	document.body.addEventListener('request', function(e) {
		dispatchRequest(e.detail, null, $(e.target));
	});

	// Link registry events
	linkRegistry.on('add', onLinksAdded);
	linkRegistry.on('remove', onLinksRemoved);

	// :DEBUG:
	// linkRegistry.loadUri('httpl://mediastream.app-agent', true);
}

function onLinksAdded(entry) {
	// Check for applications
	var appLink = local.queryLinks(entry.links, { rel: 'todo.com/rel/agent/app' })[0];
	if (appLink) {
		activeApps[entry.id] = appLink;
		if (currentApp === false) {
			currentApp = entry.id;
		}
		renderAppsNav();
	}
}

function onLinksRemoved(entry) {
	// Remove from our apps if present
	if (activeApps[entry.id]) {
		delete activeApps[entry.id];
		if (currentApp === entry.id) {
			currentApp = Object.keys(activeApps)[0] || false;
		}
		renderAppsNav();
	}
}

function renderAppsNav() {
	var html = [];
	for (var entryId in activeApps) {
		app = activeApps[entryId];
		html.push('<li'+((currentApp == entryId)?' class="active"':'')+'><a href="#">'+(app.title||app.id||app.href)+'</a></li>');
	}
	$('#apps-nav').html(html.join(''));
}

function renderResponse(req, res) {
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
				return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+util.makeSafe(res.body)+'</code></pre>';
			return '<pre>'+util.makeSafe(res.body)+'</pre>';
		} else {
			return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+util.makeSafe(JSON.stringify(res.body))+'</code></pre>';
		}
	}
	return res.status + ' ' + res.reason;
}

var iframeCounter = 0;
function createIframe(originHost) {
	var html = [
		'<div id="iframerow-'+iframeCounter+'" class="chat-gui">',
			'<div class="panel panel-default">',
				'<div class="panel-body">',
					'<iframe id="iframe-'+iframeCounter+'" seamless="seamless" sandbox="allow-popups allow-same-origin allow-scripts" data-origin="'+originHost+'"><html><body></body></html></iframe>',
				'</div>',
			'</div>',
		'</div>'
	].join('');
	// ^ sandbox="allow-same-origin allow-scripts" allows the parent page to reach into the iframe
	// CSP and script stripping occurs in renderIframe()
	iframeCounter++;
	$('#gui-out').append(html);
	return $('#gui-out iframe').last();
}

function getNextIframeId() {
	return iframeCounter;
}

var hostURL = window.location.protocol + '//' + window.location.host;
function renderIframe($iframe, html) {
	// html = '<link href="'+hostURL+'/css/bootstrap.css" rel="stylesheet">'+html;
	// <link href="'+hostURL+'/css/iframe.css" rel="stylesheet">
	html = '<meta http-equiv="Content-Security-Policy" content="default-src *; style-src * \'unsafe-inline\'; script-src \'self\'; object-src \'none\'; frame-src \'none\';" />'+html;
	html = '<base href="'+$iframe.data('origin')+'">'+html;
	// ^ script-src 'self' enables the parent page to reach into the iframe
	html = util.stripScripts(html); // CSP stops inline or remote script execution, but we still want to stop inclusions of scripts from our domain
	$iframe.attr('srcdoc', html);

	// :HACK: everything below here in this function kinda blows

	// Size the iframe to its content
	function sizeIframe() {
		this.height = null; // reset so we can get a fresh measurement

		var oh = this.contentWindow.document.body.offsetHeight;
		var sh = this.contentWindow.document.body.scrollHeight;
		// for whatever reason, chrome gives a minimum of 150 for scrollHeight, but is accurate if below that. Whatever.
		this.height = ((sh == 150) ? oh : sh) + 'px';

		// In 100ms, do it again - it seems styles aren't always in place
		var self = this;
		setTimeout(function() {
			var oh = self.contentWindow.document.body.offsetHeight;
			var sh = self.contentWindow.document.body.scrollHeight;
			self.height = ((sh == 150) ? oh : sh) + 'px';
		}, 100);
	}
	$iframe.load(sizeIframe);

	// Bind request events
	// :TODO: can this go in .load() ?
	var attempts = 0;
	var bindPoller = setInterval(function() {
		try {
			local.bindRequestEvents($iframe.contents()[0].body);
			$iframe.contents()[0].body.addEventListener('request', iframeRequestEventHandler);
			clearInterval(bindPoller);
		} catch(e) {
			attempts++;
			if (attempts > 100) {
				console.error('Failed to bind iframe events, which meant FIVE SECONDS went by the browser constructing it. Who\'s driving this clown-car?');
				clearInterval(bindPoller);
			}
		}
	}, 50); // wait 50 ms for the page to setup
}

function iframeRequestEventHandler(e) {
	var iframeEl = $(e.target)[0].ownerDocument.defaultView.frameElement;
	//               ^ :TODO: uh, did I $ wrap and dewrap this Element for no reason?
	var $iframe = $(iframeEl);
	var req = e.detail;
	prepIframeRequest(req, $iframe);
	dispatchRequest(req, $iframe, $(e.target));
}

function prepIframeRequest(req, $iframe) {
	if ($iframe.data('origin')) {
		// Put origin into the headers
		req.headers.from = $iframe.data('origin');
	}
}

function dispatchRequest(req, $iframe, $target) {
	var target = req.target; // local.Request() will strip `target`
	var body = req.body; delete req.body;

	if (!req.headers) { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }
	req = (req instanceof local.Request) ? req : (new local.Request(req));

	// Relative link? Make absolute
	if (!local.isAbsUri(req.url)) {
		var baseurl = ($iframe.data('origin')) ? $iframe.data('origin') : (window.location.protocol + '//' + window.location.host);
		req.url = local.joinUri(baseurl, req.url);
	}

	// Handle request based on target and origin
	var res_;
	req.urld = req.urld || local.parseUri(req.url);
	var newOrigin = (req.urld.protocol != 'data') ? (req.urld.protocol || 'httpl')+'://'+req.urld.authority : null;
	if ($iframe && (!target || target == '_self')) {
		// In-place update
		res_ = local.dispatch(req);
		res_.always(function(res) {
			$iframe.data('origin', newOrigin);
			renderIframe($iframe, renderResponse(req, res));
		});
	} else if (target == '_child') {
		// New iframe
		res_ = local.dispatch(req);
		res_.always(function(res) {
			var $newIframe = createIframe(newOrigin);
			renderIframe($newIframe, renderResponse(req, res));
			return res;
		});
	} else if ((!$iframe && !target) || target == '_null') {
		// Null target, simple dispatch
		res_ = local.dispatch(req);
	} else {
		console.error('Invalid request target', target, req, origin);
		return null;
	}

	req.end(body);
	return res_;
}

module.exports = {
	setup: setup,
	createIframe: createIframe,
	renderIframe: renderIframe,
	getNextIframeId: getNextIframeId,
	dispatchRequest: dispatchRequest
};
},{"../util":7,"./linkregistry":2}],6:[function(require,module,exports){
// Worker Bridge
// =============
// handles requests from the worker
var linkRegistry = require('./linkregistry');
var indexChangeEvents = new local.EventHost();

module.exports = function(req, res, worker) {
	var fn = (req.path == '/') ? hostmap : proxy;
	fn(req, res, worker);
};

// Hook up registry events to the hosted event-stream
linkRegistry.on('add', function(entry) {
	indexChangeEvents.emit('add', { id: entry.id, links: entry.links });
});
linkRegistry.on('remove', function(entry) {
	indexChangeEvents.emit('remove', { id: entry.id });
});

function hostmap(req, res, worker) {
	var via = [{proto: {version:'1.0', name:'HTTPL'}, hostname: req.header('Host')}];
	if (req.method != 'HEAD' && req.method != 'GET' && req.method != 'SUBSCRIBE') {
		return res.writeHead(405).end();
	}

	// Generate index
	var links = [];
	links.push({ href: '/', rel: 'self service via', title: 'Host Page', noproxy: true });
	linkRegistry.populateLinks(links);

	// Respond
	res.setHeader('Link', links);
	res.setHeader('Via', via);
	res.header('Proxy-Tmpl', 'httpl://host.page/{uri}');
	if (['GET', 'SUBSCRIBE'].indexOf(req.method) != -1 && local.preferredType(req, ['text/event-stream'])) {
		res.writeHead(200, 'OK', {'Content-Type': 'text/event-stream'});
		indexChangeEvents.addStream(res);
	} else {
		res.writeHead(204).end();
	}
}

function proxy(req, res, worker) {
	var via = [{proto: {version:'1.0', name:'HTTPL'}, hostname: req.header('Host')}];

	// Proxy the request through
	var req2 = new local.Request({
		method: req.method,
		url: decodeURIComponent(req.path.slice(1)),
		query: local.util.deepClone(req.query),
		headers: local.util.deepClone(req.headers),
		stream: true
	});

	// Check perms
	// :DEBUG: temporary, simple no external
	var urld = local.parseUri(req2.url);
	if (urld.protocol == 'http' || urld.protocol == 'https') {
		res.writeHead(403, 'Forbidden', { 'Content-Type': 'text/plain' });
		res.end('External requests currently disabled.');
		return;
	}

	// Set headers
	req2.header('Origin', 'httpl://'+worker.config.domain);
	req2.header('Via', (req.parsedHeaders.via||[]).concat(via));

	var res2_ = local.dispatch(req2);
	res2_.always(function(res2) {
		// Set headers
		res2.header('Link', res2.parsedHeaders.link); // use parsed headers, since they'll all be absolute now
		res2.header('Via', via.concat(res2.parsedHeaders.via||[]));
		res2.header('Proxy-Tmpl', ((res2.header('Proxy-Tmpl')||'')+' httpl://host.page/{uri}').trim());

		// Pipe back
		res.writeHead(res2.status, res2.reason, res2.headers);
		res2.on('data', function(chunk) { res.write(chunk); });
		res2.on('end', function() { res.end(); });
		res2.on('close', function() { res.close(); });
	});
	req.on('data', function(chunk) { req2.write(chunk); });
	req.on('end', function() { req2.end(); });
}
},{"./linkregistry":2}],7:[function(require,module,exports){

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

module.exports = {
	escapeHTML: escapeHTML,
	makeSafe: escapeHTML,
	escapeQuotes: escapeQuotes,
	stripScripts: stripScripts
};
},{}]},{},[3])
;