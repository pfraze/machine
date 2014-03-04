// Environment Setup
// =================
var pagent = require('./pagent.js');
local.logAllExceptions = true;
pagent.setup();

// Servers
local.addServer('worker-bridge', require('./worker-bridge.js'));
local.addServer('chat.ui', require('./chat.ui'));
local.addServer('mediastream.app', require('./mediastream.app'));

// httpl://appcfg
// - hosts an index for the application's dev-configged endpoints
(function() {
	var appcfg = servware();
	local.addServer('appcfg', appcfg);
	appcfg.route('/', function(link) {
		link({ href: 'httpl://roomhost.fixture', rel: 'todo.com/rel/roomhost', title: 'Chat Room Host' });
		link({ href: 'httpl://chat.ui', rel: 'todo.com/rel/chatui', title: 'Local Chat UI' });
	});
})();

// :TEMP: httpl://roomhost.fixture
(function() {
	var roomhost = servware();
	local.addServer('roomhost.fixture', roomhost);
	roomhost.route('/', function(link, method) {
		link({ href: '/', rel: 'self service todo.com/rel/roomhost', title: 'Chat Room Host' });
		method('EMIT', function() { return 200; });
	});
})();

// Configure via chat
local.dispatch({ method: 'RECV', url: 'httpl://chat.ui', body: { msg: 'Welcome! Let\'s get you setup. httpl://mediastream.app' } });