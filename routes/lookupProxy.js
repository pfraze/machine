var config = require('../lib/config');
var util = require('../lib/util');
var request = require('request');
var winston = require('winston');

module.exports = function(server) {
	server.head('/.lookup', lookup);

	function lookup(req, res) {
		if (!req.query.url) {
			res.setHeader('Link', [
				'</>; rel="up via service"; title="'+config.hostname+'"',
				'</.lookup>; rel="self service"; id=".lookup"; title="URL Lookup Proxy"'
			].join(', '));
			return res.send(204);
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