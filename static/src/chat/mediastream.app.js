// MediaStream.app Server
// ======================
var util = require('../util');
var pagent = require('./pagent');
var linkRegistry = require('./linkregistry');

var server = servware();
module.exports = server;

server.route('/', function(link, method) {
	link({ href: '/', rel: 'self service todo.com/rel/agent todo.com/rel/agent/app', title: 'Media-stream' });
});