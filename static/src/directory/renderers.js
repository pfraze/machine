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
	var method = (req.path == '/view') ? 'GET' : 'HEAD';
	local.dispatch({ method: method, url: 'local://host.env/selection/0', Authorization: req.header('Authorization') })
		.always(function(res2) {
			var selfLink = local.queryLinks(res2, 'self')[0];
			res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
			var html = '';
			if (req.path == '/config') {
				var nrows = (selfLink) ? Object.keys(selfLink).length : 1;
				html += '<p><a href="/">details</a> config <a href="/view">view</a></p>';
				html += '<form method="POST" action="/config">'+
					'<div class="form-group"><textarea class="form-control" rows="'+nrows+'" name="meta">'+
						util.escapeHTML(util.serializeRawMeta(selfLink))+
					'</textarea></div>'+
					'<button type="submit" class="btn btn-primary">Update</button>'+
					' <button type="submit" class="btn btn-default">Defeed</button>'+
				'</form>';
			} else if (req.path == '/view') {
				var doc = (res2.body && typeof res2.body == 'object') ? JSON.stringify(res2.body) : res2.body;
				html += '<p><a href="/">details</a> <a href="/config">config</a> view</p>';
				html += '<pre>'+util.escapeHTML(doc)+'</pre>';
			} else {
				// html += '<p>details <a href="/config">config</a> <a href="/view">view</a></p>';
				if (selfLink) {
					if (selfLink.id) { html += '<small class="text-muted">ID</small> '+util.escapeHTML(selfLink.id)+'<br>'; }
					if (selfLink.rel) {
						html += '<small class="text-muted">TYPE</small> '+util.decorateReltype(selfLink.rel);
						if (selfLink.type) { html += ' '+util.escapeHTML(selfLink.type); }
						html += '<br>';
					}
					if (selfLink.href) { html += '<small class="text-muted">HREF</small> <a href="'+util.escapeHTML(selfLink.href)+'" target=_blank>'+util.escapeHTML(selfLink.href)+'</a><br>'; }
					if (selfLink.created_at) { html += '<small class="text-muted">CREATED</small> '+((new Date(+selfLink.created_at)).toLocaleTimeString())+'<br>'; }
				}
			}
			res.end(html);
		});
});