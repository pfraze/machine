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
			if (req.path == '/config') {
				html += '<p><a href="/">details</a> config</p>';
				html += '<div class="panel panel-default"><div class="panel-body">';
				html += '<form method="POST" action="/config">'+
					'<div class="form-group"><textarea class="form-control" rows="8" name="meta">'+
						util.escapeHTML(util.serializeRawMeta(selfLink))+
					'</textarea></div>'+
					'<button type="submit" class="btn btn-primary">Update</button>'+
					' <button type="submit" class="btn btn-default">Defeed</button>'+
				'</form>';
				html += '</div></div>';
			} else {
				html += '<p>details <a href="/config">config</a></p>';
				html += '<div class="panel panel-default"><div class="panel-body">';
				if (selfLink) {
					if (selfLink.id) { html += 'ID is '+util.escapeHTML(selfLink.id)+'<br>'; }
					if (selfLink.rel) { html += 'Is a '+util.decorateReltype(selfLink.rel)+'<br>'; }
					if (selfLink.created_at) { html += 'Created '+((new Date(+selfLink.created_at)).toLocaleTimeString())+'<br>'; }
					if (selfLink.href) { html += '<a href="'+util.escapeHTML(selfLink.href)+'" target=_blank>URL</a>'; }
				}
				html += '</div></div>';
			}
			res.end(html);
		});
});