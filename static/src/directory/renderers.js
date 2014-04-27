var util = require('../util');

// :TODO: remove all of this, replace with standard GUIs

// Thing renderer
local.addServer('thing-renderer', function(req, res) {
	local.GET({ url: 'local://host.env/selection/0', Authorization: req.header('Authorization') })
		.always(function(res2) {
			res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
			var desc = [];
			var url = (res2.body.url) ? util.escapeHTML(res2.body.url) : '#';
			if (res2.body.description) { desc.push(util.escapeHTML(res2.body.description)); }
			if (res2.body.url) { desc.push('<a href="'+url+'">Link</a>'); }
			var html = [
				'<div class="media">',
					'<div class="media-body">',
						'<h4 class="media-heading">'+util.escapeHTML(res2.body.name)+'</h4>',
						((desc.length) ? '<p>'+desc.join('<br>')+'</p>' : ''),
					'</div>',
				'</div>'
			].join('');
			res.end(html);
		});
});

// Default renderer
local.addServer('about-renderer', function(req, res) {
	local.HEAD({ url: 'local://host.env/selection/0', Authorization: req.header('Authorization') })
		.always(function(res2) {
			var selfLink = local.queryLinks(res2, 'self')[0];
			res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
			var html = '';
			if (selfLink) {
				if (selfLink.rel == 'self stdrel.com/media') {
					var mime = selfLink.type || 'text/plain';
					if (mime == 'text/plain') mime = 'plain-text';
					else mime = mime.split('/')[1];
					html += '<p>Raw media ('+mime+') - nothing else is known about this file.</p>';
				} else if (/stdrel.com\/rel/.test(selfLink.rel)) {
					html += '<p>This is a "relation type." It explains how a location on the Web behaves, and is the basis of Layer1\'s structure.</p>';
				}

				if (selfLink.id) { html += '<small class="text-muted">ID</small> '+util.escapeHTML(selfLink.id)+'<br>'; }
				if (selfLink.rel) {
					html += '<small class="text-muted">TYPE</small> '+util.decorateReltype(selfLink.rel);
					if (selfLink.type) { html += ' '+util.escapeHTML(selfLink.type); }
					html += '<br>';
				}
				if (selfLink.href) { html += '<small class="text-muted">HREF</small> <a href="'+util.escapeHTML(selfLink.href)+'" target=_blank>'+util.escapeHTML(selfLink.href)+'</a><br>'; }
				if (selfLink.created_at) { html += '<small class="text-muted">ADDED</small> '+((new Date(+selfLink.created_at)).toLocaleTimeString())+'<br>'; }
			}
			res.end(html);
		});
});