var _requests = {};
module.exports = {
	add: add,
	respond: respond
};

function add(url, req) {
	_requests[url] = req;
}

function respond(url, res, isHEAD) {
	var req = _requests[url];
	if (!req) return false;
	var dropBody = function() { return ''; };
	req.pipe(res, null, (isHEAD) ? dropBody : null);
	return true;
}

local.at('#cache/(.*)', function(req, res, worker) {
	// :TODO: perms

	if (req.HEAD || req.GET) {
		if (respond(req.pathd[1], res, req.HEAD)) {
			return;
		}
		res.s404().end();
	} else {
		res.s405().Allow('HEAD, GET').end();
	}
});