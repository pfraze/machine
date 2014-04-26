var util = require('../util');
var executor = require('./executor');
var globals = require('../globals');

module.exports = function(mediaLinks) {
	// toplevel
	function root(req, res, worker) {
		var links = util.table(
			['href',      'id',        'rel',                         'title'],
			'/',          undefined,   'self service via',            'Host Page',
			'/selection', 'selection', 'service layer1.io/selection', 'Selected Items at Time of Execution',
			'/feed',      'feed',      'service layer1.io/feed',      'Current Feed',
			'/service',   'service',   'service layer1.io/service',   'Layer1 Toplevel Service'
		);

		// Respond
		res.setHeader('Link', links);
		res.writeHead(204).end();
	}

	// selected items
	function selection(req, res, worker) {
		var pathd = req.path.split('/');
		var itemid = pathd[2];

		var headerLinks;
		var selLinks = req.act.getSelectedLinks();

		if (itemid) {
			if (!selLinks[itemid]) { return res.writeHead(404).end(); }
			var link = local.util.deepClone(selLinks[itemid]);
			headerLinks = util.table(
				['href',      'id',        'rel',                            'title'],
				'/',          undefined,   'via',                            'Host Page',
				'/selection', 'selection', 'up service layer1.io/selection', 'Selected Items at Time of Execution'
			);
			serveItem(req, res, headerLinks, link);
		}
		else {
			var links = local.util.deepClone(selLinks);
			headerLinks = util.table(
				['href',      'id',        'rel',                              'title'],
				'/',          undefined,   'up service via',                   'Host Page',
				'/selection', 'selection', 'self service layer1.io/selection', 'Selected Items at Time of Execution'
			);
			serveCollection(req, res, headerLinks, links, { noPost: true });
		}
	}

	// feed items
	function feed(req, res, worker) {
		var pathd = req.path.split('/');
		var itemid = pathd[2];

		if (itemid) {
			if (!mediaLinks[itemid]) { return res.writeHead(404).end(); }
			var link = local.util.deepClone(mediaLinks[itemid]);
			headerLinks = util.table(
				['href', 'id',      'rel',                       'title'],
				'/',     undefined, 'service via',               'Host Page',
				'/feed', 'feed',    'up service layer1.io/feed', 'Current Feed'
			);
			serveItem(req, res, headerLinks, link);
		}
		else {
			var links = local.util.deepClone(mediaLinks);
			headerLinks = util.table(
				['href', 'id',      'rel',                         'title'],
				'/',     undefined, 'up service via',              'Host Page',
				'/feed', 'feed',    'self service layer1.io/feed', 'Current Feed'
			);
			serveCollection(req, res, headerLinks, links);
		}
	}

	// service proxy
	function service(req, res, worker) {
		// :TODO:
		res.writeHead(501).end();
	}

	// collection behavior
	function serveCollection(req, res, headerLinks, links, opts) {
		opts = opts || {};
		var uris = {};

		// set headers
		res.header('Link', headerLinks.concat(links));

		// :TODO: check permissions

		// route method
		switch (req.method) {
			case 'HEAD': return res.writeHead(204).end();
			case 'GET':  return res.writeHead(204).end(); // :TODO:
			case 'POST':
				if (opts.noPost) {
					res.header('Allow', 'HEAD, GET');
					return res.writeHead(405, 'bad method').end();
				}
				req.on('end', function() {
					globals.pageAgent.POST(req.body, {
						Content_Type: req.header('Content-Type'),
						query: req.query
					}).then(function(res2) {
						res.header('Location', res2.header('Location'));
						res.writeHead(201, 'created').end();
					}, function(res2) {
						res.writeHead(res2.status, res2.reason).end(res2.body);
					});
				});
				break;
			default:
				res.header('Allow', 'HEAD, GET'+((!opts.noPost)?', POST':''));
				res.writeHead(405, 'bad method').end();
		}
	}

	// item behavior
	function serveItem(req, res, headerLinks, link, opts) {
		opts = opts || {};
		// update link references to point to this service
		var uri = link.href;
		link.rel = 'self '+link.rel;

		// set headers
		res.header('Link', headerLinks.concat(link));

		// :TODO: check permissions

		// route method
		switch (req.method) {
			case 'HEAD': return res.writeHead(204).end();
			case 'GET':
				local.GET({
					url: uri,
					Accept: req.header('Accept'),
					query: req.query,
					stream: true
				}).then(function(res2) {
					res.writeHead(200, 'ok', {'Content-Type': res2.header('Content-Type')});
					local.pipe(res, res2);
				}, function(res2) {
					res.writeHead(res2.status, res2.reason);
					local.pipe(res, res2);
				});
				break;
			default:
				res.header('Allow', 'HEAD, GET');
				res.writeHead(405, 'bad method').end();
		}
	}

	// helper
	function extractActId(req) {
		var auth = req.header('Authorization');
		if (!auth) return false;

		var parts = auth.split(' ');
		if (parts[0] != 'Action' || !parts[1]) return false;

		return +parts[1] || false;
	}

	// server starting-point
	return function(req, res, worker) {
		// check action id
		req.actid = extractActId(req);
		if (req.actid === false) {
			return res.writeHead(401, 'must reuse Authorization header in incoming request for all outgoing requests').end();
		}
		req.act = executor.get(worker ? worker.getUrl() : true, req.actid); // worker DNE, req came from page so allow
		if (!req.act) {
			return res.writeHead(403, 'invalid actid - expired or not assigned to this worker').end();
		}

		// route
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