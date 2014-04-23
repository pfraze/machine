importScripts('/js/local.js');

function main(req, res) {
	if (req.path != '/') {
		return req.on('end', run.bind(null, req, res, req.path.slice(1)));
	}

	res.header('Link', [{ href: '/', rel: 'self layer1.io/action', title: 'Make JSON' }]);
	res.header('Content-Type', 'application/json');

	if (req.method == 'HEAD') {
		return res.writeHead(204).end();
	}
	res.writeHead(200).end({
		behavior: ['add-an-item'],
		targets: false
	});
}

function run(req, res, id) {
	if (req.method == 'POST') {
		if (req.query.go) {
			var err, doc, json, title, docid;
			if (req.body && typeof req.body.doc != 'undefined' && req.body.doc !== '') {
				doc = req.body.doc;
				title = req.body.title;
				docid = req.body.id;
				try { json = JSON.parse(doc); }
				catch (e) { err = e.toString(); }
			} else {
				err = 'Cannot create an empty document';
			}

			if (err) {
				res.header('Pragma', 'modal="Make JSON|Create|Cancel"');
				res.header('Content-Type', 'text/html');
				return res.writeHead(422, 'invalid JSON').end(render(id, doc, title, docid, err));
			}

			local.POST(json, {
				url: 'host.env/feed',
				query: { rel: 'stdrel.com/media', type: 'application/json', title: title, id: id },
				Authorization: 'Exec '+id
			}).then(function() {
				res.writeHead(204).end();
			}).fail(function(res2) {
				res.header('Content-Type', 'text/html');
				res.writeHead(502, 'got '+res2.status+' from upstream');
				res.end('<strong>Error</strong>: Failed to add document');
			});
		} else {
			var initDoc='', initTitle='', initId='';
			res.header('Pragma', 'modal="Make JSON|Create|Cancel"');
			res.header('Content-Type', 'text/html');
			res.writeHead(200).end(render(id));
		}
	} else {
		res.writeHead(405).end();
	}
}

function render(execid, doc, title, id, err) {
	doc   = doc || '';
	title = title || '';
	id    = id || '';
	err   = err || '';
	var hasError = (err) ? 'has-error' : '';
	return '<form action="/'+execid+'?go" method="POST">'+
		'<div class="form-group">'+
			'<input type="text" class="form-control" name="title" placeholder="Title" value="'+esc(title)+'">'+
		'</div>'+
		'<div class="form-group">'+
			'<input type="text" class="form-control" name="id" placeholder="ID" value="'+esc(id)+'">'+
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