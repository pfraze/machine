var util = require('../util');

module.exports = {
	setup: function() {},
	get: function() { return _cfg; },
	queryGuis: queryGuis
};

// The active feed config
var _cfg = {
	guis: local.util.table(
		['href',                 'rel',           'title',     'for'],
		'#thing-renderer',       'layer1.io/gui', 'Thing',     'schema.org/Thing',
		'#about-renderer',       'layer1.io/gui', 'About',     'stdrel.com/media',
		'/js/act/stopwatch.js#', 'layer1.io/gui', 'Stopwatch', 'stdrel.com/media'
		// rel(contains)stdrel.com/media,type(starts)text(or)application
		// href(protocol_is)https,href(domain_is)
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