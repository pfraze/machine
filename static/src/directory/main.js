// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();
var util = require('../util');

// ui
require('../widgets/addlink-panel').setup();
require('../widgets/directory-links-list').setup();
require('../widgets/directory-delete-btn').setup();

// Active renderers
var rendererQueries = {
	// :TODO: load from persistant storage
	'local://thing-renderer': { rel: 'schema.org/Thing' },
	'local://default-renderer': { rel: 'stdrel.com/media' }
};

// :TEMP:
local.addServer('todo', function(req, res) { alert('Todo'); res.writeHead(204).end(); });

// Thing renderer
local.addServer('thing-renderer', function(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		var desc = [];
		var url = (req.body.url) ? util.escapeHTML(req.body.url) : '#';
		if (req.body.description) { desc.push(util.escapeHTML(req.body.description)); }
		if (req.body.url) { desc.push('<a href="'+url+'">Link</a>'); }
		var html = [
			'<div class="media">',
				((req.body.image) ? '<a target="_top" href="'+url+'" class="pull-left"><img class="media-object" src="'+util.escapeHTML(req.body.image)+'" alt="'+util.escapeHTML(req.body.name)+'" height="64"></a>' : ''),
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
		res.end('<p><a target="_top" href="'+util.escapeHTML(req.query.href)+'">Link</a></p>');
		/*var html = JSON.stringify(req.query);
		if (req.body) {
			html += '<br><strong>'+JSON.stringify(req.body)+'</strong>';
		}
		res.end(html);*/
	});
});

// :TEMP:
local.addServer('meta', function(req, res) {
	req.on('end', function() {
		var id = req.path.slice(1);
		if (!id || !mediaLinks[id]) { return res.writeHead(404).end(); }
		if (req.method != 'PUT') { return res.writeHead(405).end(); }
		$('#meta-msg-'+id).text('');

		var meta;
		try { meta = util.parseRawMeta(req.body.link); }
		catch (e) {
			$('#meta-msg-'+id).text(e.toString());
			return res.writeHead(422).end();
		}

		local.PUT(meta, { url: mediaLinks[id].href+'/meta' })
			.then(function(res2) {
				res.writeHead(204).end();

				// update locally
				meta.href = mediaLinks[id].href; // preserve, since href was stripped earlier
				mediaLinks[id] = meta;
				classifyRenderers([mediaLinks[id]]);

				// redraw
				$('#slot-'+id+' .edit-meta').popover('toggle');
				$('#meta-msg-'+id).text('Updated');
				renderItem(id);
				local.util.nextTick(function() {
					$('#slot-'+id+' .edit-meta').popover({
						html: true,
						content: renderItemEditmeta,
						container: 'body',
						placement: 'bottom'
					});
				});
			})
			.fail(function(res2) {
				switch (res2.status) {
					case 422:
						$('#meta-msg-'+id).text(res2.body.error);
						return res.writeHead(422).end();
					case 401:
					case 403:
						$('#meta-msg-'+id).text('You\'re not authorized to edit this feed.');
						return res.writeHead(403).end();
				}
				res.writeHead(502).end();
			});
	});
});

// Do render
var mediaLinks = local.queryLinks(document, { rel: 'stdrel.com/media' });
renderFeed();

function renderFeed() {
	// Collect renderers for each link
	classifyRenderers(mediaLinks);

	// Render the medias
	var renderPromises = [];
	for (var i = 0; i < mediaLinks.length; i++) {
		renderPromises.push(renderItem(i));
	}

	local.promise.bundle(renderPromises).then(function() {
		$('.edit-meta').popover({
			html: true,
			content: renderItemEditmeta,
			container: 'body',
			placement: 'bottom'
		});
	});
}

function classifyRenderers(links) {
	for (var url in rendererQueries) {
		var matches = local.queryLinks(links, rendererQueries[url]);
		for (var i=0; i < matches.length; i++) {
			if (!matches[i].__renderers) {
				Object.defineProperty(matches[i], '__renderers', { enumerable: false, value: [] });
			}
			matches[i].__renderers.push(url);
		}
	}
}

function renderItem(i) {
	var link = mediaLinks[i];
	var url = link.__renderers[0] || 'local://default-renderer';
	var json = $('#slot-'+i).data('doc') || null;
	var req = { url: url, query: link, Accept: 'text/html' };
	if (json) req.Content_Type = 'application/json';

	function renderTemplateResponse(link, i) {
		return function(res) {
			$('#slot-'+i).html([
				'<div class="feed-item-header">'+renderItemHeader(link)+'</div>',
				((res.body) ? ('<div class="feed-item-content">'+res.body+'</div>') : '')
			].join(''));
		};
	}
	function handleTemplateFailure(link, i) {
		return function(res) {
			console.error('Failed to render item', i, link, res);
			$('#slot-'+i).html('Failed to render :( '+res.status+' '+res.reason);
		};
	}
	return local.POST(json, req)
		.then(
			renderTemplateResponse(link, i),
			handleTemplateFailure(link, i)
		);
}

function renderItemHeader(link) {
	var title = util.escapeHTML(link.title || link.id || 'Untitled');
	if (link.type) { title += ' ('+util.escapeHTML(link.type)+')'; }

	return [
		'<a target="_top" href="'+util.escapeHTML(link.href)+'">'+title+'</a> &middot; ',
		'<a target="_top" class="edit-meta" href="javascript:void(0)">meta</a>'
	].join('');
}

function renderItemEditmeta() {
	var $slot = $(this).parents('.feed-item-slot');
	var id = $slot.attr('id').slice(5);
	return [
		'<form action="local://meta/'+id+'" method="PUT">',
			'<textarea name="link" rows="10">'+util.escapeHTML(util.serializeRawMeta(mediaLinks[id]))+'</textarea>',
			'<input type="submit" class="btn btn-primary" value="Update">',
			' &nbsp; <span id="meta-msg-'+id+'"></span>',
		'</form>'
	].join('');
}