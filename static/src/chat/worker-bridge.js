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
linkRegistry.on('added', function(entry) {
	indexChangeEvents.emit('added', { id: entry.id, links: entry.links });
});
linkRegistry.on('removed', function(entry) {
	indexChangeEvents.emit('removed', { id: entry.id });
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