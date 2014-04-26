module.exports = {
	setup: setup,
	get: getAction,
	dispatch: dispatch
};

// Actions Executor
// ================
var _actions = {};
var _mediaLinks; // links to items in the feed

// EXPORTED
function setup(mediaLinks) {
	_mediaLinks = mediaLinks;
}

// EXPORTED
// action lookup, validates against domain
function getAction(domain, id) {
	var act = _actions[id];
	if (act && (act.domain === domain || domain === true))
		return act;
}

// EXPORTED
// start an action with the given request
// - req: obj, the request
// - pluginMeta: obj, the link to the plugin
// - $el: jquery element, the plugin's GUI
function dispatch(req, pluginMeta, $el) {
	var reqUrld      = local.parseUri(req.url);
	var reqDomain    = reqUrld.protocol + '://' + reqUrld.authority;
	var pluginUrld   = local.parseUri(pluginMeta.href);
	var pluginDomain = pluginUrld.protocol + '://' + pluginUrld.authority;

	// audit request
	// :TODO:

	// allocate execution and gui space
	var actid = allocId();
	var act = createAction(actid, pluginDomain, pluginMeta, $el);

	// prep request
	var body = req.body;
	delete req.body;

	req.stream = true;

	if (!req.headers) { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }
	req.headers.authorization = 'Action '+actid; // attach actid

	if (!local.isAbsUri(req.url)) {
		req.url = local.joinUri(pluginDomain, req.url);
	}

	// dispatch
	act.req = (req instanceof local.Request) ? req : (new local.Request(req));
	act.res_ = local.dispatch(req).always(handleActRes(actid));
	act.req.end(body);
	return act;
}

// produces callback to handle the response of an action
function handleActRes(actid) {
	return function(res) {
		var act = _actions[actid];
		if (!act) { return console.error('Action not in masterlist when handling response', actid, res); }

		if (res.header('Content-Type') == 'text/event-stream') {
			// stream update events into the GUI
			streamGui(res, act);
		} else {
			// output final response to GUI
			res.on('end', function() {
				var gui = res.body;
				if (!gui) {
					var reason;
					if (res.reason) { reason = res.reason; }
					else if (res.status >= 200 && res.status < 400) { reason = 'success'; }
					else if (res.status >= 400 && res.status < 500) { reason = 'bad request'; }
					else if (res.status >= 500 && res.status < 600) { reason = 'error'; }
					gui = reason + ' <small>'+res.status+'</small>';
				}
				act.setGui(gui);
			});
		}

		// end on response close
		res.on('close', act.stop.bind(act));
	};
}

// allocate unused id
function allocId() {
	var actid;
	do {
		actid = Math.round(Math.random()*1000000000); // :TODO: pretty weak PNRG, is that a problem?
	} while(actid in _actions);
	return actid;
}

// create action base-structure, store in masterlist
function createAction(actid, domain, meta, $el) {
	_actions[actid] = {
		meta: meta,
		domain: domain,
		id: actid,
		$el: $el,
		selection: captureSelection(),

		req: null,
		res_: null,

		stop: stopAction,
		setGui: setActionGui,
		getSelectedLinks: getActionSelectedLinks
	};
	return _actions[actid];
}

// helper to get the items selected currently
function captureSelection() {
	var $selected = $('.directory-links-list > .selected');
	var arr = [];
	for (var i=0; i < $selected.length; i++) {
		arr.push(parseInt($selected[i].id.slice(5), 10)); // skip 'slot-' to extract id
	}
	return arr;
}

// helper to update an action's gui using an event-stream
function streamGui(res, act) {
	var buffer = '', eventDelimIndex;
	res.on('data', function(chunk) {
		chunk = buffer + chunk;
		// Step through each event, as its been given
		while ((eventDelimIndex = chunk.indexOf('\r\n\r\n')) !== -1) {
			var e = chunk.slice(0, eventDelimIndex);
			e = local.contentTypes.deserialize('text/event-stream', e);
			if (e.event == 'update') {
				act.setGui(e.data);
			}
			chunk = chunk.slice(eventDelimIndex+4);
		}
		buffer = chunk;
		res.body = '';
	});
}


// Action-object Methods
// =====================

// closes request, removes self from masterlist
function stopAction() {
	if (this.id in _actions) {
		this.req.close();
		delete _actions[this.id];
	}
}

// updates self's gui
function setActionGui(doc) {
	var html = (doc && typeof doc == 'object') ? JSON.stringify(doc) : (''+doc);
	if (html && this.$el)
		this.$el.find('.plugin-gui-inner').html(html);
}

// helper gives a list of links for the selected items captured on the execution
function getActionSelectedLinks() {
	return this.selection.map(function(id) {
		return _mediaLinks[id];
	});
}

// :TODO: ?
// // handle titlebar close button click
// function onActionGuiClose(e) {
// 	this.end();
// }