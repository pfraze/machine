// Chat.ui Server
// ==============
var util = require('../util');
var pagent = require('./pagent');
var linkRegistry = require('./linkregistry');
var roomhostUA = local.agent('httpl://appcfg').follow({ rel: 'todo.com/rel/roomhost' });

var server = servware();
module.exports = server;

server.route('/', function(link, method) {
	link({ href: '/', rel: 'self service todo.com/rel/chatui', title: 'Local Chat UI' });

	method('HEAD', allowSelf, function() { return 204; });
	method('EMIT', allowSelf, validate, sendToChathost, clearInput, render);
	method('RECV', allowChatHost, validate, render);
});

server.route('/index/:id', function(link, method) {
	link({ href: '/', rel: 'up via service todo.com/rel/chatui', title: 'Local Chat UI' });
	link({ href: '/index/:id', rel: 'self item' });

	method('HEAD', allowSelf, function() { return 204; });
	method('ENABLE', allowSelf, toggleIndexEntryCB(true));
	method('DISABLE', allowSelf, toggleIndexEntryCB(false));
});

function allowSelf(req, res) {
	var origin = req.header('Origin');
	if (!origin) return true; // allow from document
	if (origin == 'httpl://'+req.header('Host')) return true; // allow self
	throw 403;
}

function allowChatHost(req, res) {
	return roomhostUA.resolve().then(function(url) {
		if (req.header('Origin') == url) return true; // allow chathost
		throw 403;
	});
}

function validate(req, res) {
	if (!req.body.msg) { throw [422, 'Must pass a json or form object with a `.msg` string.']; }
	return true;
}

function sendToChathost(req, res) {
	return roomhostUA.dispatch({ method: 'EMIT', body: req.body.msg }).then(function() { return true; });
}

function clearInput(req, res) {
	// :TODO: would be WAY better to do this with a 205 response that resets the originating form
	// but this works because EMIT can only come from the document
	$('#chat-in').val('');
	return true;
}

var urlRegex = /(\S+:\/\/\S+)/g;
function render(req, res) {
	// Extract URLs, convert to links and add to our page index
	var autoEnable = true; // :TODO: only if added by current user
	var msg = util.escapeQuotes(util.escapeHTML(req.body.msg))
		.replace(urlRegex, function(URL) {
			var entry = linkRegistry.loadUri(URL, autoEnable);
			return '<a href="'+URL+'" target="_blank">'+URL+'</a> <a class="label label-default" method="ENABLE" href="httpl://chat.ui/index/'+entry.id+'"><b class="glyphicon glyphicon-off"></b></a>';
		});

	// :TODO: username
	var user = 'pfraze';
	$('#chat-out').prepend([
		'<div class="chat-message"><strong>'+user+'</strong>: '+msg+'</div>',
	].join(''));
	return 204;
}

function toggleIndexEntryCB(show) {
	return function (req, res) {
		if (show) {
			linkRegistry.enableEntry(req.params.id);
		} else {
			linkRegistry.disableEntry(req.params.id);
		}
		return 204;
	};
}