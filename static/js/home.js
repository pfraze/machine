;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"./globals":2}],2:[function(require,module,exports){
var hostAgent = local.agent(window.location.protocol + '//' + window.location.host);
window.globals = module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	hostAgent: hostAgent,
	pageAgent: local.agent(window.location.toString()),
	authAgent: hostAgent.follow({ rel: 'service', id: 'auth' }),
	meAgent: hostAgent.follow({ rel: 'item', id: '.me' }),
	fetchProxyAgent: hostAgent.follow({ rel: 'service', id: '.fetch' }),
};
},{}],3:[function(require,module,exports){
// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();

// ui
require('../widgets/user-directories-panel').setup();
},{"../auth":1,"../pagent":4,"../widgets/user-directories-panel":6}],4:[function(require,module,exports){
// Page Agent (PAgent)
// ===================
// Standard page behaviors
var util = require('./util');

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
		console.log('toplevel request event', e); // :TODO:
		dispatchRequest(e.detail);
	});
}

function dispatchRequest(req, $region, $target) {
	var body = req.body; delete req.body;

	if (!req.headers) { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }
	req = (req instanceof local.Request) ? req : (new local.Request(req));

	// Relative link? Make absolute
	if (!local.isAbsUri(req.url)) {
		var baseurl = (window.location.protocol + '//' + window.location.host);
		req.url = local.joinUri(baseurl, req.url);
	}

	var res_ = local.dispatch(req);
	req.end(body);
	return res_;
}


module.exports = {
	setup: setup,
	dispatchRequest: dispatchRequest
};
},{"./util":5}],5:[function(require,module,exports){
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
				return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+escapeHTML(res.body)+'</code></pre>';
			return '<pre>'+escapeHTML(res.body)+'</pre>';
		} else {
			return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+escapeHTML(JSON.stringify(res.body))+'</code></pre>';
		}
	}
	return res.status + ' ' + res.reason;
}

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
		local.dispatch(lookupReq).always(handleAttempt);
		lookupReq.end();
	}
	makeAttempt();

	function handleAttempt(res) {
		if (res.status >= 200 && res.status < 300) {
			p.fulfill(res); // Done!
		} else if (!attempts.length && res.status === 0 && !triedProxy) {
			// May be a CORS issue, try the proxy
			triedProxy = true;
			globals.fetchProxyAgent.resolve({ nohead: true }).always(function(proxyUrl) {
				if (!urld.protocol) {
					if (useHead) {
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative } }));
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative } }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					} else {
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					}
				} else {
					if (useHead) {
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: url } }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: url }, binary: true }));
					} else {
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: url }, binary: true }));
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

// helper to make an array of objects
function table(keys) {
	var obj, i, j=-1;
	var arr = [];
	for (i=1, j; i < arguments.length; i++, j++) {
		if (!keys[j]) { if (obj) { arr.push(obj); } obj = {}; j = 0; } // new object
		obj[keys[j]] = arguments[i];
	}
	arr.push(obj); // dont forget the last one
	return arr;
}

module.exports = {
	escapeHTML: escapeHTML,
	makeSafe: escapeHTML,
	escapeQuotes: escapeQuotes,
	stripScripts: stripScripts,
	renderResponse: renderResponse,

	table: table,

	serializeRawMeta: serializeRawMeta,
	parseRawMeta: parseRawMeta,

	fetch: fetch,
	fetchMeta: function(url) { return fetch(url, true); }
};
},{"./globals":2}],6:[function(require,module,exports){
var globals = require('../globals');

module.exports = {
	setup: function() {
		if (globals.session.user) {
			// Populate "my dirs"
			globals.meAgent.GET().then(function(res) {
				var html = res.body.directories.map(function(dir) {
					return '<a href="/'+dir.id+'" class="list-group-item"><h4 class="list-group-item-heading">'+dir.name+'</h4></a>';
				}).join('');
				$('.user-directories-panel .list-group').html(html);
			});

			// Create new directory btn
			$('.user-directories-panel .btn').on('click', function(req, res) {
				var id = prompt('Enter the name of your new directory');
				if (!id) return false;
				globals.hostAgent.POST({ id: id })
					.then(function(res) {
						window.location = res.headers.location;
					})
					.fail(function(res) {
						if (res.status == 422 && res.body && res.body.id) {
							alert('Sorry, '+res.body.id);
						} else if (res.status == 409) {
							alert('Sorry, that name is taken.');
						} else {
							alert('Unexpected error: ' + res.status +' '+res.reason);
						}
					});
				return false;
			});
		}
	}
};
},{"../globals":2}]},{},[3])
;