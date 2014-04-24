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
local.addServer('default-renderer', function(req, res) {
	local.HEAD({ url: 'local://host.env/selection/0', Authorization: req.header('Authorization') })
		.always(function(res2) {
			var selfLink = local.queryLinks(res2, 'self');
			res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
			res.end(util.escapeHTML(JSON.stringify(selfLink)));
		});
});