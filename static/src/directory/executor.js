module.exports = {
	setup: setup,
	get: getExecution,
	dispatch: dispatch
};

// Executor
// ========
var _executions = {};
var _mediaLinks; // links to items in the feed

// EXPORTED
function setup(mediaLinks) {
	_mediaLinks = mediaLinks;
}

// EXPORTED
// execution lookup, validates against domain
function getExecution(domain, id) {
	var exec = _executions[id];
	if (exec && (exec.domain === domain || domain === true))
		return exec;
}

// EXPORTED
// create an execution for the request
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
	var execid = allocId();
	var exec = createExecution(execid, pluginDomain, pluginMeta, $el);

	// prep request
	var body = req.body;
	delete req.body;

	req.stream = true;

	if (!req.headers) { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }
	req.headers.authorization = 'ID '+execid; // attach execid

	if (!local.isAbsUri(req.url)) {
		req.url = local.joinUri(pluginDomain, req.url);
	}

	// dispatch
	exec.req = (req instanceof local.Request) ? req : (new local.Request(req));
	exec.res_ = local.dispatch(req).always(handleExecRes(execid));
	exec.req.end(body);
	return exec;
}

// produces callback to handle the response of an action
function handleExecRes(execid) {
	return function(res) {
		var exec = _executions[execid];
		if (!exec) { return console.error('Execution not in masterlist when handling response', execid, res); }

		if (res.header('Content-Type') == 'text/event-stream') {
			// stream update events into the GUI
			streamGui(res, exec);
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
				exec.setGui(gui);
			});
		}

		// end on response close
		res.on('close', exec.end.bind(exec));
	};
}

// allocate unused id
function allocId() {
	var execid;
	do {
		execid = Math.round(Math.random()*1000000000); // :TODO: pretty weak PNRG, is that a problem?
	} while(execid in _executions);
	return execid;
}

// create execution base-structure, store in masterlist
function createExecution(execid, domain, meta, $el) {
	_executions[execid] = {
		meta: meta,
		domain: domain,
		id: execid,
		$el: $el,
		selection: captureSelection(),

		end: endExecution,
		setGui: setExecutionGui,
		getSelectedLinks: getExecutionSelectedLinks
	};
	return _executions[execid];
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

// helper to update an execution using an event-stream
function streamGui(res, exec) {
	var buffer = '', eventDelimIndex;
	res.on('data', function(chunk) {
		chunk = buffer + chunk;
		// Step through each event, as its been given
		while ((eventDelimIndex = chunk.indexOf('\r\n\r\n')) !== -1) {
			var e = chunk.slice(0, eventDelimIndex);
			e = local.contentTypes.deserialize('text/event-stream', e);
			if (e.event == 'update') {
				exec.setGui(e.data);
			}
			chunk = chunk.slice(eventDelimIndex+4);
		}
		buffer = chunk;
		res.body = '';
	});
}


// Execution-object Methods
// ========================

// closes request, removes self from masterlist
function endExecution() {
	if (this.id in _executions) {
		this.req.close();
		delete _executions[this.id];
	}
}

// updates self's gui
function setExecutionGui(doc) {
	var html = (doc && typeof doc == 'object') ? JSON.stringify(doc) : (''+doc);
	if (html && this.$el)
		this.$el.find('.plugingui-inner').html(html);
}

// helper gives a list of links for the selected items captured on the execution
function getExecutionSelectedLinks() {
	return this.selection.map(function(id) {
		return _mediaLinks[id];
	});
}

// :TODO: ?
// // handle titlebar close button click
// function onActionGuiClose(e) {
// 	this.end();
// }