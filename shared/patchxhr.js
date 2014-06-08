// modifies XMLHttpRequest to use localjs
module.exports.patchXHR = function(messageToExtension) {
	// Store references to original methods
	var orgXHR = XMLHttpRequest;
	var orgPrototype = XMLHttpRequest.prototype;
	function patchedXHR() {}
	(window || self).XMLHttpRequest = patchedXHR;
	patchedXHR.UNSENT = 0;
	patchedXHR.OPENED = 1;
	patchedXHR.HEADERS_RECEIVED = 2;
	patchedXHR.LOADING = 4;
	patchedXHR.DONE = 4;

	patchedXHR.prototype.open = function(method, url, async, user, password) {
		// Construct request
		Object.defineProperty(this, '__headers', { value: { method: method, url: url } });
		if (user) {
			this.__headers.Authorization = 'Basic '+btoa(user+':'+(password||''));
		}

		// Update state
		this.readyState = 1;
		if (this.onreadystatechange) {
			this.onreadystatechange();
		}
	};

	patchedXHR.prototype.send = function(data) {
		var this2 = this;

		// Dispatch and send data
		var msg = this.__headers;
		if (data) {
			msg.body = data;
		}
		msg.end = true;
		Object.defineProperty(this, '__osid', { value: messageToExtension(msg) });

		// Wire up events
		/*this.__local_request.always(function(res) {
			Object.defineProperty(this2, '__local_response', { value: res });

			// Update state
			this2.readyState = 2;
			this2.status = res.status;
			this2.statusText = res.status + ((res.reason) ? ' ' + res.reason : '');
			this2.responseText = null;

			// Fire event
			if (this2.onreadystatechange) {
				this2.onreadystatechange();
			}
			res.on('data', function(chunk) {
				this2.readyState = 3;
				if (this2.responseText === null && typeof chunk == 'string') this2.responseText = '';
				this2.responseText += chunk;
				// Fire event
				if (this2.onreadystatechange) {
					this2.onreadystatechange();
				}
			});
			res.on('end', function() {
				this2.readyState = 4;
				switch (this2.responseType) {
					case 'json':
						this2.response = res.body;
						break;

					default:
						this2.response = this2.responseText;
						break;
				}
				// Fire event
				if (this2.onreadystatechange) {
					this2.onreadystatechange();
				}
				if (this2.onload) {
					this2.onload();
				}
			});
		});*/
	};

	patchedXHR.prototype.abort = function() {
		messageToExtension({ sid: this.__osid, close: true });
	};

	var headerKeyRegex = /(^|-)(.)/g;
	function formatHeaderKey(str) {
		// strip any dashes, convert to camelcase
		// eg 'foo-bar' -> 'FooBar'
		return str.replace(headerKeyRegex, function(_0,_1,_2) { return _2.toUpperCase(); });
	}

	patchedXHR.prototype.setRequestHeader = function(k, v) {
		this.__headers[formatHeaderKey(k)] = v;
	};

	var stdHeaderNameRegex = /([a-z])([A-Z])/g;
	function stdHeaderNameReplacer($all, $1, $2) { return $1+'-'+$2; }
	function stdHeaderName(name) {
		return name.replace(stdHeaderNameRegex, stdHeaderNameReplacer);
	}

	patchedXHR.prototype.getAllResponseHeaders = function() {
		/*if (this.__local_response) {
			var headers = [];
			for (var k in this.__local_response) {
				if (web.isHeaderKey(k)) {
					headers.push(stdHeaderName(k)+': '+this.__local_response[k]);
				}
			}
			return headers.join('\r\n');
		}*/
		return null;
	};

	patchedXHR.prototype.getResponseHeader = function(k) {
		/*if (this.__local_response) {
			return this.__local_response[web.formatHeaderKey(k)];
		}*/
		return null;
	};
};