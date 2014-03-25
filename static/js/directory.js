;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var globals = require('./globals');

module.exports = {
	setup: function() {
		navigator.id.watch({
			loggedInUser: globals.session.user,
			onlogin: function(assertion) {
				globals.authUA.POST({ assertion: assertion })
					.then(function() { window.location.reload(); })
					.fail(function(res) { navigator.id.logout(); console.error('Failed to log in', res); });
			},
			onlogout: function() {
				globals.authUA.DELETE()
					.then(function() { window.location.reload(); })
					.fail(function(res) { console.error('Failed to log out', res); });
			}
		});

		if (globals.session.user) {
			$('.profile-btn').text(globals.session.user).css('display', 'inline-block');
			$('.show-on-authed').show();
			$('.auth-btn').text('Logout').on('click', function() {
				navigator.id.logout();
			});
		} else {
			$('.auth-btn').removeClass('btn-default').addClass('btn-success').on('click', function() {
				navigator.id.request();
			});
		}

		if (globals.session.isPageAdmin) {
			$('.show-on-admin').show();
		}
	}
};
},{"./globals":3}],2:[function(require,module,exports){
// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();

// ui
require('../widgets/user-directories-panel').setup();
require('../widgets/addlink-panel').setup();
require('../widgets/directory-links-list').setup();
require('../widgets/directory-delete-btn').setup();
},{"../auth":1,"../pagent":4,"../widgets/addlink-panel":6,"../widgets/directory-delete-btn":7,"../widgets/directory-links-list":8,"../widgets/user-directories-panel":9}],3:[function(require,module,exports){
var hostUA = local.agent(window.location.protocol + '//' + window.location.host);
module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	hostUA: hostUA,
	pageUA: local.agent(window.location.toString()),
	authUA: hostUA.follow({ rel: 'service', id: 'auth' }),
	meUA: hostUA.follow({ rel: 'item', id: '.me' }),
	fetchProxyUA: hostUA.follow({ rel: 'service', id: '.fetch' }),
};
},{}],4:[function(require,module,exports){
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
		dispatchRequest(e.detail, null, $(e.target));
	});
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
			renderIframe($iframe, util.renderResponse(req, res));
		});
	} else if (target == '_child') {
		throw "target=_child Not yet implemented";
		// New iframe
		res_ = local.dispatch(req);
		res_.always(function(res) {
			var $newIframe = createIframe($('todo'), newOrigin); // :TODO: - container
			renderIframe($newIframe, util.renderResponse(req, res));
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

var iframeCounter = 0;
function createIframe($container, originHost) {
	var html = '<iframe id="iframe-'+iframeCounter+'" seamless="seamless" sandbox="allow-popups allow-same-origin allow-scripts" data-origin="'+originHost+'"><html><body></body></html></iframe>';
	// ^ sandbox="allow-same-origin allow-scripts" allows the parent page to reach into the iframe
	// CSP and script stripping occurs in renderIframe()
	iframeCounter++;
	$container.append(html);
	return $container.find('iframe').last();
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
	/*function sizeIframe() {
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
	$iframe.load(sizeIframe);*/

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

module.exports = {
	setup: setup,
	dispatchRequest: dispatchRequest,
	createIframe: createIframe,
	renderIframe: renderIframe
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

function fetch(url, useHead) {
	var method = (useHead) ? 'HEAD' : 'GET';
	var p = local.promise();
	var urld = local.parseUri(url);
	if (!urld || !urld.authority) {
		p.fulfill(false); // bad url, dont even try it!
		return p;
	}

	var triedProxy = false;
	var attempts = [new local.Request({ method: method, url: url })]; // first attempt, as given
	if (!urld.protocol) {
		// No protocol? Two more attempts - 1 with https, then one with plain http
		attempts.push(new local.Request({ method: method, url: 'https://'+urld.authority+urld.relative }));
		attempts.push(new local.Request({ method: method, url: 'http://'+urld.authority+urld.relative }));
	}

	var lookupReq;
	function makeAttempt() {
		if (lookupReq) lookupReq.close();
		lookupReq = attempts.shift();
		local.dispatch(lookupReq).always(function(res) {
			if (res.status >= 200 && res.status < 300) {
				p.fulfill(res); // Done!
			} else if (!attempts.length && res.status == 0 && !triedProxy) {
				// May be a CORS issue, try the proxy
				triedProxy = true;
				globals.fetchProxyUA.resolve({ nohead: true }).always(function(proxyUrl) {
					if (!urld.protocol) {
						if (useHead) {
							attempts = [
								new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative } }),
								new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative } }),
								new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative } }),
								new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative } })
							];
						} else {
							attempts = [
								new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative } }),
								new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative } })
							];
						}
					} else {
						if (useHead) {
							attempts = [
								new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: url } }),
								new local.Request({ method: 'GET', url: proxyUrl, query: { url: url } })
							];
						} else {
							attempts = [
								new local.Request({ method: 'GET', url: proxyUrl, query: { url: url } })
							];
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
		});
		lookupReq.end();
	}
	makeAttempt();

	return p;
}

