// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();
var util = require('../util');
var sec = require('../security');

// ui
require('../widgets/addlink-panel').setup();
require('../widgets/directory-links-list').setup();
require('../widgets/directory-delete-btn').setup();

// Active renderers
require('./renderers');
var rendererQueries = {
	// :TODO: load from persistant storage
	'local://thing-renderer': { rel: 'schema.org/Thing' },
	'local://default-renderer': { rel: 'stdrel.com/media' }
};

// Do render
var mediaLinks = local.queryLinks(document, { rel: 'stdrel.com/media' });
renderFeed();

// :TEMP:
local.addServer('todo', function(req, res) { alert('Todo'); res.writeHead(204).end(); });

// Item meta-update handler
local.addServer('meta', function(req, res) {
	req.on('end', function() {
		var id = req.path.slice(1);
		if (!id || !mediaLinks[id]) { return res.writeHead(404).end(); }
		$('#meta-msg-'+id).text('');

		if (req.method == 'PUT')    { putItemMeta(req, res, id); }
		if (req.method == 'DELETE') { deleteItem(req, res, id); }
		else                        { res.writeHead(405).end(); }
	});
});
function putItemMeta(req, res, id) {
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
			findRenderersForLinks([mediaLinks[id]]);

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
					$('#meta-msg-'+id).text('You\'re not authorized to edit this directory.');
					return res.writeHead(403).end();
			}
			res.writeHead(502).end();
		});
}
function deleteItem(req, res, id) {
	if (!confirm('Delete this item?')) return;

	local.DELETE(mediaLinks[id].href)
		.then(function(res2) {
			res.writeHead(204).end();

			// update locally
			delete mediaLinks[id];

			// redraw
			$('#slot-'+id+' .edit-meta').popover('toggle');
			$('#slot-'+id).remove();
		})
		.fail(function(res2) {
			switch (res2.status) {
				case 401:
				case 403:
					$('#meta-msg-'+id).text('You\'re not authorized to edit this directory.');
					return res.writeHead(403).end();
			}
			res.writeHead(502).end();
		});
}

function findRenderersForLinks(links) {
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

function renderFeed() {
	// Collect renderers for each link
	findRenderersForLinks(mediaLinks);

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

function renderItem(i) {
	var link = mediaLinks[i];
	var url = link.__renderers[0] || 'local://default-renderer';
	var json = $('#slot-'+i).data('doc') || null;
	var req = { url: url, query: link, Accept: 'text/html' };
	if (json) req.Content_Type = 'application/json';

	function renderTemplateResponse(link, i) {
		return function(res) {
			var html = sec.sanitizeRenderedItem(''+res.body);
			$('#slot-'+i).html([
				'<div class="directory-item-header">'+renderItemHeader(link)+'</div>',
				((res.body) ? ('<div class="directory-item-content">'+html+'</div>') : '')
			].join(''));
		};
	}
	function handleTemplateFailure(link, i) {
		return function(res) {
			console.error('Failed to render item', i, link, res);
			$('#slot-'+i).html('Failed to render :( '+util.escapeHTML(res.status+' '+res.reason));
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
	var $slot = $(this).parents('.directory-item-slot');
	var id = $slot.attr('id').slice(5);
	return [
		'<form action="local://meta/'+id+'" method="PUT">',
			'<textarea name="link" rows="10">'+util.escapeHTML(util.serializeRawMeta(mediaLinks[id]))+'</textarea>',
			'<input type="submit" class="btn btn-primary" value="Update">',
			' &nbsp; <span id="meta-msg-'+id+'"></span>',
			'<input type="submit" class="pull-right btn btn-default" value="Delete" formmethod="DELETE">',
		'</form>'
	].join('');
}