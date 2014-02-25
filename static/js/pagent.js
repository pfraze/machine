// Page Agent (PAgent)
// ===================
var pagent = {};

var sanitizeHtmlRegexp = /<\s*script/g;
function sanitizeHtml (html) {
	// CSP stops inline or remote script execution, but we still want to stop inclusions of scripts on our domain
	// :TODO: this approach probably naive in some important way
	return html.replace(sanitizeHtmlRegexp, '&lt;script');
}

pagent.renderIframe = function(html, $iframe) {
	html = '<link href="css/bootstrap.css" rel="stylesheet">'+html;
	$iframe = $iframe || $('#iframe-main');
	$iframe.attr('srcdoc', sanitizeHtml(html));
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
};

function iframeRequestEventHandler(e) {
	var iframeEl = $(e.target)[0].ownerDocument.defaultView.frameElement;
	var req = e.detail;
	pagent.prepIframeRequest(req, iframeEl);
	pagent.dispatchRequest(req, e.target, { $iframe: $(iframeEl) });
}

pagent.prepIframeRequest = function (req, iframeEl) {
	var current_content_origin = 'httpl://' + ((iframeEl) ? iframeEl.id.slice('iframe-'.length) : 'main'); // :DEBUG: pull from iframe or default to main
	if (current_content_origin) {
		// Put origin into the headers
		req.headers.from = current_content_origin;
	}
};

pagent.dispatchRequest = function(req, origin, opts) {
	opts = opts || {};
	var target = req.target; // local.Request() will strip `target`
	var body = req.body; delete req.body;

	if (!target) target = '_self';
	if (target == '_self' || target == '_parent') {
		target = '_content';
	}

	if (!req.headers && target != '_null') { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }
	req = (req instanceof local.Request) ? req : (new local.Request(req));

	// Relative link? Make absolute
	if (!local.isAbsUri(req.url)) {
		var baseurl = (opts.$iframe) ? opts.$iframe[0].id.slice('iframe-'.length) : 'main';
		req.url = local.joinUri('httpl://'+baseurl, req.url);
	}

	// Content target? Update page
	var res_;
	if (target == '_content') {
		// Dispatch
		res_ = local.dispatch(req);
		res_.always(function(res) {
			// Generate final html
			var html;
			if (res.body && typeof res.body == 'string') {
				html = res.body;
				if (res.header('Content-Type') != 'text/html') {
					html = '<pre class="plain">'+html+'</pre>';
				}
			} else {
				html = '<h1>'+(+res.status)+' <small>'+(res.reason||'').replace(/</g,'&lt;')+'</small></h1>';
				if (res.body && typeof res.body != 'string') { html += '<pre class="plain">'+JSON.stringify(res.body).replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</pre>'; }
			}

			// :DEBUG: For now, just render
			pagent.renderIframe(html, opts.$iframe);

			return res;
		});
	} else if (target == '_null') {
		// Null target, simple dispatch
		res_ = local.dispatch(req);
	} else {
		console.error('Invalid request target', target, req, origin);
		return null;
	}

	req.end(body);
	return res_;
};