// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();
require('../http-headers').setup();
var executor = require('./executor');
var gui = require('./gui');

var mediaLinks = local.queryLinks(document, { rel: 'stdrel.com/media' });

// ui
require('../widgets/addlink-panel').setup();
require('../widgets/directory-links-list').setup();
require('../widgets/directory-delete-btn').setup();
gui.setup(mediaLinks);

// plugin execution
local.addServer('worker-bridge', require('./worker-bridge')(mediaLinks));
executor.setup(mediaLinks);

// :DEBUG:
$('#debug-stopwatch').tooltip({ placement: 'right' });
$('#debug-stopwatch').on('click', function() {
	var execution = executor.runAction(
		'local://grimwire.com:8000(js/act/stopwatch.js)/',
		{title:'StopWatch'}
	);
});
$('#debug-mkjson').tooltip({ placement: 'right' });
$('#debug-mkjson').on('click', function() {
	var execution = executor.runAction(
		'local://grimwire.com:8000(js/act/mkjson.js)/',
		{title:'Make JSON Document'}
	);
});

// :TEMP:
local.addServer('todo', function(req, res) { alert('Todo'); res.writeHead(204).end(); });
