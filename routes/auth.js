var config = require('../lib/config');
var util = require('../lib/util');
var express = require('express');
var winston = require('winston');
var verify = (require("browserid-verify"))({ url: 'https://verifier.login.persona.org/verify' });

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
		// Parse
		if (!req.body) { return res.send(422, { error: 'Body required.' }); }
		try { req.body = JSON.parse(req.body.toString()); }
		catch (e) { return res.send(422, { error: 'Malformed JSON: '+e }); }

		// Validate
		if (!req.body.assertion) { return res.send(422, { errors: { assertion: 'Required.' }}); }

		verify(req.body.assertion, config.url, function(err, email, response) {
			if (err) {
				if (err instanceof Error) { err = err.message; }
				return res.send(422, { status: 'failure', reason: err });
			}
			if (response && response.status != 'okay') {
				return res.send(422, { status: 'failure', reason: response.reaspon });
			}
			req.session.email = email;
			res.send(200, { status: 'okay', email: email });
		});
	}

	function authLogout(req, res, next) {
		if (req.session) {
			req.session.email = null;
		}
		res.send(200, { status: 'okay' });
	}

};