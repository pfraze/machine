var config = require('../lib/config');
var util = require('../lib/util');
var request = require('request');
var winston = require('winston');

module.exports = function(server) {
	server.head('/.lookup', checkSession, lookup);

	function checkSession(req, res, next) {
		if (!req.session.email) {
			return res.send(401);
		}
		next();
	}

	function lookup(req, res) {
		if (!req.query.url) {
			res.setHeader('Link', [
				'</>; rel="up via service"; title="'+config.hostname+'"',
				'</.lookup>; rel="self service"; id=".lookup"; title="URL Lookup Proxy"'
			].join(', '));
			return res.send(204);
		}

		// Make sure we're not gonna get into an infinite loop (it will be tried)
		var i = req.query.url.indexOf(config.hostname);
		if (i != -1 && i <= 7) {
			res.writeHead(403, 'dont be a dick');
			return res.end();
		}

		request.head(req.query.url, function(err, res2) {
			if (res2.statusCode >= 200 && res2.statusCode < 300) {
				res.setHeader('link', res2.headers.link || res2.headers.Link);
				res.send(204);
			}
			else {
				res.send(502);
			}
		});
	}
};