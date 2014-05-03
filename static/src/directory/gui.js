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
	// var $sortBtn = $('#sort-btn');
	// var getSortBtnClass = function() { return 'glyphicon glyphicon-sort-by-alphabet'+((_sortReversed) ? '-alt' : ''); };
	// var getSortBtnTitle = function() { return 'Sorting: '+((_sortReversed) ? 'newest to oldest' : 'oldest to newest'); };
	// $sortBtn[0].className = getSortBtnClass();
	// $sortBtn[0].title = getSortBtnTitle();
	// $sortBtn.on('click', function() {
	// 	_sortReversed = !_sortReversed;
	// 	$sortBtn[0].className = getSortBtnClass();
	// 	$sortBtn[0].title = getSortBtnTitle();
	// 	renderMetaFeed();
	// });

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
	if (local.util.findParentNode.byElement(e.target, document.getElementById('views')))
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
	var i;

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
		for (i=0; i < $sel.length; i++) {
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
	i=0;
	var $guis = $('#untrusted1');
	var $nav = $('#views .nav');
	$guis.empty();
	$nav.empty();
	for (var href in _activeGuis) {
		$nav.append(createNavEl(_activeGuis[href], i++));

		var $gui = createViewEl(_activeGuis[href]);
		$guis.append($gui);
		$gui.on('request', onViewRequest);
		executor.dispatch({ method: 'GET', url: href }, _activeGuis[href], $gui);
	}
}

// create div for view
function createViewEl(meta) {
	return $('<div class="view" data-view="'+meta.href+'">Loading...</div>');
}

// create div for view
function createNavEl(meta, i) {
	var title = meta.title || meta.id || meta.href;
	if (i===0) {
		return $('<li class="active"><a method="SHOW" href="#views/0">'+title+'</div>');
	} else {
		return $('<li class="active"><a method="SHOW" href="#views/'+i+'">'+title+'</div>');
	}
}

function onViewRequest(e) {
	var $gui = $(this);
	var href = $gui.data('view');
	executor.dispatch(e.detail, _activeGuis[href], $gui);
}