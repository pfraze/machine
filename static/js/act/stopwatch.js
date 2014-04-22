importScripts('/js/local.js');

function main(req, res) {
	if (req.path != '/') {
		return run(req, res, req.path.slice(1));
	}

	res.header('Link', [{ href: '/', rel: 'self stdrel.com/action', title: 'Stopwatch' }]);
	res.header('Content-Type', 'application/json');

	if (req.method == 'HEAD') {
		return res.writeHead(204).end();
	}
	res.writeHead(200).end({
		behavior: false,
		targets: false
	});
}

var runs = {};
function run(req, res, id) {
	if (!(id in runs) && req.method == 'POST') {
		res.header('Content-Type', 'text/event-stream');
		res.writeHead(200, 'ok');

		runs[id] = res;
		res.id = id;
		render(res, 0);

		res.start = Date.now();
		var intId = setInterval(function() {
			var elapsed = Math.round((Date.now() - res.start)/1000);
			render(res, elapsed);
		}, 1000);

		req.on('close', function() {
			clearInterval(intId);
			delete runs[id];
		});
	} else if (req.method == 'DELETE') {
		var elapsed = Math.round((Date.now() - runs[id].start)/1000);
		render(runs[id], elapsed, true);
		runs[id].end();
		res.writeHead(204).end();
	}
}

function render(res, elapsed, isdone) {
	var html = '<strong>'+elapsed+'</strong>';
	if (!isdone) html += ' <a href="/'+res.id+'" method="DELETE">stop</a>';
	res.write('event: update\r\ndata: '+html+'\r\n\r\n');
}