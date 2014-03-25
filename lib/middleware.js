// Common Middleware
// =================
var html = require('./html.js');
var config = require('./config');
var util = require('./util');
var pg = require('pg');
var winston = require('winston');

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
		"script-src 'self' https://login.persona.org",
		"frame-src https://login.persona.org",
		"style-src 'self'",
		"connect-src *"
	].join('; '));
	next();
};