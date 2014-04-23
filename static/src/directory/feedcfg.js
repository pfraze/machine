module.exports = {
	setup: function() {},
	get: function() { return _cfg; },
	queryActions: queryActions,
	queryRenderers: queryRenderers,
};

// The active feed config
var _cfg = {
	actions: [
		{
			meta: { href: 'local://grimwire.com:8000(js/act/stopwatch.js)/', title: 'StopWatch' },
			behavior: false,
			targets: false
		},
		{
			meta: { href: 'local://grimwire.com:8000(js/act/mkjson.js)/', title: 'Make JSON Document' },
			behavior: ['add-an-item'],
			targets: false
		},
		{
			meta: { href: 'local://grimwire.com:8000(js/act/copydoc.js)/', title: 'Copy Document' },
			behavior: ['read-selected', 'add-an-item'],
			targets: [{rel:'stdrel.com/media', type:'application/json'}]
		}
	],
	renderers: [
		{
			meta: { href: 'local://thing-renderer', title: 'Thing Renderer' },
			targets: ['schema.org/Thing']
		},
		{
			meta: { href: 'local://default-renderer', title: 'Default Renderer' },
			targets: ['stdrel.com/media']
		}
	]
};

function query(targetLink, coll) {
	var matches = [];
	for (var i=0; i < coll.length; i++) {
		var a = coll[i];
		if (!a.targets) continue;
		for (var j=0; j < (a.targets.length||0); j++) {
			if (local.queryLink(targetLink, a.targets[j])) {
				matches.push(a);
			}
		}
	}
	return matches;
}

function queryActions(targetLink) {
	return query(targetLink, _cfg.actions);
}

function queryRenderers(targetLink) {
	return query(targetLink, _cfg.renderers);
}