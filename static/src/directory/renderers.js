var util = require('../util');

// Thing renderer
local.addServer('thing-renderer', function(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		var desc = [];
		var url = (req.body.url) ? util.escapeHTML(req.body.url) : '#';
		if (req.body.description) { desc.push(util.escapeHTML(req.body.description)); }
		if (req.body.url) { desc.push('<a href="'+url+'">Link</a>'); }
		var html = [
			'<div class="media">',
				((req.body.image) ? '<a target="_top" href="'+url+'" class="pull-left"><img class="media-object" src="'+util.escapeHTML(req.body.image)+'" alt="'+util.escapeHTML(req.body.name)+'" height="64"></a>' : ''),
				'<div class="media-body">',
					'<h4 class="media-heading">'+util.escapeHTML(req.body.name)+'</h4>',
					((desc.length) ? '<p>'+desc.join('<br>')+'</p>' : ''),
				'</div>',
			'</div>'
		].join('');
		res.end(html);
	});
});

// Default renderer
local.addServer('default-renderer', function(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		res.end('<p><a target="_top" href="'+util.escapeHTML(req.query.href)+'">Link</a></p>');
		/*var html = JSON.stringify(req.query);
		if (req.body) {
			html += '<br><strong>'+JSON.stringify(req.body)+'</strong>';
		}
		res.end(html);*/
	});
});