var config  = require('../lib/config');
var util    = require('../lib/util');
var db      = require('../lib/db');
var express = require('express');
var winston = require('winston');

module.exports = function(server) {
	server.post('/:dir', checkPerms, addDocument);
	server.delete('/:dir/:doc', checkPerms, deleteDocument);

	function checkPerms(req, res, next) {
		if (!req.session.email) {
			return res.send(401);
		}
		// Lookup directory data
		db.getDir(req.param('dir'), function(err, directory) {
			if (err) {
				if (err.notFound) { return res.send(404); }
				console.error(err);
				winston.error('Failed to load directory from DB', { error: err, inputs: [req.param('dir')], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.locals.directory = directory;

			// Check perms
			if (req.session.email != directory.owner) {
				return res.send(403);
			}

			next();
		});
	}

	function addDocument(req, res) {
		// Vaidate
		var noBody = (!req.body || Object.keys(req.body).length === 0);
		if (!req.query.href && noBody) {
			return res.send(422, { error: 'Document body or ?href required.' });
		}
		if (req.query.href && !noBody) {
			return res.send(422, { error: 'Can only accept a document body or an ?href.' });
		}

		// Sanitize
		var meta = req.query, doc = req.body;
		var hasItem = false;
		meta.rel = meta.rel.split(' ')
			.filter(function(rel) { // filter out non-URI reltypes
				if (rel == 'item') {
					hasItem = true;
					return false; // keep
				}
				return rel.indexOf('.') !== -1;
			})
			.join(' ');
		if (!hasItem) {
			// Give all links an item reltype
			meta.rel = 'item '+meta.rel;
		}

		// Create
		var id = db.allocateSerialID();
		var ops = [{ type: 'put', key: id, value: meta, prefix: db.getDirMetaDB(req.param('dir')) }];
		if (doc) {
			ops.push({ type: 'put', key: id, value: doc, prefix: db.getDirDocsDB(req.param('dir')) });
		}
		db.getMainDB().batch(ops, function(err) {
			if (err) {
				console.error(err);
				winston.error('Failed to create document in DB', { error: err, inputs: ops, request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.setHeader('location', config.url + '/' + req.param('dir') + '/' + id);
			res.send(201);
		});
	}

	function deleteDocument(req, res) {
		// delete
		var ops = [
			{ type: 'del', key: req.param('doc'), prefix: db.getDirMetaDB(req.param('dir')) },
			{ type: 'del', key: req.param('doc'), prefix: db.getDirDocsDB(req.param('dir')) }
		];
		db.getMainDB().batch(ops, function(err) {
			if (err) {
				console.error(err);
				winston.error('Failed to delete document in DB', { error: err, inputs: ops, request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.send(204);
		});
	}
};