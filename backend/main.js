var http    = require('http');
var https   = require('https');
var express = require('express');
var winston = require('winston');
var toobusy = require('toobusy');
var limiter = require('connect-ratelimit');
var fs      = require('fs');

var db         = require('./lib/db');
var middleware = require('./lib/middleware.js');
var html       = require('./lib/html.js');
var frontendjs = require('./lib/frontendjs.js');

// Config
// ======
// Construct config from a combination of CLI, config.json, and defaults
var argv = require('optimist').argv;
var config = require('./lib/config');
var configDefaults = {
	hostname: require("os").hostname(),
	port: undefined,
	'public': false,
	ssl: false,
	is_upstream: false,
	downstream_port: false,
	dbpath: false,
	debug_auth: false
};
var configCLI = {
	hostname: argv.h || argv.hostname,
	port: argv.p || argv.port,
	'public': argv['public'],
	ssl: argv.ssl,
	is_upstream: (typeof (argv.u || argv.is_upstream) != 'undefined') ? !!(argv.u || argv.is_upstream) : undefined,
	downstream_port: argv.u || argv.is_upstream,
	dbpath: argv.dbpath,
	debug_auth: argv.debug_auth
};
function refreshConfig() {
	// Read config.json
	var configFile = {};
	try { configFile = JSON.parse(fs.readFileSync('./backend/config.json')); }
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

// Read assets with config mixed in
html.load(config);
frontendjs.load(config);

// Server Creation
// ===============
var server = express();
winston.add(winston.transports.File, { filename: './backend/server.log', handleExceptions: false });
winston.remove(winston.transports.Console); // its console logging is too ugly
db.setup(config.dbpath);

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
// server.use(express.bodyParser()); using middleware.bodyCollector instead
server.use(middleware.bodyCollector);
server.use(express.cookieParser());
server.use(express.compress());
server.use(express.session({ secret: "TODO-- come up with secret" }));
if (config.debug_auth) {
	server.all('*', function(req, res, next) {
		req.session.user = config.debug_auth;
		next();
	});
} else {
	// :TODO: replace with real auth
	server.all('*', function(req, res, next) {
		req.session.user = 'user';
		next();
	});
}
if (config.ssl) {
	server.use(function(req, res, next) {
		res.setHeader('Strict-Transport-Security', 'max-age=8640000; includeSubDomains');
		next();
	});
}
server.all('*', middleware.setCorsHeaders);
server.all('*', middleware.setCspHeaders);
server.options('*', function(req, res) {
	res.writeHead(204);
	res.end();
});

// Routes
// ======
// Status page
server.all('/.status', function(req, res, next) {
	res.setHeader('Link', [
		'</>; rel="up via service"; title="'+config.hostname+'"',
		'</.status>; rel="self service"; id="status"; title="Network Host Stats"'
	].join(', '));
	next();
});
server.head('/.status', function(req, res) { res.send(204); });
server.get('/.status', function(req, res) {
	var uptime = (new Date() - server.startTime);
	var stats = require('./lib/metrics').toJSON();
	stats.started_at = server.startTime.toLocaleString();
	stats.uptime_hours = uptime/(60*60*1000);
	stats.uptime_days = uptime/(24*60*60*1000);
	res.json(stats);
});
// Security test route
server.get('/sec-test', function(req, res) {
	res.setHeader('Content-Security-Policy', ''); // turn off CSP for the test
	res.send(html.render('secTest'));
});
// Static content
server.use('/js', express.static(__dirname + '/../frontend/js', { maxAge: 1000*60*60*24 }));
server.use('/css', express.static(__dirname + '/../frontend/css', { maxAge: 1000*60*60*24 }));
server.use('/img', express.static(__dirname + '/../frontend/img', { maxAge: 1000*60*60*24 }));
server.use('/fonts', express.static(__dirname + '/../frontend/fonts', { maxAge: 1000*60*60*24 }));
server.use('/files', express.static(__dirname + '/../files'));
// Program routes
require('./routes/auth')(server);
require('./routes/me')(server);
require('./routes/fetchProxy')(server);
require('./routes/feed')(server);

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
	https.createServer(sslOpts, server).listen(config.port, (config['public'] ? undefined : 'localhost'));
} else {
	server.listen(config.port, (config['public'] ? undefined : 'localhost'));
}
server.startTime = new Date();

// start bananer
winston.info('Relay HTTP server listening on port '+config.port, config);
console.log('Relay HTTP server listening on port '+config.port);
console.log(config);
if (config['public']) {
	console.log('++================================================++');
	console.log('|| Public Mode - Accepting requests from any host ||');
	console.log('++================================================++');
} else {
	console.log('++=======================================================++');
	console.log('|| Private Mode - Accepting requests from localhost only ||');
	console.log('++=======================================================++');
}

// PID Management
// ==============
fs.writeFileSync('./pid', process.pid);
process.on('SIGINT', process.exit.bind(process, 0));
process.on('uncaughtException', function(e) {
    console.error(e);
    process.exit(0);
});
process.on('exit', function() { fs.unlinkSync('./pid'); });