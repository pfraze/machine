var exec = require('./executor');

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

	// server starting-point
	return function(req, res, worker) {
		if (req.path == '/') {
			root(req, res, worker);
		} else {
			res.writeHead(404).end();
		}
	};
};