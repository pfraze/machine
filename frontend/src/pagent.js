// Page Agent (PAgent)
// ===================
// Standard page behaviors
var util = require('./util');

function setup() {
	// Request events
	try { web.bindRequestEvents(document.body); }
	catch (e) { console.error('Failed to bind body request events.', e); }
	document.body.addEventListener('request', function(e) {
		console.log('toplevel request event', e); // :TODO:
		dispatchRequest(e.detail);
	});
}

function dispatchRequest(req, $region, $target) {
	var body = req.body; delete req.body;

	req = new web.Request(req);
	if (!req.headers.Accept) { req.Accept('text/html, */*'); }

	// Relative link? Make absolute
	if (!web.isAbsUri(req.headers.url)) {
		var baseurl = (window.location.protocol + '//' + window.location.host);
		req.headers.url = web.joinUri(baseurl, req.headers.url);
	}

	return web.dispatch(req).end(body);
}


module.exports = {
	setup: setup,
	dispatchRequest: dispatchRequest
};