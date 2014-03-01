// Environment Setup
// =================
var pagent = require('./pagent.js');
local.logAllExceptions = true;
pagent.setup();

// Worker management
local.addServer('worker-bridge', require('./worker-bridge.js'));

// Servers
local.addServer('chat.ui', require('./chat.ui'));

// httpl://appcfg
// - hosts an index for the application's dev-configged endpoints
(function() {
	var appcfg = servware();
	local.addServer('appcfg', appcfg);
	appcfg.route('/', function(link) {
		link({ href: 'httpl://roomhost.fixture', rel: 'todo.com/rel/roomhost', title: 'Chat Room Host' });
		link({ href: 'httpl://roomindex.fixture', rel: 'todo.com/rel/index', id: 'room', title: 'Chat Room Index' });
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

// :TEMP: httpl://roomindex.fixture
(function() {
	var roomindex = servware();
	local.addServer('roomindex.fixture', roomindex);
	roomindex.route('/', function(link, method) {
		link({ href: '/', rel: 'self service todo.com/rel/index', id: 'room', title: 'Chat Room Index' });
		method('POST', function() { return 200; });
	});
})();