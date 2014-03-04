/**
 * Link registry
 */

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
	local.GET(uri).always(function(res) {
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
		});
		entry.links = selfLinks;

		// Autoenable
		if (autoEnable) {
			module.exports.enableEntry(entry.id);
		}
	});

	return entry;
};

module.exports.enableEntry = function(id) {
	if (linkRegistry[id] && !linkRegistry[id].active) {
		// Enable
		linkRegistry[id].active = true;
		module.exports.emit('added', linkRegistry[id]);

		// Update GUI
		var $btn = $('#chat-out [href="httpl://chat.ui/index/'+id+'"]');
		$btn.removeClass('label-default').addClass('label-primary').attr('method', 'DISABLE');
	}
};
module.exports.disableEntry = function(id) {
	if (linkRegistry[id] && linkRegistry[id].active) {
		// Disable
		linkRegistry[id].active = false;
		module.exports.emit('removed', linkRegistry[id]);

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