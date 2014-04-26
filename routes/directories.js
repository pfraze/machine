var express = require('express');
var winston = require('winston');
var async   = require('async');
var config  = require('../lib/config');
var db      = require('../lib/db');
var util    = require('../lib/util');
var tmpl    = require('../lib/html');

module.exports = function(server) {
	server.post('/',        requireSession, createDir);
	server.head('/:dir',    loadDirFromDB, linkDir, function(req, res) { res.send(204); });
	server.get('/:dir',     loadDirFromDB, linkDir, getDir);
	server.delete('/:dir',  requireSession, deleteDir);

	function requireSession(req, res, next) {
		if (!req.session.user) {
			return res.send(401);
		}
		next();
	}

	function loadDirFromDB(req, res, next) {
		// Lookup directory data
		db.getDir(req.param('dir'), function(err, directory) {
			if (err) {
				if (err.notFound) { return res.send(404); }
				console.error(err);
				winston.error('Failed to load directory from DB', { error: err, inputs: [req.param('dir')], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.locals.directory = directory;

			// Fetch all metadata
			// :TODO: add pagination query params
			res.locals.items = [];
			var dirMetaDb = db.getDirMetaDB(req.param('dir'));
			dirMetaDb.createReadStream({ limit: -1 })
				.on('data', res.locals.items.push.bind(res.locals.items))
				.on('end', next);
		});
	}

	// :NOTE: removed from the GET route, no longer needed
	/*function loadJsonDocsFromDB(req, res, next) {
		// Find all the json docs
		// :TODO: can't this just be a readstream that's setup exactly like the meta read?
		//        the two db segments *should* mirror each other
		var fetches = {};
		var docDb = db.getDirDocsDB(req.param('dir'));
		res.locals.items.forEach(function(item, i) {
			if (item.value.type != 'application/json') { return; }
			// Queue up a read function
			fetches[item.key] = docDb.get.bind(docDb, item.key, { valueEncoding: 'binary' });
		});
		async.parallel(fetches, function(err, jsonDocs) {
			if (err) {
				// :TODO: if any fail, there is an err. Does that mean all abort?
				console.error('Error loading directory document(s) from DB', err);
			}
			res.locals.jsonDocs = jsonDocs || {};
			next();
		});
	}*/

	function linkDir(req, res, next) {
		var dirUrl = '/'+req.param('dir');
		var links = [
			'</>; rel="up via service"; title="'+config.hostname+'"',
			'<'+dirUrl+'>; rel="self collection"; id="'+req.param('dir')+'"', // :TODO: more specific reltype
			'<'+dirUrl+'/{id}>; rel="item"; _internal=1', // used to manage the links internally (:TODO: use a reltype instead of _internal)
		];
		// :TODO: put behind a flag
		/*res.locals.items.forEach(function(item) {
			if (!item.value.href) { // No href? Then this is a document we host
				item.value.href = dirUrl + '/' + item.key; // Link to the hosted document
			}
			links.push(util.serializeLinkObject(item.value));
		});*/
		res.setHeader('Link', links.join(', '));
		next();
	}

	function getDir(req, res, next) {
		res.format({
			json: function() {
				// Send data
				res.send(res.locals.directory);
			},
			html: function() {
				// Render link and item slot HTMLs
				var linksHTML = [];
				res.locals.items.forEach(function(item, i) {
					// Render <link> el
					item.value.href = item.value.href ||
						(config.url + '/' + req.param('dir') + '/' + util.trim0(item.key));
					linksHTML.push(util.renderLinkEl(item.value));
				});
				linksHTML = linksHTML.join('');

				// Render page HTML
				var dir = res.locals.directory;
				var page = tmpl.render('directory', {
					user:          'user', //:TODO: req.session.user||'',
					user_is_admin: true, //:TODO: dir.owner && (req.session.user == dir.owner),
					dirname:       dir.id,
					dirage:        util.timeago(dir.created_at),
					links_html:    linksHTML
				});
				res.send(page);
			}
		});
	}

	function createDir(req, res, next) {
		// Parse
		if (!req.body) { return res.send(422, { error: 'Body required.' }); }
		try { req.body = JSON.parse(req.body.toString()); }
		catch (e) { return res.send(422, { error: 'Malformed JSON: '+e }); }

		// Validate
		var errors = {};
		if (!req.body.id) { errors.id = 'Required.'; }
		else {
			if (req.body.id.length <= 2) { errors.id = 'Must be more than 2 characters long.'; }
			else if (/[^A-z0-9-_]/.test(req.body.id)) { errors.id = 'Can only include characters, numbers, - and _.'; }
		}
		if (Object.keys(errors).length !== 0) {
			return res.send(422, errors);
		}
		var id = req.body.id.toLowerCase();
		if (db.isDirectoryIDTaken(id)) { return res.send(409); } // conflict

		// Create
		id = db.allocateDirID(id);
		var value = { id: id, owner: req.session.user, created_at: Date.now() };
		db.getMainDB().put(id, value, function(err) {
			if (err) {
				console.error(err);
				winston.error('Failed to create directory in DB', { error: err, inputs: [id, value], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.setHeader('location', config.url + '/' + id);
			res.send(201);
		});
	}

	function deleteDir(req, res, next) {
		// Fetch directory
		db.getMainDB().get(req.param('dir'), function(err, directory) {
			if (err) {
				if (err.notFound) { return res.send(404); }
				console.error(err);
				winston.error('Failed to load directory from DB', { error: err, inputs: [req.param('dir')], request: util.formatReqForLog(req) });
				return res.send(500);
			}

			// Check ownership
			if (directory.owner != req.session.user) {
				return res.send(403);
			}

			// Delete
			db.getMainDB().del(req.param('dir'), function(err) {
				if (err) {
					console.error(err);
					winston.error('Failed to delete directory from DB', { error: err, inputs: [req.param('dir')], request: util.formatReqForLog(req) });
					return res.send(500);
				}
				// Release directory ID
				db.deallocateDirID(req.param('dir'));

				// Clear out items
				var metaDb = db.getDirMetaDB(req.param('dir'));
				var docsDb = db.getDirDocsDB(req.param('dir'));

				metaDb.createKeyStream({ limit: -1 })
					.on('data', addOp)
					.on('end', doBatch);

				var ops = [];
				function addOp(key) {
					ops.push({ type: 'del', key: key, prefix: metaDb });
					ops.push({ type: 'del', key: key, prefix: docsDb });
				}
				function doBatch() {
					db.getMainDB().batch(ops, function(err) {
						if (err) {
							console.error(err);
							winston.error('Failed to delete documents in DB', { error: err, inputs: ops, request: util.formatReqForLog(req) });
							return res.send(500);
						}
						res.send(204);
					});
				}
			});
		});
	}
};