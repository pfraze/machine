// Chat.ui Server
// ==============
var util = require('../util');
var pagent = require('./pagent');

var server = servware();
module.exports = server;

var roomhostUA = local.agent('httpl://appcfg').follow({ rel: 'todo.com/rel/roomhost' });
var roomindexUA = local.agent('httpl://appcfg').follow({ rel: 'todo.com/rel/index', id: 'room' });

server.route('/', function(link, method) {
	link({ href: '/', rel: 'self service todo.com/rel/chatui', title: 'Local Chat UI' });

	method('HEAD', allowSelf, function() { return 204; });
	method('EMIT', allowSelf, validate, sendToChathost, clearInput, render);
	method('RECV', allowChatHost, validate, render);
});

server.route('/iframe/:id', function(link, method) {
	link({ href: '/', rel: 'up via service todo.com/rel/chatui', title: 'Local Chat UI' });
	link({ href: '/iframe/:id', rel: 'self item' });

	method('HEAD', allowSelf, function() { return 204; });
	method('HIDE', allowSelf, toggleIframeCB(false));
	method('SHOW', allowSelf, toggleIframeCB(true));
});

function allowSelf(req, res) {
	var from = req.header('From');
	if (!from) return true; // allow from document
	if (from == 'httpl://'+req.header('Host')) return true; // allow self
	throw 403;
}

function allowChatHost(req, res) {
	return roomhostUA.resolve().then(function(url) {
		if (req.header('From') == url) return true; // allow chathost
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
	var URLs = [];
	var msg = util.escapeQuotes(util.escapeHTML(req.body.msg))
		.replace(urlRegex, function(URL) {
			URLs.push(URL);
			return '<a href="'+URL+'" target="_child">'+URL+'</a>';
		});

	// Send URLs to the session index
	roomindexUA.post(URLs);

	// :TODO: username
	var user = 'pfraze';
	var time = (new Date()).toLocaleTimeString();
	$('#chat-out').append([
		'<div class="row">',
			'<div class="col-xs-2 align-right"><small class="text-muted">'+time+'</small></div>',
			'<div class="col-xs-8 chat-message"><strong>'+user+'</strong>: '+msg+'</div>',
		'</div>'
	].join(''));
	return 204;
}

function toggleIframeCB(show) {
	return function (req, res) {
		var $iframeRow = $('#iframerow-'+req.params.id);
		if (!$iframeRow) throw 404;
		var $btn = $iframeRow.find('.iframe-toggle-btn');
		var $iframe = $iframeRow.find('iframe');

		if (show) {
			$btn.removeClass('label-default').addClass('label-primary').attr('method', 'HIDE');
			$iframe.show();
		} else {
			$btn.addClass('label-default').removeClass('label-primary').attr('method', 'SHOW');
			$iframe.hide();
		}
	};
}