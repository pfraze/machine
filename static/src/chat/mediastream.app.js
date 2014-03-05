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
	res.writeHead(204, 'No Content');

	var n$ = nQuery.client(req.query.nquery);
	n$('').html([
		'<style>',
			'#mediastream { display: flex; flex-wrap: wrap; }',
			'#mediastream > div { margin-right: 5px }',
		'</style>',
		'<div id="mediastream"></div>'
	].join(''));

	var onLinkAdded = function(entry) {
		local.queryLinks(entry.links, { rel: 'todo.com/rel/media' }).forEach(function(link) {
			var uri = local.UriTemplate.parse(link.href).expand({});
			if (link.type && link.type.indexOf('image/') === 0) {
				n$('#mediastream').prepend('<div class="media-'+entry.id+'"><img src="'+uri+'"/></div>');
			}
			/*local.GET(uri).then(function(res) {
				if (res.body) {
					if (typeof res.body == 'object') {
						res.body = JSON.stringify(res.body);
					}
					n$('#mediastream').append('<div class="media-'+entry.id+'">'+res.body+'</div>');
				}
			});*/
		});
	};
	var onLinkRemoved = function(entry) {
		n$('#mediastream').find('.media-'+entry.id).remove();
	};
	linkRegistry.on('add', onLinkAdded);
	linkRegistry.on('remove', onLinkRemoved);

	req.on('end', function() {
		linkRegistry.removeListener('add', onLinkAdded);
		linkRegistry.removeListener('remove', onLinkRemoved);
		res.end();
	});
}