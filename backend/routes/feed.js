var express = require('express');
var winston = require('winston');
var async   = require('async');
var config  = require('../lib/config');
var db      = require('../lib/db');
var util    = require('../lib/util');
var tmpl    = require('../lib/html');

module.exports = function(server) {
	server.head('/', loadMeta, addLinks, function(req, res) { res.send(204); });
	server.get('/',  loadMeta, addLinks, getFeed);
	server.post('/', addDocument);
    server.head('/:doc', padDocId, getDocument);
    server.get('/:doc', padDocId, getDocument);
    server.del('/:doc', padDocId, deleteDocument);

	function requireSession(req, res, next) {
		if (!req.session.user) {
			return res.send(401);
		}
		next();
	}

	function loadMeta(req, res, next) {
		// Fetch all metadata
		// :TODO: add pagination query params
		res.locals.items = [];
		db.getMetaDB().createReadStream({ limit: -1 })
			.on('data', res.locals.items.push.bind(res.locals.items))
			.on('end', next);
	}

	function addLinks(req, res, next) {
		var links = [
			'</>; rel="self via service"; title="'+config.hostname+'"',
			'</{id}>; rel="item"; _internal=1', // used to manage the links internally (:TODO: use a reltype instead of _internal)
			'</.auth>; rel="service"; id="auth"; title="Authentication Service"',
			'</.me>; rel="item"; id=".me"; title="Your Profile"',
			'</.fetch>; rel="service layer1.io/proxy"; id=".fetch"; title="Resource-Fetching Proxy"',
			'</.status>; rel="service"; id="status"; title="Network Host Stats"',
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

	function getFeed(req, res, next) {
		res.format({
			html: function() {
				// Render link and item slot HTMLs
				var linksHTML = [];
				res.locals.items.forEach(function(item, i) {
					// Render <link> el
					item.value.href = item.value.href ||
						(config.url + '/' + util.trim0(item.key));
					linksHTML.push(util.renderLinkEl(item.value));
				});
				linksHTML = linksHTML.join('');

				// Render page HTML
				var page = tmpl.render('feed', {
					user:          'user', //:TODO: req.session.user||'',
					user_is_admin: true, //:TODO: dir.owner && (req.session.user == dir.owner),
					links_html:    linksHTML
				});
				res.send(page);
			}
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
		meta.created_at = Date.now();

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
		var ops = [{ type: 'put', key: id, value: meta, prefix: db.getMetaDB() }];
		if (doc) {
			ops.push({ type: 'put', key: id, value: doc, prefix: db.getDocsDB(), valueEncoding: 'binary' });
		}
		db.getMainDB().batch(ops, function(err) {
			if (err) {
				console.error(err);
				winston.error('Failed to create document in DB', { error: err, inputs: ops, request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.setHeader('location', config.url + '/' + util.trim0(id));
			res.send(201);
		});
	}

	// helper to make sure the id has the proper 0pad
	function padDocId(req, res, next) {
		req.params.doc = util.pad0(req.params.doc, 16);
		next();
	}

	function getDocument(req, res, next) {
		db.getMetaDB().get(req.param('doc'), function(err, meta) {
			if (err) {
				if (err.notFound) { return next(); } // next instead of 404 so that the static handlers can look for files
				console.error(err);
				winston.error('Failed to load doc meta from DB', { error: err, inputs: [req.param('doc')], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.setHeader('Content-Type', meta.type||'text/plain');
			var links = [
				'</>; rel="via up service"; title="'+config.hostname+'"',
			];
			meta.rel = 'self '+meta.rel;
			if (!meta.href) { // No href? Then this is a document we host
				meta.href = '/' + req.param('doc');
			}
			links.push(util.serializeLinkObject(meta));
			res.setHeader('Link', links.join(','));

            if (req.method == 'HEAD') {
                return res.send(204);
            }

			db.getDocsDB().get(req.param('doc'), { valueEncoding: 'binary' }, function(err, doc) {
				if (err && !err.notFound) {
					console.error(err);
					winston.error('Failed to load doc from DB', { error: err, inputs: [req.param('doc')], request: util.formatReqForLog(req) });
					return res.send(500);
				}

				if (doc) { res.end(doc); }
				else { res.end(); }
			});
		});
	}

	function deleteDocument(req, res) {
		// delete
		var ops = [
			{ type: 'del', key: req.param('doc'), prefix: db.getMetaDB() },
			{ type: 'del', key: req.param('doc'), prefix: db.getDocsDB() }
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