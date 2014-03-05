var express = require('express');
var winston = require('winston');
var config = require('../lib/config');
var util = require('../lib/util');
var tmpl = require('../lib/html');

module.exports = function(server) {
	server.head('/:room', linkRoom, function(req, res) { res.send(204); });
	server.get('/:room',  linkRoom, getRoom);

	function linkRoom(req, res, next) {
		var links = [
			'</>; rel="up via service"; title="'+config.hostname+'"',
			'</'+req.param('room')+'>; rel="self collection"; id="'+req.param('room')+'"',
		];
		res.setHeader('Link', links.join(', '));
		next();
	}

	function getRoom(req, res, next) {
		res.format({
			html: function() {
				// Set CSP
				res.setHeader('Content-Security-Policy', [
					"default-src *",
					"script-src 'self' https://login.persona.org",
					"style-src 'unsafe-inline' *",
					"object-src 'none'",
					"frame-src 'self'",
				].join('; '));

				// Render HTML
				var page = tmpl.render('room', {
					user: req.session.email||'',
					roomname: req.param('room'),
					roomage: util.timeago(Date.now()),
				});
				res.send(page);
			}
		});
	}
};