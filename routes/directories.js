var express = require('express');
var winston = require('winston');
var config = require('../lib/config');
var util = require('../lib/util');
var tmpl = require('../lib/html');

module.exports = function(server) {
	server.post('/',        checkSession, createDir);
	server.head('/:dir',    loadDirFromDB, linkDir, function(req, res) { res.send(204); });
	server.get('/:dir',     loadDirFromDB, linkDir, getDir);
	server.get('/:dir/app', getDirAutoapp);
	server.delete('/:dir',  checkSession, deleteDir);

	function checkSession(req, res, next) {
		if (!req.session.email) {
			return res.send(401);
		}
		next();
	}

	function loadDirFromDB(req, res, next) {
		var q = 'SELECT name, owner FROM directories WHERE id=$1 LIMIT 1';
		var values = [req.param('dir')];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				console.error(err);
				winston.error('Failed to load directory from DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.locals.dir = dbres.rows[0];
			res.locals.dir.links = [];
			next();
		});
	}

	function linkDir(req, res, next) {
		var links = [
			'</>; rel="up via service"; title="'+config.hostname+'"',
			'</'+req.param('id')+'>; rel="self collection"; id="'+req.param('id')+'"',
		].concat(res.locals.dir.links.map(util.serializeLinkObject));
		res.setHeader('Link', links.join(', '));
		next();
	}

	function getDir(req, res, next) {
		res.format({
			html: function() {
				// Render HTML
				var dir = res.locals.dir;
				var page = tmpl.render('directory', {
					user: req.session.email||'',
					is_owner: dir.owner && (req.session.email == dir.owner),
					dirname: dir.name,
					links_html: dir.links.map(function(link) {
						return tmpl.render('directory_link_partial', link);
					}).join('<hr>')
				});
				res.send(page);
			}
		});
	}

	function getDirAutoapp(req, res, next) {
		// :TODO:
		res.send(501);
	}

	function createDir(req, res, next) {
		// Validate
		if (!req.body) {
			return res.send(422, 'Body required.');
		}
		var errors = {};
		if (!req.body.name) { errors.name = 'Required.'; }
		if (Object.keys(errors).length !== 0) {
			res.send(422, errors);
		}

		// Create
		var id = util.dirify(req.body.name);
		var q = 'INSERT INTO directories (id, name, owner) SELECT $1, $2, $3';
		var values = [id, req.body.name, req.session.email];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				if (err.code == '23505') {
					// ID already in use
					return res.send(409);
				}
				console.error(err);
				winston.error('Failed to create directory in DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.setHeader('location', config.url + '/' + id);
			res.send(201);
		});
	}

	function deleteDir(req, res, next) {
		var q = 'DELETE FROM directories WHERE id=$1 AND owner=$2';
		var values = [req.param('dir'), req.session.email];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				console.error(err);
				winston.error('Failed to delete directory from DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.send(204);
		});
	}
};