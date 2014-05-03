var globals   = require('../globals');
var util      = require('../util');
var mimetypes = require('../mimetypes');

var changeTimeoutId;
var curLink, curResponse;

function reset() {
	// Abort any fetch requests
	util.fetch(null);
	curLink = curResponse = null; // reset current link

	// Reset the UI
	var $form = $('.addlink-panel form');
	$form[0].reset();
	$('#post-doc-btn').attr('disabled', 'disabled').addClass('hidden');
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

function onPostDoc(e) {
	e.preventDefault();
	if (!curLink) return;

	// Add to dir's docs
	var link = local.util.deepClone(curLink);
	delete link.href;
	POST(globals.pageClient.context.url, link)
		.ContentType(curLink.type)
		.end(curResponse.body)
		.always(handlePostResponse);
}

function onPostLink(e) {
	e.preventDefault();
	if (!curLink) return;

	// Add to dir's links
	globals.pageClient.POST(curLink)
		.end()
		.always(handlePostResponse);
}

function handlePostResponse(res) {
	if (res.status == 201) {
		window.location.reload();
	} else if (res.status == 403) {
		alert('Sorry! You must own the directory to add links to it.');
	} else {
		alert('Unexpected error: '+res.status+' '+res.reason);
	}
}

function fetchLinkCB(url, $form) {
	return function() {
		curLink = curResponse = null; // reset current link
		changeTimeoutId = null;

		// Tell user we're checking it out
		$form.find('.fetch-result').removeClass('hidden').text('Fetching...');

		// Fetch URL
		util.fetch(url).always(function(res) {
			// :TODO: follow redirects?
			curResponse = res;

			// Try to get the self link
			curLink = res.links.first('self');
			if (!curLink) {
				// Create a meta-less stand-in if the URL is good
				if (res.status >= 200 && res.status < 300) {
					curLink = { href: url };
				}
			}

			if (curLink) {
				// Try to establish the mimetype
				var mimeType = res.ContentType;
				if (!mimeType) {
					mimeType = mimetypes.lookup(url) || 'application/octet-stream';
				}
				var semicolonIndex = mimeType.indexOf(';');
				if (semicolonIndex !== -1) {
					mimeType = mimeType.slice(0, semicolonIndex); // strip the charset
				}

				// Do basic re-classification
				if (!curLink.type) { curLink.type = mimeType; }
				if (!curLink.rel) { curLink.rel = 'stdrel.com/media'; }
				else if (!curLink.is('stdrel.com/media')) {
					curLink.rel += ' stdrel.com/media';
				}

				// Success, build description
				var desc = local.util.deepClone(curLink);
				delete desc.href;
				desc.rel = desc.rel.split(' ').filter(function(v) { return v.indexOf('.') !== -1; }).join(' '); // strip non-extension rels
				desc = util.escapeHTML(util.serializeRawMeta(desc)).replace(/\n/g, '<br>');

				// Update UI
				$('#post-doc-btn').attr('disabled', false).removeClass('hidden');
				$form.find('.fetch-result').removeClass('hidden').html(desc);
			} else {
				// Failure
				$('#post-doc-btn').attr('disabled', 'disabled').addClass('hidden');
				$form.find('.fetch-result').removeClass('hidden').text(res.status + ' ' + res.reason);
			}
		});
	};
}

module.exports = {
	setup: function() {
		// Register event handlers
		$('.addlink-panel input[type=url]').on('keyup', onURLInputChange);
		$('.addlink-panel #post-doc-btn').on('click', onPostDoc);
		$('.addlink-panel #post-link-btn').on('click', onPostLink);
		reset();
	}
};