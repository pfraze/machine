var util = require('../util');

module.exports = {
	setup: function() {},
	get: function() { return _cfg; },
	queryGuis: queryGuis
};

// The active feed config
var _cfg = {
	guis: util.table(
		['href',                    'rel',           'title',       'for'],
		'local://thing-renderer',   'layer1.io/gui', 'Thing GUI',   'schema.org/Thing',
		'local://default-renderer', 'layer1.io/gui', 'Default GUI', 'stdrel.com/media',
		'local://grimwire.com:8000(js/act/stopwatch.js)', 'layer1.io/gui', 'Stopwatch', 'stdrel.com/media'
	)
};

function queryGuis(targetLink) {
	var matches = [];
	for (var i=0; i < _cfg.guis.length; i++) {
		var g = _cfg.guis[i];
		if (!g.for) continue;
		if (typeof g.for == 'string' && g.for[0] == '{' || g.for[0] == '[' || g.for[0] == '"') {
			try { g.for = JSON.parse(g.for); }
			catch (e) {}
		}
		if (local.queryLink(targetLink, g.for)) {
			matches.push(g);
		}
	}
	return matches;
}