module.exports = {
	escapeHTML: escapeHTML,
	makeSafe: escapeHTML,
	escapeQuotes: escapeQuotes,
	stripScripts: stripScripts,
	renderResponse: renderResponse,
	fetch: fetch,
	fetchMeta: function(url) { return fetch(url, true); }
};
},{"./globals":3}],6:[function(require,module,exports){
var globals = require('../globals');
var util    = require('../util');

module.exports = {
	setup: function() {
		var changeTimeoutId;
		var curLink;

		// Input change handler
		$('.addlink-panel input[type=url]').on('keyup', function() {
			// "Debounce"
			if (changeTimeoutId) clearTimeout(changeTimeoutId);

			var url = $(this).val();
			if (url) {
				var $form = $(this).parents('form');
				// Give a sec for the user to stop editing
				changeTimeoutId = setTimeout(fetchLinkCB(url, $form), 500);
			}
		});

		// Link post click handler
		$('.addlink-panel form').on('submit', function(e) {
			e.preventDefault();
			if (!curLink) return;

			// Add to dir's links
			globals.pageUA.POST(curLink).always(function(res) {
				if (res.status == 201) {
					window.location.reload();
				} else if (res.status == 403) {
					alert('Sorry! You must own the directory to add links to it.');
				} else {
					alert('Unexpected error: '+res.status+' '+res.reason);
				}
			});

			// Clear form
			this.reset();
			$(this).find('button').attr('disabled', 'disabled').removeClass('btn-primary').text('Post');
			$(this).find('.fetch-result').text('');
		});

		function fetchLinkCB(url, $form) {
			return function() {
				curLink = null; // reset current link
				changeTimeoutId = null;

				// Tell user we're checking it out
				$form.find('button').attr('disabled', 'disabled').removeClass('btn-primary').text('Fetching...');
				$form.find('.fetch-result').text('');

				// Fetch URL
				util.fetchMeta(url).always(function(res) {
					// Try to get the self link
					curLink = local.queryLinks(res, { rel: 'self' })[0];
					if (!curLink) {
						// Create a meta-less stand-in if the URL is good
						if (res.status >= 200 && res.status < 300) {
							curLink = { href: url };
						}
						// :TODO: follow redirects
					}

					if (curLink) {
						// Success, build description
						var desc = '';
						if (curLink.title || curLink.id) { desc += '"'+(curLink.title || curLink.id)+'"'; }
						if (curLink.rel) { desc = '{'+curLink.rel.replace(/(^|\b)self(\b|$)/g, '').trim()+'} '; }
						if (!desc) desc = 'no metadata provided';

						// Update UI
						$form.find('button').attr('disabled', false).addClass('btn-primary').text('Post');
						$form.find('.fetch-result').text('URL Found: ' + desc);
					} else {
						// Failure
						$form.find('button').attr('disabled', 'disabled').text('Failure');
						$form.find('.fetch-result').text(res.status + ' ' + res.reason);
					}
				});
			};
		}
	}
};
},{"../globals":3,"../util":5}],7:[function(require,module,exports){
var globals = require('../globals');

module.exports = {
	setup: function() {
		if (globals.session.isPageAdmin) {
			$('.directory-delete-btn').on('click', function() {
				if (!confirm('Delete this directory. Are you sure?')) return false;
				globals.pageUA.DELETE()
					.then(function(res) {
						window.location = '/';
					})
					.fail(function(res) {
						alert('Unexpected error: ' + res.status +' '+res.reason);
					});
				return false;
			});
		}
	}
};
},{"../globals":3}],8:[function(require,module,exports){
var globals = require('../globals');

module.exports = {
	setup: function() {
		if (globals.session.isPageAdmin) {
			$('.directory-links-list .refresh-link-btn').on('click', function() {
				alert('todo');
				return false;
			});

			$('.directory-links-list .remove-link-btn').on('click', function() {
				var $link = $(this).parents('.directory-link');
				var internal_id = $link.data('internal-id');
				if (typeof internal_id == 'undefined') return false;
				if (!confirm('Delete this link. Are you sure?')) return false;
				globals.pageUA.follow({ rel: 'item', _internal: true, id: internal_id }).DELETE()
					.then(function() { $link.remove(); })
					.fail(function(res) { alert('Unexpected error: '+res.status+' '+res.reason); });
				return false;
			});
		}
	}
};
},{"../globals":3}],9:[function(require,module,exports){
var globals = require('../globals');

module.exports = {
	setup: function() {
		if (globals.session.user) {
			// Populate "my dirs"
			globals.meUA.GET().then(function(res) {
				var html = res.body.directories.map(function(dir) {
					return '<a href="/'+dir.id+'" class="list-group-item"><h4 class="list-group-item-heading">'+dir.name+'</h4></a>';
				}).join('');
				$('.user-directories-panel .list-group').html(html);
			});

			// Create new directory btn
			$('.user-directories-panel .btn').on('click', function(req, res) {
				var id = prompt('Enter the name of your new directory');
				if (!id) return false;
				globals.hostUA.POST({ id: id })
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
},{"../globals":3}]},{},[2])
;