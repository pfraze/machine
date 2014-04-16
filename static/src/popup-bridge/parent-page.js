module.exports = {
	PopupBridgeServer: PopupBridgeServer,
	createPopup: function(url, serverFn) {
		var server = new PopupBridgeServer({ src: url, serverFn: serverFn });
		local.addServer('popup-'+activePopupServers.length, server);
		return server;
	}
};
var activePopups = [];
var activePopupServers = [];

// Handle messages from popups
window.addEventListener('message', function(e) {
	// Get the popup server
	// :TODO: see if this works
	var id = activePopups.indexOf(e.source);
	if (id === -1) return;
	var server = activePopupServers[id];
	if (!server) return;
	/*var server = activePopupServers[e.data.cid];
	if (!server) {
		return;
	}*/

	// Make sure this is from our popup's domain
	if (e.origin !== server.getOrigin()) {
		console.warn('Received message from popup at',e.origin,'Expected',server.getOrigin(),'Closing connection');
		server.terminate(); // popup has gone rogue, shut it down
		return;
	}

	// Handle message
	server.onChannelMessage(e.data);
});

// PopupBridgeServer
// ======================
// EXPORTED
// wrapper for the channel to a popup
// - `config.src`: string, the url to open
// - `config.serverFn`: function(req, res, server)
function PopupBridgeServer(config) {
	var self = this;
	if (!config || !config.src) {
		throw "config.src is required";
	}
	local.BridgeServer.call(this, config);
	this.srcd = local.parseUri(config.src);
	this.origin = this.srcd.protocol + '://' + this.srcd.authority;

	// Open interface in a popup
	this.popupWindow = window.open(config.src);
	activePopupServers.push(this);
	activePopups.push(this.popupWindow);
}
PopupBridgeServer.prototype = Object.create(local.BridgeServer.prototype);

PopupBridgeServer.prototype.getOrigin = function() { return this.origin; };
PopupBridgeServer.prototype.isChannelActive = function() {
	return !!this.popupWindow;
};

PopupBridgeServer.prototype.terminate = function(status, reason) {
	local.BridgeServer.prototype.terminate.call(this, status, reason);

	var a = activePopups.indexOf(this.popupWindow);
	if (a !== -1) {
		delete activePopups[a];
	}

	var b = activePopupServers.indexOf(this);
	if (b !== -1) {
		delete activePopupServers[b];
	}

	this.popupWindow = null;
};

// Sends a single message across the channel
// - `msg`: required string
PopupBridgeServer.prototype.channelSendMsg = function(msg) {
	if (!this.popupWindow) throw "Attempted to send message to closed popup";
	this.popupWindow.postMessage(msg, this.getOrigin());
};

// Remote request handler
PopupBridgeServer.prototype.handleRemoteRequest = function(request, response) {
	if (this.config.serverFn) {
		this.config.serverFn.call(this, request, response, this);
	} else if (local.getServer('popup-bridge')) {
		var server = local.getServer('popup-bridge');
		server.fn.call(server.context, request, response, this);
	} else {
		response.writeHead(501, 'server not implemented');
		response.end();
	}
};