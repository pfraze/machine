var express = require('express');
var winston = require('winston');
var config = require('../lib/config');
var util = require('../lib/util');
var tmpl = require('../lib/html');

module.exports = function(server) {
	server.all('/', linkHome);
	server.head('/', function(req, res) { res.send(204); });
	server.get('/', loadLatestDirsFromDB, getHome);

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

	function loadLatestDirsFromDB(req, res, next) {
		var q = 'SELECT d.id, d.name FROM directories d ORDER BY id DESC LIMIT 10';
		req.pg.query(q, function(err, dbres) {
			if (err) {
				console.error(err);
				winston.error('Failed to load latest directories from DB', { error: err, inputs: [q], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.locals.dirs = dbres.rows;
			next();
		});
	}

	function getHome(req, res) {
		var page = tmpl.render('index', {
			user: req.session.email||'',
			dirs_html: res.locals.dirs.map(function(dir) {
				return tmpl.render('directory_list_partial', {
					url: '/'+dir.id,
					title: dir.name,
					rel: 'collection'
				});
			}).join('<hr>')
		});
		res.send(page);
	}
};