var express = require('express');
var winston = require('winston');
var config = require('../lib/config');
var util = require('../lib/util');
var tmpl = require('../lib/html');

module.exports = function(server) {
	server.all('/', linkHome);
	server.head('/', function(req, res) { res.send(204); });
	server.get('/', getHome);

	function linkHome(req, res, next) {
		res.setHeader('Link', [
			'</>; rel="self via service"; title="'+config.hostname+'"',
			'</auth>; rel="service"; id="auth"; title="Authentication Service"',
			'</status>; rel="service"; id="status"; title="Network Host Stats"',
			'</{id}>; rel="collection"',
		].join(', '));
		next();
	}
	function getHome(req, res) {
		var page = tmpl.render('index', { user: req.session.email||'' });
		res.send(page);
	}
};