var express = require('express');
var winston = require('winston');
var config = require('../lib/config');
var util = require('../lib/util');
var tmpl = require('../lib/html');

module.exports = function(server) {
	server.head('/.me', checkSession, loadMedataFromDB, linkMe, function(req, res) { res.send(204); });
	server.get('/.me', checkSession, loadMedataFromDB, linkMe, getMe);

	function checkSession(req, res, next) {
		if (!req.session.email) {
			return res.send(401);
		}
		next();
	}

	function loadMedataFromDB(req, res, next) {
		var q = 'SELECT d.id, d.name FROM directories d WHERE d.owner=$1';
		var values = [req.session.email];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				console.error(err);
				winston.error('Failed to load directories from DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.locals.dirs = dbres.rows;
			next();
		});
	}

	function linkMe(req, res, next) {
		var links = [
			'</>; rel="up via service"; title="'+config.hostname+'"',
			'</.me>; rel="self item"; id=".me"; title="Your Profile"',
		].concat(res.locals.dirs.map(function(dir) {
			return '</'+dir.id+'>; rel="collection"; id="'+dir.id+'"; title="'+dir.name+'"';
		}));
		res.setHeader('Link', links.join(', '));
		next();
	}

	function getMe(req, res, next) {
		res.format({
			json: function() {
				// Send data
				res.send({
					directories: res.locals.dirs
				});
			}
		});
	}
};