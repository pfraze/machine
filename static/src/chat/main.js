// Environment Setup
// =================
var pagent = require('./pagent');
var apps = require('./apps.ui');
local.logAllExceptions = true;
pagent.setup();
apps.setup();

// Servers
local.addServer('worker-bridge', require('./worker-bridge.js'));
local.addServer('chat.ui', require('./chat.ui'));
local.addServer('apps.ui', require('./apps.ui'));
local.addServer('mediastream.app', require('./mediastream.app'));
local.addServer('nquery', pagent.n$Service);

// httpl://appcfg
// - hosts an index for the application's dev-configged endpoints
(function() {
	var appcfg = servware();
	local.addServer('appcfg', appcfg);
	appcfg.route('/', function(link) {
		link({ href: 'httpl://roomhost.fixture', rel: 'todo.com/rel/roomhost', title: 'Chat Room Host' });
		link({ href: 'httpl://chat.ui', rel: 'todo.com/rel/chatui', title: 'Chat UI' });
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