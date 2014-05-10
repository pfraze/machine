var cache = require('./cache');

// proxy to http/s
local.at('#(https?://.*)', function(req, res, worker) {
    // :TODO: perms

    // add query params back onto url if parsed out
    if (Object.keys(req.params).length) {
        req.pathd[1] += '?'+local.contentTypes.serialize('form', req.params);
    }

    // try the cache
    if (req.HEAD || req.GET) {
        if (cache.respond(req.pathd[1], res, req.HEAD)) {
            return;
        }
    }

    // :TODO: targets-cache
    var req2 = local.dispatch({ method: req.method, url: req.pathd[1] });
    req.pipe(req2);
    req2.pipe(res);
});