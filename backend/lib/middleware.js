// Common Middleware
// =================
var html      = require('./html.js');
var config    = require('./config');
var util      = require('./util');
var mimetypes = require('../../shared/mimetypes');
var winston   = require('winston');
var Buffer    = require('buffer').Buffer;
var path      = require('path');
var fs        = require('fs');
var db        = require('./db');

module.exports.setCorsHeaders = function(req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
	res.setHeader('Access-Control-Allow-Credentials', true);
	res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, HEAD, GET, PUT, PATCH, POST, DELETE, NOTIFY, SUBSCRIBE');
	res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-req-headers'] || 'Accept, Authorization, Connection, Cookie, Content-Type, Content-Length, Host');
	res.setHeader('Access-Control-Expose-Headers', req.headers['access-control-req-headers'] || 'Content-Type, Content-Length, Date, ETag, Last-Modified, Link, Location');
	res.setHeader('Access-Control-Max-Age', 60*60*24); // in seconds
	next();
};

module.exports.setCspHeaders = function(req, res, next) {
	res.setHeader('Content-Security-Policy', [
		"default-src 'none'",
		"img-src *", // SHOULD BE SELF
		"font-src 'self'",
		"script-src 'self' blob:",
		"style-src 'self' 'unsafe-inline'",
		"connect-src *"
	].join('; '));
	next();
};

module.exports.bodyCollector = function(req, res, next) {
	// console.error()
	var ctype = req.headers['content-type'];
	if (!ctype) {
		return next();
	}

	var chunks = [];
	req.on('data', function(chunk) { chunks.push(chunk); });
	req.on('end', function() {
		req.body = Buffer.concat(chunks);
		next();
	});
};

module.exports.linkFileSystem = function(req, res, next) {
	var links = [];
	if (req.path[0] == '.') {
		// A service, will link itself
		next();
	}
	else if (req.path[req.path.length - 1] == '/') {
		// A directory
		if (req.path != '/') { links.push(parentDirectoryLink(req.path)); }
		if (req.path == '/') {
			links.push({ rel: 'self layer1.io/server layer1.io/directory', href: req.path });
		} else {
			links.push({ rel: 'self layer1.io/directory', id: path.basename(req.path), href: req.path });
		}

		// Get files listing
		fs.readdir(path.join('./files', req.path), function(err, files) {
			if (err) {
				console.log('error reading directory', path.join('./files', req.path), err);
			}
			if (files && files.length) {
				for (var i=0; i < files.length; i++) {
					var filename = files[i];
					var mimetype = mimetypes.lookup(filename);
					links.push({ rel: 'layer1.io/file', id: filename, href: req.path + filename, type: mimetype });
				}
			}
			links = links.map(util.serializeLinkObject);

			// Get any saved links
			db.get().all('SELECT attributes FROM links WHERE anchor = ?', [req.path+'index.html'], function(err, rows) {
				if (err) {
					console.log('error finding directory links', req.path+'index.html', err);
				}
				if (rows && rows.length) {
					for (var i=0; i < rows.length; i++) {
						links.push(rows[i].attributes);
					}
				}

				res.header('Link', links.join(', '));
				next();
			});
		});
	}
	else {
		// A file
		var filename = path.basename(req.path);
		var mimetype = mimetypes.lookup(filename);
		links.push(parentDirectoryLink(req.path));
		links.push({ rel: 'self layer1.io/file', id: filename, href: req.path, type: mimetype });
		links = links.map(util.serializeLinkObject);

		// Get any saved links
		db.get().all('SELECT attributes FROM links WHERE anchor = ?', [req.path], function(err, rows) {
			if (err) {
				console.log('error finding directory links', req.path, err);
			}
			if (rows && rows.length) {
				for (var i=0; i < rows.length; i++) {
					links.push(rows[i].attributes);
				}
			}

			res.header('Link', links.join(', '));
			next();
		});
	}
};

function parentDirectoryLink(filepath) {
	var parentpath = path.dirname(filepath);
	var parentname = path.basename(parentpath);
	if (!parentname) {
		// Toplevel
		return { rel: 'up layer1.io/server layer1.io/directory', href: parentpath };
	}
	return { rel: 'up layer1.io/directory', id: parentname, href: parentpath };
}