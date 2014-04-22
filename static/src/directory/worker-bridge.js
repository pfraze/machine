var executor = require('./executor');

module.exports = function(config) {
	// toplevel
	function root(req, res, worker) {
		var links = [];
		links.push({ href: '/', rel: 'self service via', title: 'Host Page' });
		// :TODO: add hosts

		// Respond
		res.setHeader('Link', links);
		res.writeHead(204).end();
	}

	// selected items
	function selection(req, res, worker) {
		res.writeHead(501).end();
	}

	// feed items
	function feed(req, res, worker) {
		res.writeHead(501).end();
	}

	// service proxy
	function service(req, res, worker) {
		res.writeHead(501).end();
	}

	// helper
	function extractExecId(req) {
		var auth = req.header('Authorization');
		if (!auth) return false;

		var parts = auth.split(' ');
		if (parts[0] != 'Exec' || !parts[1]) return false;

		return +parts[1] || false;
	}

	// server starting-point
	return function(req, res, worker) {
		// check execution id
		req.execid = extractExecId(req);
		if (req.execid === false) {
			return res.writeHead(401, 'must set Authorization header to "Exec <execid>"').end();
		}
		req.exec = executor.get(worker.getUrl(), req.execid);
		if (!req.exec) {
			return res.writeHead(403, 'invalid execid - expired or not assigned to this worker').end();
		}

		var pathbase = '/'+req.path.split('/')[1];
		switch (pathbase) {
			case '/':          return root(req, res, worker);
			case '/selection': return selection(req, res, worker);
			case '/feed':      return feed(req, res, worker);
			case '/service':   return service(req, res, worker);
			default: res.writeHead(404).end();
		}
	};
};