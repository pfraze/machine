/**
 * Link registry
 */
var globals = require('../globals');
var mimetypes = require('../mimetypes');

module.exports = {};
var linkRegistry = [];
local.util.mixinEventEmitter(module.exports);

var naReltypesRegex = /(^|\b)(self|via|up)(\b|$)/g;
module.exports.loadUri = function(uri, autoEnable) {
	// Create the entry
	var entry = {
		id: linkRegistry.length,
		uri: uri,
		links: [],
		active: false
	};
	linkRegistry.push(entry);

	// Fetch the URI
	lookup(uri).always(function(res) {
		// Index the received self links
		var selfLinks = local.queryLinks(res, { rel: 'self' });
		if (!selfLinks.length) {
			// Default data
			selfLinks = [{ rel: 'todo.com/rel/media', href: uri }];
			if (res.header('Content-Type')) {
				selfLinks[0].type = res.header('Content-Type');
			}
		} else if (selfLinks.length > 10) {
			console.warn('Received '+selfLinks.length+' "self" links from '+uri+' - truncating to 10.');
			selfLinks.length = 10;
		}

		// Prep links
		selfLinks.forEach(function(link) {
			link['index-entry'] = entry.id;
			// Strip non-applicable reltypes
			link.rel = link.rel.replace(naReltypesRegex, '');
			// Guess mimetype if not given on a media link
			if (/(^|\b)todo.com\/rel\/media(\b|$)/.test(link.rel) && !link.type) {
				link.type = mimetypes.lookup(link.href, false, 'application/octet-stream');
				console.log('Media link without `type`, guessed', link.type, 'from', link.href);
			}
		});
		entry.links = selfLinks;

		// Autoenable
		if (autoEnable) {
			module.exports.enableEntry(entry.id);
		}
	});

	return entry;
};



function lookup(url) {
	var p = local.promise();
	var urld = local.parseUri(url);
	if (!urld || !urld.authority) {
		p.fulfill(false); // bad url, dont even try it!
		return p;
	}

	var triedProxy = false;
	var attempts = [new local.Request({ method: 'HEAD', url: url })]; // first attempt, as given
	if (!urld.protocol) {
		// No protocol? Two more attempts - 1 with https, then one with plain http
		attempts.push(new local.Request({ method: 'HEAD', url: 'https://'+urld.authority+urld.relative }));
		attempts.push(new local.Request({ method: 'HEAD', url: 'http://'+urld.authority+urld.relative }));
	}

	var lookupReq;
	function makeAttempt() {
		if (lookupReq) lookupReq.close();
		lookupReq = attempts.shift();
		local.dispatch(lookupReq).always(function(res) {
			if (res.status >= 200 && res.status < 300) {
				p.fulfill(res); // Done!
			} else if (res.status == 0 && !triedProxy) {
				// CORS issue, try the proxy
				triedProxy = true;
				globals.fetchProxyUA.resolve({ nohead: true }).always(function(proxyUrl) {
					if (!urld.protocol) {
						attempts = [
							new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative } }),
							new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative } }),
							new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative } }),
							new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative } })
						];
					} else {
						attempts = [
							new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: url } }),
							new local.Request({ method: 'GET', url: proxyUrl, query: { url: url } })
						];
					}
					makeAttempt();
				});
			} else {
				// No dice, any attempts left?
				if (attempts.length) {
					makeAttempt(); // try the next one
				} else {
					p.fulfill(res); // no dice
				}
			}
		});
		lookupReq.end();
	}
	makeAttempt();

	return p;
}

module.exports.enableEntry = function(id) {
	if (linkRegistry[id] && !linkRegistry[id].active) {
		// Enable
		linkRegistry[id].active = true;
		module.exports.emit('add', linkRegistry[id]);

		// Update GUI
		var $btn = $('#chat-out [href="httpl://chat.ui/index/'+id+'"]');
		$btn.removeClass('label-default').addClass('label-primary').attr('method', 'DISABLE');
	}
};
module.exports.disableEntry = function(id) {
	if (linkRegistry[id] && linkRegistry[id].active) {
		// Disable
		linkRegistry[id].active = false;
		module.exports.emit('remove', linkRegistry[id]);

		// Update GUI
		var $btn = $('#chat-out [href="httpl://chat.ui/index/'+id+'"]');
		$btn.addClass('label-default').removeClass('label-primary').attr('method', 'ENABLE');
	}
};

module.exports.populateLinks = function(arr) {
	linkRegistry.forEach(function(entry) {
		if (!entry.active) return;
		entry.links.forEach(function(link) {
			arr.push(link);
		});
	});
};