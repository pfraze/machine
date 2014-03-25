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