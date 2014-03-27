// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();

// ui
require('../widgets/user-directories-panel').setup();
require('../widgets/addlink-panel').setup();
require('../widgets/directory-links-list').setup();
require('../widgets/directory-delete-btn').setup();

// Active renderers
var rendererQueries = {
	// :TODO: load from persistant storage
	'httpl://default-renderer': { rel: 'stdrel.com/media' }
};

// Default renderer
local.addServer('default-renderer', function(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		var html = JSON.stringify(req.query);
		if (req.body) {
			html += '<br><strong>'+JSON.stringify(req.body)+'</strong>';
		}
		res.end(html);
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