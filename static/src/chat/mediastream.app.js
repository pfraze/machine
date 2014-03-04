// MediaStream.app Server
// ======================
var util = require('../util');
var pagent = require('./pagent');
var linkRegistry = require('./linkregistry');

var server = servware();
module.exports = server;

server.route('/', function(link, method) {
	link({ href: '/{?nquery}', rel: 'self service todo.com/rel/agent todo.com/rel/agent/app', uses: 'todo.com/rel/nquery', title: 'Media-stream' });

	method('INVOKE', { stream: true }, allowDocument, run);
});

function allowDocument(req, res) {
	if (!req.header('Origin')) return true; // allow from document
	throw 403;
}

function run(req, res) {
	console.log('mediastream app invoked with nquery=',req.query.nquery);
	res.writeHead(204, 'No Content');

	var n$ = nQuery.client(req.query.nquery);
	n$('').html('<p>Hello, world! This was setup with nQuery! <strong>ISNT IT PRETTY</strong></p>');
	n$('p').css('background', 'yellow');
	n$('p').css('color', 'green');

	req.on('end', function() {
		console.log('mediastream app closed');
		res.end();
	});
}