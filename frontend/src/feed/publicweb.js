var cache = require('./cache');
var gui = require('./gui');

web.export(pubweb_proxy);
pubweb_proxy.opts({
    stream: true,
    allmethods: true
});
function pubweb_proxy(req, res, worker) {
    // :TODO: perms

    // try the cache
    if (req.method == 'HEAD' || req.method == 'GET') {
        if (cache.respond(req.params.url, res, req.method == 'HEAD')) {
            return;
        }
    }

    // :TODO: targets-cache
    var req2 = web.dispatch({ method: req.method, url: req.params.url });
    for (var k in req) {
        if (web.isHeaderKey(k)) {
            req2.header(k, req[k]);
        }
    }
    req2.link(gui.getActiveProgramLinks());
    req.pipe(req2);
    req2.pipe(res);
}