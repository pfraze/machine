module.exports = {
	invoke: invoke
};

function invoke(link, depLoadFn, teardownFn) {
	// Create a context for producing the final URI
	var uriCtx = {};
	var mixin = local.util.mixin.bind(uriCtx);

	// Load dependencies and mix them into the context
	if (link.uses) {
		link.uses.split(' ').forEach(function(dep) {
			// depLoadFn should return an object of `uri-token`->`value`
			mixin(depLoadFn(dep));
		});
	}

	// Produce URI
	var url = local.UriTemplate.parse(link.href).expand(uriCtx);

	// Invoke
	var invokeTxn = new local.Request({ method: 'INVOKE', url: url, stream: true });
	local.dispatch(invokeTxn).always(handleInvokeResponse);
	if (teardownFn) { invokeTxn.on('close', teardownFn); }
	return invokeTxn;
}

function handleInvokeResponse(res) {
	// :TODO:
	if (!(res.status >= 200 || res.status < 300)) {
		console.error('Agent INVOKE failed with', res.status);
	}
}