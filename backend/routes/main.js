var express = require('express');
var winston = require('winston');
var async   = require('async');
var config  = require('../lib/config');
var db      = require('../lib/db');
var util    = require('../lib/util');
var tmpl    = require('../lib/html');

module.exports = function(server) {
	server.head('/', addLinks, function(req, res) { res.send(204); });
	server.get('/',  addLinks, getMain);

	function requireSession(req, res, next) {
		if (!req.session.user) {
			return res.send(401);
		}
		next();
	}

	function addLinks(req, res, next) {
		var links = [
			res.getHeader('Link'),
			'</.fetch>; rel="service layer1.io/proxy"; id=".fetch"; title="Resource-Fetching Proxy"'
		];
		res.header('Link', links.join(', '));
		next();
	}

	function getMain(req, res, next) {
		res.format({
			html: function() {
				// Render page HTML
				var page = tmpl.render('index', {});
				res.send(page);
			}
		});
	}
};