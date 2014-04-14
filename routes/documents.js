var config  = require('../lib/config');
var util    = require('../lib/util');
var db      = require('../lib/db');
var express = require('express');
var winston = require('winston');

module.exports = function(server) {
	// :TODO: head
	server.get('/:dir/:doc', getDocument);
	server.post('/:dir', checkPerms, addDocument);
	server.put('/:dir/:doc/meta', checkPerms, updateDocumentMeta);
	server.delete('/:dir/:doc', checkPerms, deleteDocument);

	function getDocument(req, res, next) {
		db.getDirMetaDB(req.param('dir')).get(req.param('doc'), function(err, meta) {
			if (err) {
				if (err.notFound) { return next(); } // next instead of 404 so that the static handlers can look for files
				console.error(err);
				winston.error('Failed to load doc meta from DB', { error: err, inputs: [req.param('dir')], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.setHeader('Content-Type', meta.type);
			// :TODO: link header

			db.getDirDocsDB(req.param('dir')).get(req.param('doc'), { valueEncoding: 'binary' }, function(err, doc) {
				if (err && !err.notFound) {
					console.error(err);
					winston.error('Failed to load doc from DB', { error: err, inputs: [req.param('dir')], request: util.formatReqForLog(req) });
					return res.send(500);
				}

				if (doc) { res.end(doc); }
				else { res.end(); }
			});
		});
	}

	function checkPerms(req, res, next) {
		if (!req.session.user) {
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
			if (req.session.user != directory.owner) {
				return res.send(403);
			}

			next();
		});
	}

	function addDocument(req, res) {
		// Vaidate
		if (!req.query.href && !req.body) {
			return res.send(422, { error: 'Document body or ?href required.' });
		}
		if (req.query.href && req.body) {
			return res.send(422, { error: 'Can only accept a document body or an ?href.' });
		}

		// Sanitize
		var meta = req.query, doc = req.body;
		meta.rel = (meta.rel||'').split(' ')
			.filter(function(rel) { return rel.indexOf('.') !== -1; }) // filter out non-URI reltypes
			.join(' ');

		// Make all doc links a media type
		if (doc) {
			if (!hasMediaReltype(meta.rel)) {
				meta.rel = 'stdrel.com/media '+meta.rel;
			}
			if (!meta.type) {
				var mimeType = req.headers['content-type'];
				var semicolonIndex = mimeType.indexOf(';');
				if (semicolonIndex !== -1) {
					mimeType = mimeType.slice(0, semicolonIndex); // strip the charset
				}
				meta.type = mimeType;
			}
		}

		// Create
		var id = db.allocateSerialID();
		var ops = [{ type: 'put', key: id, value: meta, prefix: db.getDirMetaDB(req.param('dir')) }];
		if (doc) {
			ops.push({ type: 'put', key: id, value: doc, prefix: db.getDirDocsDB(req.param('dir')), valueEncoding: 'binary' });
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

	function updateDocumentMeta(req, res) {
		if (!req.is('json')) return res.send(415);

		// fetch meta to make sure it exists
		db.getDirMetaDB(req.param('dir')).get(req.param('doc'), function(err) {
			if (err) {
				if (err.notFound) { return res.send(404); }
				console.error(err);
				winston.error('Failed to load doc meta from DB', { error: err, inputs: [req.param('dir')], request: util.formatReqForLog(req) });
				return res.send(500);
			}

			var meta = req.body;
			try { meta = JSON.parse(meta.toString()); }
			catch (e) { return res.send(400, { error: 'Unable to parse JSON body' }); }

			meta.rel = (meta.rel||'').split(' ')
				.filter(function(rel) { return rel.indexOf('.') !== -1; }) // filter out non-URI reltypes
				.join(' ');
			delete meta.href; // dont allow for now

			// replace
			db.getDirMetaDB(req.param('dir')).put(req.param('doc'), meta, function(err) {
				if (err) {
					console.error(err);
					winston.error('Failed to update doc meta in DB', { error: err, inputs: [req.param('dir'), meta], request: util.formatReqForLog(req) });
					return res.send(500);
				}

				res.send(204);
			});
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

	// helpers
	var mediaReltypeRegex = /(^|\b)stdrel.com\/media(\b|$)/i;
	function hasMediaReltype(rel) {
		return mediaReltypeRegex.test(rel);
	}
};