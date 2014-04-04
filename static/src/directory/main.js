// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();
var util = require('../util');

// ui
require('../widgets/user-directories-panel').setup();
require('../widgets/addlink-panel').setup();
require('../widgets/directory-links-list').setup();
require('../widgets/directory-delete-btn').setup();

// Active renderers
var rendererQueries = {
	// :TODO: load from persistant storage
	'httpl://thing-renderer': { rel: 'schema.org/Thing' },
	'httpl://default-renderer': { rel: 'stdrel.com/media' }
};

// Thing renderer
local.addServer('thing-renderer', function(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		var desc = [];
		if (req.body.description) { desc.push(util.escapeHTML(req.body.description)); }
		if (req.body.url) { desc.push('<a href="'+util.escapeHTML(req.body.url)+'">Link</a>'); }
		var html = [
			'<div class="media">',
				((req.body.image) ? '<a target="_top" href="'+util.escapeHTML(req.query.href)+'" class="pull-left"><img class="media-object" src="'+util.escapeHTML(req.body.image)+'" alt="'+util.escapeHTML(req.body.name)+'" height="64"></a>' : ''),
				'<div class="media-body">',
					'<h4 class="media-heading">'+util.escapeHTML(req.body.name)+'</h4>',
					((desc.length) ? '<p>'+desc.join('<br>')+'</p>' : ''),
				'</div>',
			'</div>'
		].join('');
		res.end(html);
	});
});

// Default renderer
local.addServer('default-renderer', function(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		var title = util.escapeHTML(req.query.title || req.query.id || 'Untitled');
		if (req.query.type) { title += ' ('+util.escapeHTML(req.query.type)+')'; }
		res.end('<p><a target="_top" href="'+util.escapeHTML(req.query.href)+'" title="'+title+'">'+title+'</a></p>');
		/*var html = JSON.stringify(req.query);
		if (req.body) {
			html += '<br><strong>'+JSON.stringify(req.body)+'</strong>';
		}
		res.end(html);*/
	});
});

// Do render
renderFeed();


function renderFeed() {
	// Collect renderers for each link
	var mediaLinks = local.queryLinks(document, { rel: 'stdrel.com/media' });
	for (var url in rendererQueries) {
		var matches = local.queryLinks(mediaLinks, rendererQueries[url]);
		for (var i=0; i < matches.length; i++) {
			if (!matches[i].__renderers) {
				Object.defineProperty(matches[i], '__renderers', { enumerable: false, value: [] });
			}
			matches[i].__renderers.push(url);
		}
	}

	// Render the medias
	mediaLinks.forEach(function(link, i) {
		var url = link.__renderers[0] || 'httpl://default-renderer';
		var json = $('#slot-'+i).data('doc') || null;
		var req = { url: url, query: link, Accept: 'text/html' };
		if (json) req.Content_Type = 'application/json';
		local.POST(json, req)
			.then(
				renderTemplateResponse(link, i),
				handleTemplateFailure(link, i)
			);
	});
	function renderTemplateResponse(link, i) {
		return function(res) {
			$('#slot-'+i).html(res.body);
		};
	}
	function handleTemplateFailure(link, i) {
		return function(res) {
			console.error('Failed to render item', i, link, res);
			$('#slot-'+i).html('Failed to render :( '+res.status+' '+res.reason);
		};
	}
}