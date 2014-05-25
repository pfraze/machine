var util = require('../util');

module.exports = {
	setup: function(indexLinks) {
		indexLinks.forEach(addIndex);
	},
	get: function() { return _cfg; },
	addIndex: addIndex,
	setIndex: setIndex,
	findLink: findLink,
	findRenderers: findRenderers,
	findRenderer: findRenderer
};

// The active feed config
var _cfg = {
	curIndex: null,
	indexLinks: [],
	indexes: {}, // indexHref -> [link]
	renderers: {}  // indexHref -> [link]
};

function addIndex(indexLink) {
	_cfg.indexLinks.push(indexLink);
	_cfg.indexes[indexLink.href] = [];
	_cfg.renderers[indexLink.href] = [];
	if (!_cfg.curIndex) {
		_cfg.curIndex = indexLink.href;
	}
	return HEAD(indexLink.href).then(function(res) {
		_cfg.indexes[indexLink.href] = res.links;
		_cfg.renderers[indexLink.href] = res.links.query('layer1.io/renderer');
		return res;
	});
}

function setIndex(indexLink) {
	if (!(indexLink.href in _cfg.indexes)) {
		addIndex(indexLink);
	}
	_cfg.curIndex = indexLink.href;
}

function findLink(query) {
	var links = _cfg.indexes[_cfg.curIndex];
	var terms = query.split(' ').map(function(term) { return new RegExp(term, 'i'); });

	for (var i=0; i < links.length; i++) {
		var link = links[i];
		var linkText =
			(link.href||'')  + ' ' +
			(link.rel||'')   + ' ' +
			(link.title||'') + ' ' +
			(link.keywords||'')
		;
		var match = true;
		for (var j = 0; j < terms.length; j++) {
			if (!terms[j].test(linkText)) {
				match = false;
				break;
			}
		}
		if (match) {
			return link;
		}
	}
	return null;
}

function findRenderers(targetLink, maxMatches) {
	var matches = [];
	var renderers = _cfg.renderers[_cfg.curIndex];

	for (var i=0; i < renderers.length; i++) {
		var g = renderers[i];
		if (!g.for) continue;
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