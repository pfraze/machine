var sec = require('../security');
var util = require('../util');
var feedcfg = require('./feedcfg');
var executor = require('./executor');

module.exports = {
	setup: setup,
	renderFeed: renderFeed,
	renderActions: renderActions
};

var _mediaLinks;
var _activeActions;
function setup(mediaLinks) {
	_mediaLinks = mediaLinks;
	_activeActions = null;

	// Active renderers
	renderFeed();
	renderActions();

	// Selection
	$('.center-pane').on('click', onClickCenterpane);
	$('#action-btns').on('click', onClickAction);
}

// Item meta-update handler
local.addServer('meta', function(req, res) {
	req.on('end', function() {
		var id = req.path.slice(1);
		if (!id || !_mediaLinks[id]) { return res.writeHead(404).end(); }
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

	local.PUT(meta, { url: _mediaLinks[id].href+'/meta' })
		.then(function(res2) {
			res.writeHead(204).end();

			// update locally
			meta.href = _mediaLinks[id].href; // preserve, since href was stripped earlier
			_mediaLinks[id] = meta;

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

	local.DELETE(_mediaLinks[id].href)
		.then(function(res2) {
			res.writeHead(204).end();

			// update locally
			delete _mediaLinks[id];

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

function renderFeed() {
	// Render the medias
	var renderPromises = [];
	for (var i = 0; i < _mediaLinks.length; i++) {
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
	var link = _mediaLinks[i];
	var renderers = feedcfg.queryRenderers(link);
	var url = (renderers[0]) ? renderers[0].meta.href : 'local://default-renderer';
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
			'<textarea name="link" rows="10">'+util.escapeHTML(util.serializeRawMeta(_mediaLinks[id]))+'</textarea>',
			'<input type="submit" class="btn btn-primary" value="Update">',
			' &nbsp; <span id="meta-msg-'+id+'"></span>',
			'<input type="submit" class="pull-right btn btn-default" value="Delete" formmethod="DELETE">',
		'</form>'
	].join('');
}

function onClickCenterpane(e) {
	if (!e.ctrlKey) {
		// unselect current selection if ctrl isnot held down
		$('.directory-links-list .selected').removeClass('selected');
	}

	var slotEl = local.util.findParentNode.byClass(e.target, 'directory-item-slot');
	if (slotEl) {
		slotEl.classList.add('selected');
	}

	// redraw actions based on the selection
	renderActions();
	return false;
}

function renderActions() {
	// gather applicable actions
	var $sel = $('.directory-links-list .selected');
	_activeActions = {};
	if ($sel.length === 0) {
		// no-target actions
		feedcfg.get().actions.forEach(function(action) {
			if (!action.targets)
				_activeActions[action.meta.href] = action;
		});
	} else {
		// matching actions
		for (var i=0; i < $sel.length; i++) {
			var id = $sel[i].id.slice(5);
			var link = _mediaLinks[id];
			if (!link) continue;

			var matches = feedcfg.queryActions(link);
			for (var j=0; j < matches.length; j++) {
				_activeActions[matches[j].meta.href] = matches[j];
			}
		}
	}

	// render
	var $btns = $('#action-btns');
	var html = '';
	for (var href in _activeActions) {
		var m = _activeActions[href].meta;
		html += '<a href="#" data-action="'+m.href+'" title="Behaviors TODO">'+m.title+'</a><br>';
	}
	$btns.html(html);
	$btns.find('a').tooltip({ placement: 'right' });
}

function onClickAction(e) {
	var action = _activeActions[e.target.dataset.action];
	if (!action) { throw "Action not found in active list"; } // should not happen
	executor.runAction(action.meta.href, action.meta);
	return false;
}