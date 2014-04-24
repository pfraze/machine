// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();
require('../http-headers').setup();
require('./feedcfg').setup();
require('./renderers'); // :DEBUG:
var executor = require('./executor');
var gui = require('./gui');

var mediaLinks = local.queryLinks(document, { rel: 'stdrel.com/media' });


// ui
require('../widgets/addlink-panel').setup();
require('../widgets/directory-delete-btn').setup();
gui.setup(mediaLinks);

// plugin execution
var hostEnvServer = require('./worker-bridge')(mediaLinks);
local.addServer('worker-bridge', hostEnvServer);
local.addServer('host.env', hostEnvServer);
executor.setup(mediaLinks);

// :TEMP:
local.addServer('todo', function(req, res) { alert('Todo'); res.writeHead(204).end(); });
