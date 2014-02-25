// Worker Proxy
// ============
// handles requests from the worker

var worker_proxy = function(req, res, worker) {
	var via = [{proto: {version:'1.0', name:'HTTPL'}, hostname: req.header('Host')}];
	if (req.path == '/') {
		// Fetch local hosts
		local.HEAD({ url: 'httpl://hosts', Via: (req.parsedHeaders.via||[]).concat(via) }).always(function(res2) {
			var links = local.queryLinks(res2, { rel: '!self !up !via' });
			var pageid = window.location.pathname.slice(1)||'home';

			// Add our own links
			links.unshift({ href: '/', rel: 'self service via', title: 'Host Page', noproxy: true });
			links.push({
				href: local.joinUri('httpl://guipedia.com', pageid, '/db{?cap}'),
				rel: "collection guipedia.com/rel/db",
				id: pageid+" Database"
			});
			links.push({ href: '/{uri}', rel: 'service', hidden: true });

			// Respond
			res.setHeader('Link', links);
			res.setHeader('Via', via);
			res.header('Proxy-Tmpl', 'httpl://host.page/{uri}');
			res.writeHead(204).end();
		});
		return;
	}

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
		res.writeHead(403, 'Forbidden');
		res.end('External requests currently disabled.');
		return;
	}

	// Set headers
	req2.header('From', 'httpl://'+worker.config.domain);
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
};