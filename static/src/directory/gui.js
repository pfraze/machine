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
var _sortReversed; // chronological or reverse-chrono?
function setup(mediaLinks) {
	_mediaLinks = mediaLinks;
	_activeGuis = null;
	_sortReversed = true; // default newest to oldest

	// render
	renderMetaFeed();
	renderGuis();

	// sort btn behaviors
	var $sortBtn = $('#sort-btn');
	var getSortBtnClass = function() { return 'glyphicon glyphicon-sort-by-alphabet'+((_sortReversed) ? '-alt' : ''); };
	var getSortBtnTitle = function() { return 'Sorting: '+((_sortReversed) ? 'newest to oldest' : 'oldest to newest'); };
	$sortBtn[0].className = getSortBtnClass();
	$sortBtn[0].title = getSortBtnTitle();
	$sortBtn.on('click', function() {
		_sortReversed = !_sortReversed;
		$sortBtn[0].className = getSortBtnClass();
		$sortBtn[0].title = getSortBtnTitle();
		renderMetaFeed();
	});

	// selection behaviors
	$(document.body).on('click', feedItemSelectHandler);
}

function renderMetaFeed() {
	var $list = $('.directory-links-list');
	$list.empty(); // clear out

	var lastDate = new Date(0);
	for (var i = 0; i < _mediaLinks.length; i++) {
		var index = (_sortReversed) ? (_mediaLinks.length - i - 1) : i;
		var link = _mediaLinks[index];

		var then = new Date(+link.created_at);
		if (isNaN(then.valueOf())) then = lastDate;

		if (then.getDay() != lastDate.getDay() || (lastDate.getYear() == 69 && then.getYear() != 69)) {
			// add date entry
			$list.append(
				'<div class="directory-time">'+
				then.getFullYear()+'/'+(then.getMonth()+1)+'/'+then.getDate()+
				'</div>'
			);
		}
		lastDate = then;

		// add item
		var title = util.escapeHTML(link.title || link.id || 'Untitled');
		$list.append('<div id="slot-'+index+'" class="directory-item-slot"><span class="title">'+title+'</span></div>');
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