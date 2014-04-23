importScripts('/js/local.js');

function main(req, res) {
	if (req.path != '/') {
		return req.on('end', run.bind(null, req, res, req.path.slice(1)));
	}

	res.header('Link', [{ href: '/', rel: 'self layer1.io/action', title: 'Make JSON Document' }]);
	res.header('Content-Type', 'application/json');

	if (req.method == 'HEAD') {
		return res.writeHead(204).end();
	}
	res.writeHead(200).end({
		behavior: ['add-an-item'],
		targets: ['collection']
	});
}

function run(req, res, id) {
	if (req.method == 'POST') {
		if (req.query.go) {
			var err, doc, json;
			if (req.body && typeof req.body.doc != 'undefined' && req.body.doc !== '') {
				doc = req.body.doc;
				try { json = JSON.parse(doc); }
				catch (e) { err = e.toString(); }
			} else {
				err = 'Cannot create an empty document';
			}

			if (err) {
				res.header('Pragma', 'modal="Make JSON|Create|Cancel"');
				res.header('Content-Type', 'text/html');
				return res.writeHead(422, 'invalid JSON').end(render(id, doc, err));
			}

			local.POST(json, {
				url: 'host.env/feed',
				query: { rel: 'stdrel.com/media', type: 'application/json', title: req.body.title||undefined },
				Authorization: 'Exec '+id
			}).then(function() {
				res.writeHead(204).end();
			}).fail(function(res2) {
				res.header('Content-Type', 'text/html');
				res.writeHead(502, 'got '+res2.status+' from upstream');
				res.end('<strong>Error</strong>: Failed to add document');
			});
		} else {
			local.GET({
				url: 'host.env/selection/0',
				Authorization: 'Exec '+id
			}).always(function(res2) {
				res.header('Pragma', 'modal="Make JSON|Create|Cancel"');
				res.header('Content-Type', 'text/html');
				var body = (res2.body && typeof res2.body == 'object') ? JSON.stringify(res2.body) : res2.body;
				res.writeHead(200).end(render(id, body));
			});
		}
	} else {
		res.writeHead(405).end();
	}
}

function render(id, doc, err) {
	doc = doc || '';
	err = err || '';
	var hasError = (err) ? 'has-error' : '';
	return '<form action="/'+id+'?go" method="POST">'+
		'<div class="form-group">'+
			'<input type="text" class="form-control" name="title" placeholder="Title">'+
		'</div>'+
		'<div class="form-group '+hasError+'">'+
			'<textarea class="form-control" rows="12" name="doc">'+esc(doc)+'</textarea>'+
			'<span class="help-block">'+err+'</span>'+
		'</div>'+
	'</form>';
}

function esc(str) {
	return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}