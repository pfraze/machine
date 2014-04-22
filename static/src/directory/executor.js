module.exports = {
	get: getExecution,
	runAction: runAction
};

// Executor
// ========
var _executions = {};

// EXPORTED
// execution lookup, validates against domain
function getExecution(domain, id) {
	var exec = _executions[id];
	if (exec && exec.domain === domain)
		return exec;
}

// EXPORTED
// create "action" execution
function runAction(url, meta, reqBody) {
	var execid = allocId();
	var urld = local.parseUri(url);
	var domain = urld.protocol + '://' + urld.authority;

	// allocate execution and gui space
	var exec = createExecution(execid, domain, meta);
	createActionGui(exec);

	// setup and dispatch request
	var req = new local.Request({
		method: 'POST',
		url: local.joinUri(url, execid),
		Accept: 'text/html',
		stream: true
	});
	exec.req = req;
	exec.res_ = local.dispatch(req);
	exec.res_.always(handleRunActionRes(exec.id));
	req.end(reqBody);

	return exec;
}

// produces callback to handle the response of an action
function handleRunActionRes(execid) {
	return function(res) {
		var exec = _executions[execid];
		if (!exec) { return console.error('Execution not in masterlist when handling response', execid, res); }
		// ^ this should never happen, if it does the flow is broken somehow

		if (res.header('Content-Type') == 'text/event-stream') {
			// stream update events into the GUI
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
		} else {
			// output final response to GUI
			res.on('end', function() {
				var gui = res.body;
				if (!gui) {
					gui = '';
					if (exec.meta && exec.meta.title) gui += exec.meta.title+' ';
					if (res.status >= 200 && res.status < 400) gui += 'Finished';
					else gui += 'Failed';
				}
				exec.setGui(gui);
			});
		}

		// stop on response close
		res.on('close', exec.stop.bind(exec));
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
function createExecution(execid, domain, meta) {
	_executions[execid] = {
		meta: meta,
		domain: domain,
		id: execid,
		el: null,

		stop: stopExecution,
		setGui: setExecutionGui
	};
	return _executions[execid];
}

// Execution-object Methods
// ========================

// closes request, removes self from masterlist
function stopExecution(fastRemove) {
	if (this.id in _executions) {
		this.req.close();
		delete _executions[this.id];

		if (fastRemove) {
			$(this.el).remove();
		} else {
			// remove gui in 3 seconds
			var el = this.el;
			setTimeout(function() { $(el).remove(); }, 3000);
		}
	}
}

// updates self's gui
function setExecutionGui(v) {
	var html = (v && typeof v == 'object') ? JSON.stringify(v) : (''+v);
	if (html && this.el)
		this.el.querySelector('.execgui-inner').innerHTML = html;
}

// Action-specific Methods
// =======================

// create gui-segment for an action to use
function createActionGui(execution) {
	var title = execution.domain;
	if (execution.meta && execution.meta.title) {
		title = execution.meta.title;
	}
	var $el = $(
		'<div id="execgui-'+execution.id+'" class="execgui actiongui">'+
			'<div class="actiongui-title"><small>'+title+' <a href="#" class="glyphicon glyphicon-remove"></a></small></div>'+
			'<div class="execgui-inner">Loading...</div>'+
		'</div>'
	);
	$('#action-guis').append($el);
	execution.el = $el[0];
	execution.el.addEventListener('request', onActionGuiRequest.bind(execution));
	execution.el.querySelector('.actiongui-title .glyphicon-remove').addEventListener('click', onActionGuiClose.bind(execution));
}

// handle request-event from an action's gui
function onActionGuiRequest(e) {
	var req = e.detail;
	var body = req.body; delete req.body;

	// audit request
	// :TODO: only to self

	// prep request
	if (!req.headers) { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }
	req = (req instanceof local.Request) ? req : (new local.Request(req));
	if (!local.isAbsUri(req.url)) {
		req.url = local.joinUri(this.domain, req.url);
	}

	// dispatch, render response
	var self = this;
	local.dispatch(req).always(function(res) {
		if (res.body) {
			self.setGui(res.body);
		}
	});
	req.end(body);
}

// handle titlebar close button click
function onActionGuiClose(e) {
	this.stop(true);
}