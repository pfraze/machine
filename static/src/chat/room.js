// Local Room Server
// =================
var util = require('../util');

var server = servware();
module.exports = server;

var $chathost = local.agent('httpl://appcfg').follow({ rel: 'todo.com/rel/roomhost' });

$('#chat-in').on('keypress', function(e) {
	var is_enter = (e.keyCode == 13);
	if (is_enter) {
		// Clear input on enter
		$(this).val('');
	}
});

server.route('/', function(link, method) {
	link({ href: '/', rel: 'self service collection', id: 'cli', title: 'Command Line' });
	link({ href: '/{id}', rel: 'item', title: 'Update', hidden: true });

	method('HEAD', allowSelf, function() { return 204; });
	method('POST', allowSelf, validate, sendToChathost);
});

function allowSelf(req, res) {
	var from = req.header('From');
	if (!from) return true; // allow from document
	if (from == 'httpl://'+req.header('Host')) return true; // allow self
	// :TODO: allow chathost
	throw 403;
}

function validate(req, res) {
	// Validate inputs
	req.assert({ type: ['application/json', 'application/x-www-form-urlencoded', 'text/plain'] });
	if (typeof req.body == 'string') { req.statement = req.body; }
	else if (req.body.statement) { req.statement = req.body.statement; }
	else { throw [422, 'Must pass a text/plain string or an object with a `statement` string attribute.']; }
	return true;
}

function sendToChathost(req, res) {
	return $chathost.POST(req.body.statement);
}