var express = require('express');
var winston = require('winston');
var config  = require('../lib/config');
var util    = require('../lib/util');
var tmpl    = require('../lib/html');
var db      = require('../lib/db');

module.exports = function(server) {
	server.all('/', linkHome);
	server.head('/', function(req, res) { res.send(204); });
	server.get('/', getHome);

	function linkHome(req, res, next) {
		res.setHeader('Link', [
			'</>; rel="self via service"; title="'+config.hostname+'"',
			'</auth>; rel="service"; id="auth"; title="Authentication Service"',
			'</.me>; rel="item"; id=".me"; title="Your Profile"',
			'</.fetch>; rel="service"; id=".fetch"; title="Resource-Fetching Proxy"',
			'</status>; rel="service"; id="status"; title="Network Host Stats"',
			'</{id}>; rel="collection"',
		].join(', '));
		next();
	}

	function getHome(req, res) {
		var page = tmpl.render('index', {
			user: req.session.user||'',
			dirs_html: db.getDirList().map(function(dirId) {
				return tmpl.render('directory_list_partial', {
					url: '/'+dirId,
					title: dirId,
					rel: 'collection'
				});
			}).join('<hr>')
		});
		res.send(page);
	}
};