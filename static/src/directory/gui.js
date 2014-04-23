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

function renderFeed() {
	// Render the medias
	for (var i = 0; i < _mediaLinks.length; i++) {
		renderItem(i);
	}
}

function renderItem(i) {
	var link = _mediaLinks[i];
	var title = util.escapeHTML(link.title || link.id || 'Untitled');
	var id = util.escapeHTML(link.id || '');
	var type = util.escapeHTML(link.type || '');
	var types = type ? type.split('/') : ['', ''];

	$('#slot-'+i).html(
		'<span class="type '+types[0]+'">'+types[1]+'</span> <span class="title">'+title+'</span>'
	);
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