var config = require('../lib/config');
var util = require('../lib/util');
var express = require('express');
var winston = require('winston');

module.exports = function(server) {
	server.post('/:dir', checkPerms, addLink); // takes full link JSON, initiates reltype fetches if needed
	server.delete('/:dir/:link', checkPerms, deleteLink);

	function checkPerms(req, res, next) {
		if (!req.session.email) {
			return res.send(401);
		}
		var q = 'SELECT id FROM directories WHERE id=$1 AND owner=$2';
		var values = [req.param('dir'), req.session.email];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				console.error(err);
				winston.error('Failed to fetch directory for perms check in DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			if (!dbres.rows[0]) {
				res.send(403);
			}
			next();
		});
	}

	function addLink(req, res) {
		// Vaidate
		if (!req.body) {
			return res.send(422, 'Body required.');
		}
		var errors = {};
		if (!req.body.href) { errors.href = 'Required.'; }
		if (Object.keys(errors).length !== 0) {
			return res.send(422, errors);
		}

		// Sanitize
		var relArray = (req.body.rel) ? req.body.rel.split(' ') : null;
		if (relArray) {
			relArray = relArray.filter(function(rel) { return rel.indexOf('.') !== -1; }); // filter out non-URI reltypes
		}

		// Create
		var q = [
			'INSERT INTO links (dir_id, href, title, rel, meta)',
				'SELECT $1, $2, $3, $4, $5',
				'RETURNING id'
		].join(' ');
		var values = [req.param('dir'), req.body.href, req.body.title||null, relArray, JSON.stringify(req.body)];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				console.error(err);
				winston.error('Failed to create link in DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.setHeader('location', config.url + '/' + req.param('dir') + '/' + dbres.rows[0].id);
			res.send(201);
		});
	}

	function deleteLink(req, res) {
		var q = 'DELETE FROM links WHERE id=$1 AND dir_id=$2';
		var values = [req.param('link'), req.param('dir')];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				console.error(err);
				winston.error('Failed to delete link in DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.send(204);
		});
	}
};