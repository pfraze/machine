var sec = require('../security');
var util = require('../util');
var feedcfg = require('./feedcfg');
var executor = require('./executor');

module.exports = {
	setup: setup,
	renderMetaFeed: renderMetaFeed,
	renderGuis: renderGuis
};

var _mediaLinks;
var _activeGuis;
function setup(mediaLinks) {
	_mediaLinks = mediaLinks;
	_activeGuis = null;

	// Active renderers
	renderMetaFeed();
	renderGuis();

	// Selection
	$(document.body).on('click', feedItemSelectHandler);
}

function renderMetaFeed() {
	// Render the medias
	var lastDate = new Date(0);
	for (var i = 0; i < _mediaLinks.length; i++) {
		var link = _mediaLinks[i];
		var title = util.escapeHTML(link.title || link.id || 'Untitled');

		var then = new Date(+link.created_at);
		if (isNaN(then.valueOf())) then = lastDate;

		$('#slot-'+i).html('<span class="title">'+title+'</span>');

		if (then.getDay() != lastDate.getDay() || (lastDate.getYear() == 69 && then.getYear() != 69)) {
			$('#slot-'+i).before(
				'<div class="directory-time">'+
				then.getFullYear()+'/'+(then.getMonth()+1)+'/'+then.getDate()+
				'</div>'
			);
		}
		lastDate = then;

	}
}

function feedItemSelectHandler(e) {
	if (local.util.findParentNode.byElement(e.target, document.getElementById('plugin-guis')))
		return; // do nothing if a click in the GUIs

	if (!e.ctrlKey) {
		// unselect current selection if ctrl isnot held down
		$('.directory-links-list .selected').removeClass('selected');
	}

	var slotEl = local.util.findParentNode.byClass(e.target, 'directory-item-slot');
	if (slotEl) {
		slotEl.classList.add('selected');
	}

	// redraw actions based on the selection
	renderGuis();
	return false;
}

function renderGuis() {
	// gather applicable actions
	var $sel = $('.directory-links-list .selected');
	_activeGuis = {};
	if ($sel.length === 0) {
		// no-target actions
		feedcfg.get().guis.forEach(function(gui) {
			if (!gui.for)
				_activeGuis[gui.href] = gui;
		});
	} else {
		// matching actions
		for (var i=0; i < $sel.length; i++) {
			var id = $sel[i].id.slice(5);
			var link = _mediaLinks[id];
			if (!link) continue;

			var matches = feedcfg.queryGuis(link);
			for (var j=0; j < matches.length; j++) {
				_activeGuis[matches[j].href] = matches[j];
			}
		}
	}

	// create gui spaces
	var $guis = $('#plugin-guis');
	$guis.empty();
	for (var href in _activeGuis) {
		var $gui = createPluginGuiEl(_activeGuis[href]);
		$guis.append($gui);
		$gui[0].addEventListener('request', onPluginGuiRequest);
		executor.dispatch({ method: 'GET', url: href }, _activeGuis[href], $gui);
	}
}

// create gui-segment for a plugin to use
function createPluginGuiEl(meta) {
	var title = util.escapeHTML(meta.title || meta.id || meta.href);
	return $(
		'<div class="plugin-gui" data-plugin="'+meta.href+'">'+
			'<div class="plugin-gui-title"><small>'+title+'</small></div>'+//+' <a href="#" class="glyphicon glyphicon-remove"></a></small></div>'+
			'<div class="plugin-gui-inner">Loading...</div>'+
		'</div>'
	);
}

function onPluginGuiRequest(e) {
	var $gui = $(this);
	var href = $gui.data('plugin');
	executor.dispatch(e.detail, _activeGuis[href], $gui);
}