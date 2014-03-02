// Chat.ui Server
// ==============
var util = require('../util');
var pagent = require('./pagent');
var roomindex = require('./roomindex');
var roomhostUA = local.agent('httpl://appcfg').follow({ rel: 'todo.com/rel/roomhost' });

var server = servware();
module.exports = server;

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
	var extractedURL = null;
	var msg = util.escapeQuotes(util.escapeHTML(req.body.msg))
		.replace(urlRegex, function(URL) {
			if (!extractedURL) {
				extractedURL = URL;
				var id = pagent.getNextIframeId();
				return '<a class="label label-primary iframe-toggle-btn" id="iframetoggle-'+id+'" method="HIDE" href="httpl://chat.ui/iframe/'+id+'">'+URL+'</a>';
			}
			return '<a href="'+URL+'" target="_blank">'+URL+'</a>';
		});

	if (extractedURL) {
		// Auto-fetch the extracted URI
		pagent.dispatchRequest({ method: 'GET', url: extractedURL, target: '_child' })
			.then(function(res2) {
				// Index the received self links
				var selfLinks = local.queryLinks(res2, { rel: 'self' });
				if (!selfLinks.length) {
					// :TODO: generate metadata by heuristics
					selfLinks = [{ rel: 'todo.com/rel/unknown', href: extractedURL }];
				}
				selfLinks.forEach(roomindex.addLink);
			});
	}

	// :TODO: username
	var user = 'pfraze';
	$('#chat-out').append([
		'<div class="chat-message"><strong>'+user+'</strong>: '+msg+'</div>',
	].join(''));
	return 204;
}

function toggleIframeCB(show) {
	return function (req, res) {
		var $iframeRow = $('#iframerow-'+req.params.id);
		if (!$iframeRow) throw 404;
		var $btn = $('#iframetoggle-'+req.params.id);
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