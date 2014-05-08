var util = require('../util');

module.exports = {
	setup: function() {},
	get: function() { return _cfg; },
	findRenderers: findRenderers,
	findRenderer: findRenderer
};

// The active feed config
var _cfg = {
	renderers: local.util.table(
		['href',           'rel',                'title', 'for'],
		'#thing-renderer', 'layer1.io/renderer', 'Thing', 'schema.org/Thing',
		'#about-renderer', 'layer1.io/renderer', 'About', 'stdrel.com/media',
		'#test-renderer',  'layer1.io/renderer', 'Test',  'stdrel.com/media'
		// rel(contains)stdrel.com/media,type(starts)text(or)application
		// href(protocol_is)https,href(domain_is)
	)
};

function findRenderers(targetLink, maxMatches) {
	var matches = [];
	for (var i=0; i < _cfg.renderers.length; i++) {
		var g = _cfg.renderers[i];
		if (!g.for) continue;
		if (typeof g.for == 'string' && g.for[0] == '{' || g.for[0] == '[' || g.for[0] == '"') {
			try { g.for = JSON.parse(g.for); }
			catch (e) {}
		}
		if (local.queryLink(targetLink, g.for)) {
			matches.push(g);
			if (matches.length >= maxMatches)
				return matches;
		}
	}
	return matches;
}

function findRenderer(targetLink) {
	return findRenderers(targetLink, 1)[0];
}