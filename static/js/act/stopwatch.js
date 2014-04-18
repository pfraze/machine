importScripts('/js/local.js');

function main(req, res) {
	if (req.path != '/') {
		return run(req, res, req.path.slice(1));
	}

	res.header('Link', [{ href: '/', rel: 'self todorel.com/action', title: 'Stopwatch' }]);
	res.header('Content-Type', 'application/json');

	if (req.method == 'HEAD') {
		return res.writeHead(204).end();
	}
	res.writeHead(200).end({
		behavior: false,
		queries: false
	});
}

var runs = {};
function run(req, res, id) {
	if (!(id in runs) && req.method == 'POST') {
		res.start = Date.now();
		var intId = setInterval(function() {
			var elapsed = Math.round((Date.now() - res.start)/1000);
			render(id, elapsed, true);
		}, 1000);
		render(id, 0, true);

		runs[id] = res;
		req.on('close', function() {
			clearInterval(intId);
			delete runs[id];
		});
	} else if (req.method == 'DELETE') {
		var elapsed = Math.round((Date.now() - runs[id].start)/1000);
		runs[id].header('Content-Type', 'text/html');
		runs[id].writeHead(200).end('<strong>'+elapsed+'</strong>');
		res.writeHead(204).end();
	}
}

function render(id, elapsed) {
	var html = '<strong>'+elapsed+'</strong> <a href="/'+id+'" method="DELETE">stop</a>';
	local.PUT(html, {
		url: 'host.page/gui/'+id,
		headers: {'Content-Type': 'text/html'}
	});
}