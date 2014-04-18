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

	// gui service
	function gui(req, res, worker) {
		var execid = req.path.slice(5);

		// fetch worker's execution
		var execution = exec.get(worker.getUrl(), execid);
		if (!execution) {
			return res.writeHead(404, 'id not attached to worker').end();
		}

		if (req.method == 'PUT') {
			req.on('end', function() {
				execution.setGui(req.body);
				res.writeHead(204).end();
			});
		} else {
			res.writeHead(405, 'only accepts PUT').end();
		}
	}

	// server starting-point
	return function(req, res, worker) {
		if (req.path == '/') {
			root(req, res, worker);
		} else if(req.path.indexOf('/gui') === 0) {
			gui(req, res, worker);
		} else {
			res.writeHead(404).end();
		}
	};
};