(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var hostClient = web.client(window.location.protocol + '//' + window.location.host);
window.globals = module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	pageClient:       web.client(window.location.toString()),
	hostClient:       hostClient,
	authClient:       hostClient.service('auth'),
	meClient:         hostClient.item('.me'),
	fetchProxyClient: hostClient.service('.fetch'),
};
},{}],2:[function(require,module,exports){

var $iframe;
module.exports = {
	setup: setup,
};

function setup() {
	$iframe = $('#program-view iframe');
	$(window).on('resize', onWindowResize);
	onWindowResize();
}

function onWindowResize() {
	$iframe.height($(window).height() - 10);
}
},{}],3:[function(require,module,exports){
var globals = require('../globals');
var util = require('../util');

// Environment Setup
// =================
web.logAllExceptions = true;
require('./search').addIndex({ href: '#', rel: 'layer1.io/index', title: 'Builtins' }).then(function() {
	require('./gui').setup();
}).fail(function() {
	console.error('Failed to setup builtins index');
});

// toplevel - config host
function getSelf(res) { return res.links.get('self'); }
var indexLinks = [
	web.HEAD('/column-layouts.js#col3').always(getSelf),
	web.HEAD('/column-layouts.js#col2').always(getSelf),
	web.HEAD('/image-viewer.js#').always(getSelf),
	web.HEAD('/list-view.js#').always(getSelf),
	web.HEAD('/media-summaries.js#').always(getSelf),
	web.HEAD('/thumbnail-view.js#').always(getSelf)
];
web.export(main);
function main(req, res) {
	return indexLinks.always(function(links) {
		links = links.filter(function(link) { return !!link; });
		res.link(links.concat([
			{ href: 'http://i.imgur.com/kijXP0K.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 1' },
			{ href: 'http://i.imgur.com/6pETKay.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 2' },
			{ href: 'http://i.imgur.com/yurJqpe.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 3' },
		]));
	});
}

// public web proxy
web.export(pubweb_proxy);
pubweb_proxy.opts({
    stream: true,
    allmethods: true
});
function pubweb_proxy(req, res, worker) {
    // :TODO: perms

    // clone, direct to ?url
    var req2 = web.dispatch({ method: req.method, url: req.params.url });
    for (var k in req) {
        if (web.isHeaderKey(k)) {
            req2.header(k, req[k]);
        }
    }
    // req2.link(gui.getActiveProgramLinks()); :TODO:
    req.pipe(req2);
    req2.pipe(res);
}
},{"../globals":1,"../util":5,"./gui":2,"./search":4}],4:[function(require,module,exports){
var util = require('../util');

module.exports = {
	setup: function(indexLinks) {
		indexLinks.forEach(addIndex);
	},
	get: function() { return _cfg; },
	addIndex: addIndex,
	setIndex: setIndex,
	findLink: findLink,
	findRenderers: findRenderers,
	findRenderer: findRenderer
};

// The active feed config
var _cfg = {
	curIndex: null,
	indexLinks: [],
	indexes: {}, // indexHref -> [link]
	renderers: {}  // indexHref -> [link]
};

function addIndex(indexLink) {
	_cfg.indexLinks.push(indexLink);
	_cfg.indexes[indexLink.href] = [];
	_cfg.renderers[indexLink.href] = [];
	if (!_cfg.curIndex) {
		_cfg.curIndex = indexLink.href;
	}
	return web.HEAD(indexLink.href).then(function(res) {
		_cfg.indexes[indexLink.href] = res.links;
		_cfg.renderers[indexLink.href] = res.links.query('layer1.io/renderer');
		return res;
	});
}

function setIndex(indexLink) {
	if (!(indexLink.href in _cfg.indexes)) {
		addIndex(indexLink);
	}
	_cfg.curIndex = indexLink.href;
}

function findLink(query) {
	var links = _cfg.indexes[_cfg.curIndex];
	var terms = query.split(' ').map(function(term) { return new RegExp(term, 'i'); });

	for (var i=0; i < links.length; i++) {
		var link = links[i];
		var linkText =
			(link.href||'')  + ' ' +
			(link.rel||'')   + ' ' +
			(link.title||'') + ' ' +
			(link.keywords||'')
		;
		var match = true;
		for (var j = 0; j < terms.length; j++) {
			if (!terms[j].test(linkText)) {
				match = false;
				break;
			}
		}
		if (match) {
			return link;
		}
	}
	return null;
}

function findRenderers(targetLink, maxMatches) {
	var matches = [];
	var renderers = _cfg.renderers[_cfg.curIndex];

	for (var i=0; i < renderers.length; i++) {
		var g = renderers[i];
		if (!g.for) continue;
		if (web.queryLink(targetLink, g.for)) {
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
},{"../util":5}],5:[function(require,module,exports){
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
	var p = web.promise();
	var urld = web.parseUri(url);
	if (!urld || !urld.authority) {
		p.fulfill(false); // bad url, dont even try it!
		return p;
	}

	var triedProxy = false;
	var attempts = lookupAttempts = [new web.Request({ method: method, url: url, binary: true })]; // first attempt, as given
	if (!urld.protocol) {
		// No protocol? Two more attempts - 1 with https, then one with plain http
		attempts.push(new web.Request({ method: method, url: 'https://'+urld.authority+urld.relative, binary: true }));
		attempts.push(new web.Request({ method: method, url: 'http://'+urld.authority+urld.relative, binary: true }));
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
						attempts.push(new web.Request({ method: 'HEAD', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative } }));
						attempts.push(new web.Request({ method: 'HEAD', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative } }));
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					} else {
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					}
				} else {
					if (useHead) {
						attempts.push(new web.Request({ method: 'HEAD', url: proxyUrl, params: { url: url } }));
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: url }, binary: true }));
					} else {
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: url }, binary: true }));
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
},{"./globals":1}]},{},[3])