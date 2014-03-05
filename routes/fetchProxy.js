var config = require('../lib/config');
var util = require('../lib/util');
var request = require('request');
var winston = require('winston');

module.exports = function(server) {
	server.head('/.fetch', checkSession, fetch);
	server.get('/.fetch', checkSession, fetch);

	function checkSession(req, res, next) {
		console.warn('Session-check temporarily disabled -- don\'t forget to re-enable this!');
		return next();
		if (!req.session.email) {
			return res.send(401);
		}
		next();
	}

	function fetch(req, res) {
		if (!req.query.url) {
			res.setHeader('Link', [
				'</>; rel="up via service"; title="'+config.hostname+'"',
				'</.fetch>; rel="self service"; id=".fetch"; title="Resource-Fetching Proxy"',
			].join(', '));
			return res.send(204);
		}

		// Make sure we're not gonna get into an infinite loop (it will be tried)
		var i = req.query.url.indexOf(config.hostname);
		if (i != -1 && i <= 7) {
			res.writeHead(403, 'dont be a dick');
			return res.end();
		}

		var method = request.head;
		if (req.method == 'GET') {
			method = request.get;
		} else if (req.method != 'HEAD') {
			return res.send(405);
		}

		method.call(request, req.query.url, function(err, res2) {
			if (!err && res2.statusCode >= 200 && res2.statusCode < 300) {
				if (res2.headers['link']) {
					res.setHeader('Link', res2.headers['link']);
				}
				if (res2.body) {
					res.setHeader('Content-Type', res2.headers['content-type']);
					res.send(200, res2.body);
				} else {
					res.send(204);
				}
			}
			else {
				res.send(502);
			}
		});
	}
};