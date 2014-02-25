var http = require('http');
var https = require('https');
var express = require('express');
var winston = require('winston');
var toobusy = require('toobusy');
var limiter = require('connect-ratelimit');
var fs = require('fs');

var middleware = require('./lib/middleware.js');
var html = require('./lib/html.js');

// Config
// ======
// Construct config from a combination of CLI, config.json, and defaults
var argv = require('optimist').argv;
var config = require('./lib/config');
var configDefaults = {
	hostname: require("os").hostname(),
	port: undefined,
	ssl: false,
	is_upstream: false,
	downstream_port: false,
	pgconnection: false
};
var configCLI = {
	hostname: argv.h || argv.hostname,
	port: argv.p || argv.port,
	ssl: argv.ssl,
	is_upstream: (typeof (argv.u || argv.is_upstream) != 'undefined') ? !!(argv.u || argv.is_upstream) : undefined,
	downstream_port: argv.u || argv.is_upstream,
	pgconnection: argv.pg
};
function refreshConfig() {
	// Read config.json
	var configFile = {};
	try { configFile = JSON.parse(fs.readFileSync('./config.json')); }
	catch (e) { console.error('Failed to load ./config.json', e); }

	// Merge config
	function merge(a, b) { return (typeof a != 'undefined') ? a : b; }
	for (var k in configDefaults) {
		config[k] = merge(configCLI[k], merge(configFile[k], configDefaults[k]));
	}
	if (typeof config.port == 'undefined') {
		config.port = (config.ssl) ? 443 : 8000;
	}
}
refreshConfig();

// Construct service URL (note: only done at init, not on the reload signal, since reload doesn't update service info)
var urlPort = config.downstream_port || config.port;
if (config.ssl && urlPort == '443') urlPort = false;
if (!config.ssl && urlPort == '80') urlPort = false;
config.authority = config.hostname + (urlPort ? (':' + urlPort) : '');
config.url = ((config.ssl) ? 'https://' : 'http://') + config.authority;

// Read HTML with config mixed in
html.load(config);

// Server Creation
// ===============
var server = express();
winston.add(winston.transports.File, { filename: 'server.log', handleExceptions: false });

// Common Handlers
// ===============
server.use(limiter({
	whitelist: ['127.0.0.1']
}));
server.use(function(req, res, next) {
	if (toobusy()) {
		res.send(503, "We are under heavy load! Please try again later.");
	} else {
		next();
	}
});
server.use(express.bodyParser());
server.use(express.cookieParser());
server.use(express.compress());
if (config.ssl) {
	server.use(function(req, res, next) {
		res.setHeader('Strict-Transport-Security', 'max-age=8640000; includeSubDomains');
		next();
	});
}
server.all('*', middleware.setCorsHeaders);
server.all('*', middleware.setCspHeaders);
server.all('*', middleware.getDbClient);
server.options('*', function(req, res) {
	res.writeHead(204);
	res.end();
});

// Routes
// ======
// Status page
server.all('/status', function(req, res, next) {
	res.setHeader('Link', [
		'</>; rel="up via service gwr.io/grimwire"; title="'+config.hostname+'"',
		'</status>; rel="self service"; id="status"; title="Network Host Stats"'
	].join(', '));
	next();
});
server.head('/status', function(req, res) { res.send(204); });
server.get('/status', function(req, res) {
	var uptime = (new Date() - server.startTime);
	var stats = require('./lib/metrics').toJSON();
	stats.started_at = server.startTime.toLocaleString();
	stats.uptime_hours = uptime/(60*60*1000);
	stats.uptime_days = uptime/(24*60*60*1000);
	res.json(stats);
});
// Other routes
// require('./routes/guis')(server);
// require('./routes/gui_db')(server);
// Static content
server.use('/', express.static(__dirname + '/static', { maxAge: 1000*60*60*24 }));

// Reload signal
// =============
process.on('SIGHUP', function() {
	winston.info('Received SIGHUP signal, reloading configuration.');
	refreshConfig();
	html.load(config);
});

// Server Start
// ============
if (config.ssl && !config.is_upstream) {
	var sslOpts = {
		key: require('fs').readFileSync('ssl-key.pem'),
		cert: require('fs').readFileSync('ssl-cert.pem')
	};
	https.createServer(sslOpts, server).listen(config.port);
} else {
	server.listen(config.port);
}
server.startTime = new Date();
winston.info('Relay HTTP server listening on port '+config.port, config);

// PID Management
// ==============
fs.writeFileSync('./pid', process.pid);
process.on('SIGINT', process.exit.bind(process, 0));
process.on('uncaughtException', function(e) {
    console.error(e);
    process.exit(0);
});
process.on('exit', function() { fs.unlinkSync('./pid'); });