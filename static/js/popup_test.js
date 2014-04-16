if (!window.opener) {
	console.error('No opener page detected, connection unavailable');
}

var openerServer;

// Handle messages from opener window
window.addEventListener('message', function(e) {
	if (!openerServer) return;
	if (e.source !== window.opener) return;

	// Make sure this is from our original opener's domain
	if (e.origin !== openerServer.getOrigin()) {
		console.warn('Received message from opener at',e.origin,'Expected',openerServer.getOrigin(),'Closing connection');
		openerServer.terminate(); // opener has gone rogue, shut it down
		return;
	}

	// Handle message
	openerServer.onChannelMessage(e.data);
});

// OpenerBridgeServer
// =======================
// EXPORTED
// wrapper for the channel to a opener window
// - `config.serverFn`: function(req, res, server)
function OpenerBridgeServer(config) {
	var self = this;
	local.BridgeServer.call(this, config);
	this.isActive = !!window.opener;
	if (this.isActive) {
		this.srcd = local.parseUri(window.opener.location.toString());
		this.origin = this.srcd.protocol + '://' + this.srcd.authority;
	}

	openerServer = this;
}
OpenerBridgeServer.prototype = Object.create(local.BridgeServer.prototype);

OpenerBridgeServer.prototype.getOrigin = function() { return this.origin; };
OpenerBridgeServer.prototype.isChannelActive = function() {
	return (openerServer && openerServer == this);
};

OpenerBridgeServer.prototype.terminate = function(status, reason) {
	local.BridgeServer.prototype.terminate.call(this, status, reason);

	openerServer = null;
	this.isActive = false;
};

// Sends a single message across the channel
// - `msg`: required string
OpenerBridgeServer.prototype.channelSendMsg = function(msg) {
	if (!this.isActive) throw "Attempted to send message with no opener window";
	window.opener.postMessage(msg, this.getOrigin());
};

// Remote request handler
OpenerBridgeServer.prototype.handleRemoteRequest = function(request, response) {
	if (this.config.serverFn) {
		this.config.serverFn.call(this, request, response, this);
	} else if (local.getServer('opener-bridge')) {
		var server = local.getServer('opener-bridge');
		server.fn.call(server.context, request, response, this);
	} else {
		response.writeHead(501, 'server not implemented');
		response.end();
	}
};

function createOpener(server) {
	local.addServer('opener', new OpenerBridgeServer({ serverFn: server }));
}
createOpener(function(req, res, server) {
	console.log('received request from opener', req);
	res.writeHead(204).end();
});