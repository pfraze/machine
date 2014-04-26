importScripts('/js/local.js');

function main(req, res) {
	res.header('Link', [{ href: '/', rel: 'self layer1.io/gui', title: 'Stopwatch' }]);
	res.header('Content-Type', 'text/event-stream');

	if (req.method == 'HEAD') {
		return res.writeHead(204).end();
	}

	res.writeHead(200, 'ok');
	render(res, 0);

	res.start = Date.now();
	var intId = setInterval(function() {
		var elapsed = Math.round((Date.now() - res.start)/1000);
		render(res, elapsed);
	}, 1000);

	req.on('close', function() {
		res.end();
		clearInterval(intId);
	});
}

function render(res, elapsed) {
	var html = '<strong>'+elapsed+'</strong>';
	res.write('event: update\r\ndata: '+html+'\r\n\r\n');
}