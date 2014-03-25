var globals = require('../globals');
var util    = require('../util');

var changeTimeoutId;
var curLink;

function reset() {
	var $form = $('.addlink-panel form');
	$form[0].reset();
	// $form.find('button').attr('disabled', 'disabled').removeClass('btn-primary').text('Post');
	$form.find('.fetch-result').addClass('hidden').text('');
}

function onURLInputChange() {
	// "Debounce"
	if (changeTimeoutId) clearTimeout(changeTimeoutId);

	var url = $(this).val();
	if (url) {
		var $form = $(this).parents('form');
		// Give a sec for the user to stop editing
		changeTimeoutId = setTimeout(fetchLinkCB(url, $form), 500);
	} else {
		reset();
	}
}

/*function onPostLink(e) {
	e.preventDefault();
	if (!curLink) return;

	// Add to dir's links
	globals.pageUA.POST(null, { query: curLink }).always(function(res) {
		if (res.status == 201) {
			window.location.reload();
		} else if (res.status == 403) {
			alert('Sorry! You must own the directory to add links to it.');
		} else {
			alert('Unexpected error: '+res.status+' '+res.reason);
		}
	});

	// Clear form
	reset();
}*/

function fetchLinkCB(url, $form) {
	return function() {
		curLink = null; // reset current link
		changeTimeoutId = null;

		// Tell user we're checking it out
		// $form.find('button').attr('disabled', 'disabled').removeClass('btn-primary').text('Fetching...');
		$form.find('.fetch-result').removeClass('hidden').text('Fetching...');

		// Fetch URL
		util.fetchMeta(url).always(function(res) {
			// Try to get the self link
			curLink = local.queryLinks(res, { rel: 'self' })[0];
			if (!curLink) {
				// Create a meta-less stand-in if the URL is good
				if (res.status >= 200 && res.status < 300) {
					curLink = { href: url };
				}
				// :TODO: follow redirects
			}

			if (curLink) {
				// Success, build description
				var desc = '';
				if (curLink.title || curLink.id) { desc += '"'+(curLink.title || curLink.id)+'"'; }
				if (curLink.rel) { desc = '{'+curLink.rel.replace(/(^|\b)self(\b|$)/g, '').trim()+'} '; }
				if (!desc) desc = 'but no metadata provided';

				// Update UI
				// $form.find('button').attr('disabled', false).addClass('btn-primary').text('Post');
				$form.find('.fetch-result').removeClass('hidden').text('URL Found: ' + desc);
			} else {
				// Failure
				// $form.find('button').attr('disabled', 'disabled').text('Failure');
				$form.find('.fetch-result').removeClass('hidden').text(res.status + ' ' + res.reason);
			}
		});
	};
}

module.exports = {
	setup: function() {
		// Register event handlers
		$('.addlink-panel input[type=url]').on('keyup', onURLInputChange);
		// $('.addlink-panel form').on('submit', onPostLink);
	}
};