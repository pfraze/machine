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
			var err, json;
			if (req.body && typeof req.body.doc != 'undefined' && req.body.doc !== '') {
				try { json = JSON.parse(req.body.doc); }
				catch (e) { err = e.toString(); }
			} else {
				err = 'Cannot create an empty document';
			}
			if (err) {
				res.header('Pragma', 'modal="Make JSON|Create|Cancel"');
				res.header('Content-Type', 'text/html');
				return res.writeHead(422, 'invalid JSON').end(
					'<form action="/'+id+'?go" method="POST">'+
						'<div class="form-group has-error">'+
							'<textarea class="form-control" rows="12" name="doc">'+(req.body.doc||'')+'</textarea>'+
							'<span class="help-block">'+err+'</span>'+
						'</div>'+
					'</form>'
				);
			}
			local.POST(json, {
				url: 'host.env/feed',
				query: { rel: 'stdrel.com/media', type: 'application/json' },
				Authorization: 'Exec '+id
			}).then(function() {
				res.writeHead(204).end();
			}).fail(function(res2) {
				res.header('Content-Type', 'text/html');
				res.writeHead(502, 'got '+res2.status+' from upstream');
				res.end('<strong>Error</strong>: Failed to add document');
			});
		} else {
			res.header('Pragma', 'modal="Make JSON|Create|Cancel"');
			res.header('Content-Type', 'text/html');
			res.writeHead(200).end(
				'<form action="/'+id+'?go" method="POST">'+
					'<textarea class="form-control" rows="12" name="doc"></textarea>'+
				'</form>'
			);
		}
	} else {
		res.writeHead(405).end();
	}
}