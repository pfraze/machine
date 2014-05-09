var _requests = {};
module.exports = {
    add: add,
    respond: respond
};

function add(url, req) {
    _requests[url] = req;
}

function respond(url, res) {
    var req = _requests[url];
    if (!req) return false;
    req.pipe(res);
    return true;
}
        