// Page Agent (PAgent)
// ===================
// Standard page behaviors
var util = require('../util');
var agents = require('../agents');
var linkRegistry = require('./linkregistry');

var n$Service = new nQuery.Server();

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
	renderIframe: renderIframe,
	n$Service: n$Service
};