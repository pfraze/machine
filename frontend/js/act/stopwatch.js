importScripts('/js/local.js');

local.at('#', function (req, res) {
	res.link('#', 'self layer1.io/gui', {title: 'Stopwatch'});
	res.ContentType('events');
	if (req.HEAD) return res.s204().end();

	res.s200('ok');
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
});

function render(res, elapsed) {
	var html = '<strong>'+elapsed+'</strong>';
	res.write('event: update\r\ndata: '+html+'\r\n\r\n');
}