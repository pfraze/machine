var config = require('../lib/config');
var util = require('../lib/util');
var express = require('express');
var winston = require('winston');

module.exports = function(server) {
	server.head('/auth', authLink);
	server.post('/auth', authVerify);
	server.delete('/auth', authLogout);

	function authLink(req, res, next) {
		res.setHeader('Link', [
			'</>; rel="up via service"; title="'+config.hostname+'"',
			'</auth>; rel="service"; id="auth"; title="Authentication Service"'
		].join(', '));
		res.send(204);
	}

	function authVerify(req, res, next) {
		res.send(501);
	}

	function authLogout(req, res, next) {
		if (req.session) {
			req.session.user = null;
		}
		res.send(204);
	}

};