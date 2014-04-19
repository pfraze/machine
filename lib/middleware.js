// Common Middleware
// =================
var html    = require('./html.js');
var config  = require('./config');
var util    = require('./util');
var winston = require('winston');
var Buffer  = require('buffer').Buffer;

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
		"img-src 'self'",
		"font-src 'self'",
		"script-src 'self' blob:",
		"style-src 'self'",
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