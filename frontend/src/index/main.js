var globals = require('../globals');
var util = require('../util');

// Environment Setup
// =================
web.logAllExceptions = true;
require('./search').addIndex({ href: '#', rel: 'layer1.io/index', title: 'Builtins' }).then(function() {
	require('./gui').setup();
}).fail(function() {
	console.error('Failed to setup builtins index');
});

// toplevel - config host
function getSelf(res) { return res.links.get('self'); }
var indexLinks = [
	web.HEAD('/column-layouts.js#col3').always(getSelf),
	web.HEAD('/column-layouts.js#col2').always(getSelf),
	web.HEAD('/image-viewer.js#').always(getSelf),
	web.HEAD('/list-view.js#').always(getSelf),
	web.HEAD('/media-summaries.js#').always(getSelf),
	web.HEAD('/thumbnail-view.js#').always(getSelf)
];
web.export(main);
function main(req, res) {
	return indexLinks.always(function(links) {
		links = links.filter(function(link) { return !!link; });
		res.link(links.concat([
			{ href: 'http://i.imgur.com/kijXP0K.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 1' },
			{ href: 'http://i.imgur.com/6pETKay.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 2' },
			{ href: 'http://i.imgur.com/yurJqpe.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 3' },
		]));
	});
}

// public web proxy
web.export(pubweb_proxy);
pubweb_proxy.opts({
    stream: true,
    allmethods: true
});
function pubweb_proxy(req, res, worker) {
    // :TODO: perms

    // clone, direct to ?url
    var req2 = web.dispatch({ method: req.method, url: req.params.url });
    for (var k in req) {
        if (web.isHeaderKey(k)) {
            req2.header(k, req[k]);
        }
    }
    // req2.link(gui.getActiveProgramLinks()); :TODO:
    req.pipe(req2);
    req2.pipe(res);
}