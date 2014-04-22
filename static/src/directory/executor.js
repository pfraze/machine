module.exports = {
	setup: setup,
	get: getExecution,
	runAction: runAction
};

// Executor
// ========
var _executions = {};
var _modal_execution = null; // the execution currently in a modal

// EXPORTED
function setup() {
	// setup modal-window close behavior
	$('#modal-window').on('hide.bs.modal', function() {
		if (_modal_execution) {
			// if we still have a modal execution, then it has been cancelled
			_modal_execution.stop(true);
			_modal_execution = null;
		}
	});
	// setup modal-window primary button behavior
	$('#modal-window .modal-footer .btn-primary').on('click', function() {
		var $form = $('#modal-window .modal-body form');
		if ($form.length === 0) {
			console.warn('Wanted to submit the modal, but no form found in content');
			return;
		}

		var request = local.util.extractRequest($form[0], $form[0]);
		if (!request) { console.warn('Unable to build request from modal form'); return; }

		// dispatch request and continue execution
		var exec = _modal_execution;
		local.util.finishPayloadFileReads(request).then(function() {
			exec.dispatch(request).always(handleActionRes(exec.id));
		});
		// don't close modal yet - wait for response in case it's still needed
	});
}

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
	exec.res_.always(handleActionRes(exec.id));
	req.end(reqBody);

	return exec;
}

// produces callback to handle the response of an action
function handleActionRes(execid) {
	return function(res) {
		var exec = _executions[execid];
		if (!exec) { return console.error('Execution not in masterlist when handling response', execid, res); }
		// ^ this should never happen, if it does the flow is broken somehow
		var modal = (res.parsedHeaders.pragma) ? res.parsedHeaders.pragma.modal : false;

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
				if (modal) {
					exec.spawnModal(modal, gui);
				} else {
					exec.setGui(gui);
				}
			});
		}

		// stop on response close
		if (!modal) {
			res.on('close', exec.stop.bind(exec, false));
			closeModalIfActive(); // close modal now because we know we dont need it
		}
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

		dispatch: dispatchFromExecution,
		stop: stopExecution,
		setGui: setExecutionGui,
		spawnModal: spawnExecutionModal
	};
	return _executions[execid];
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

// helper to close the active modal
function closeModalIfActive() {
	_modal_execution = null;
	$('#modal-window').modal('hide');
}

// Execution-object Methods
// ========================

// executes a request from the execution, either from a GUI element or from the worker
function dispatchFromExecution(req) {
	// audit request
	// :TODO: only to self

	// prep request
	var body = req.body;
	delete req.body;

	req.stream = true;

	if (!req.headers) { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }

	if (!local.isAbsUri(req.url)) {
		req.url = local.joinUri(this.domain, req.url);
	}

	// dispatch
	req = (req instanceof local.Request) ? req : (new local.Request(req));
	var res_ = local.dispatch(req);
	req.end(body);
	return res_;
}

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
function setExecutionGui(doc) {
	var html = (doc && typeof doc == 'object') ? JSON.stringify(doc) : (''+doc);
	if (html && this.el)
		this.el.querySelector('.execgui-inner').innerHTML = html;
}

// creates a modal
// - `modalDef`: a string of "title text|ok button text|cancel button text"
function spawnExecutionModal(modalDef, doc) {
	if (_modal_execution && _modal_execution !== this) {
		console.error('Attempted to create a modal while another modal existed! Please report this to the layer1 devs.');
		return;
	}
	_modal_execution = this;
	this.setGui('Waiting for user input');

	// pull out text from modal definition
	modalDef = (modalDef||'').split('|');
	var title  = modalDef[0] || this.meta.title || this.meta.href;
	var ok     = modalDef[1] || 'Submit';
	var cancel = modalDef[2] || 'Cancel';

	// create modal
	var html = (doc && typeof doc == 'object') ? JSON.stringify(doc) : (''+doc);
	var $mwin = $('#modal-window');
	$mwin.find('.modal-title').text(title);
	$mwin.find('.modal-footer .btn-primary').text(ok);
	$mwin.find('.modal-footer .btn-default').text(cancel);
	$mwin.find('.modal-body').html(doc);
	$mwin.modal();
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
	var self = this;
	this.dispatch(e.detail).always(function(res) {
		if (res.body) {
			self.setGui(res.body);
		}
	});
}

// handle titlebar close button click
function onActionGuiClose(e) {
	this.stop(true);
}