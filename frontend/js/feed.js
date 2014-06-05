(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.once = noop;
process.off = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],2:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("C:\\Users\\Paul Frazee\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js"))
},{"C:\\Users\\Paul Frazee\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js":1}],3:[function(require,module,exports){
var globals = require('./globals');

module.exports = {
	setup: function() {
		if (globals.session.user) {
			$('.profile-btn').text(globals.session.user).css('display', 'inline-block');
			$('.show-on-authed').show();
			$('.auth-btn').text('Logout').on('click', function() {
				// :TODO:
			});
		} else {
			$('.auth-btn').removeClass('btn-default').addClass('btn-success').on('click', function() {
				// :TODO:
			});
		}

		if (globals.session.isPageAdmin) {
			$('.show-on-admin').show();
		}
	}
};
},{"./globals":10}],4:[function(require,module,exports){
var _requests = {};
module.exports = {
	add: add,
	respond: respond
};

function add(url, req) {
	_requests[url] = req;
}

function respond(url, res, isHEAD) {
	var req = _requests[url];
	if (!req) return false;
	var dropBody = function() { return ''; };
	req.pipe(res, null, (isHEAD) ? dropBody : null);
	return true;
}

web.export(cache$);
cache$.opts({ stream: true });
function cache$(req, res, worker) {
	// :TODO: perms

    // add query params back onto url if parsed out
    if (Object.keys(req.params).length) {
        req.pathd[1] += '?'+web.contentTypes.serialize('form', req.params);
    }

	if (respond(req.pathd[1], res, req.HEAD)) {
		return;
	}
	res.status(404, 'Not Found').end();
}
},{}],5:[function(require,module,exports){
var util = require('../util');

module.exports = {
	setup: function(indexLinks) {
		indexLinks.forEach(addIndex);
	},
	get: function() { return _cfg; },
	addIndex: addIndex,
	setIndex: setIndex,
	findLink: findLink,
	findRenderers: findRenderers,
	findRenderer: findRenderer
};

// The active feed config
var _cfg = {
	curIndex: null,
	indexLinks: [],
	indexes: {}, // indexHref -> [link]
	renderers: {}  // indexHref -> [link]
};

function addIndex(indexLink) {
	_cfg.indexLinks.push(indexLink);
	_cfg.indexes[indexLink.href] = [];
	_cfg.renderers[indexLink.href] = [];
	if (!_cfg.curIndex) {
		_cfg.curIndex = indexLink.href;
	}
	return web.HEAD(indexLink.href).then(function(res) {
		_cfg.indexes[indexLink.href] = res.links;
		_cfg.renderers[indexLink.href] = res.links.query('layer1.io/renderer');
		return res;
	});
}

function setIndex(indexLink) {
	if (!(indexLink.href in _cfg.indexes)) {
		addIndex(indexLink);
	}
	_cfg.curIndex = indexLink.href;
}

function findLink(query) {
	var links = _cfg.indexes[_cfg.curIndex];
	var terms = query.split(' ').map(function(term) { return new RegExp(term, 'i'); });

	for (var i=0; i < links.length; i++) {
		var link = links[i];
		var linkText =
			(link.href||'')  + ' ' +
			(link.rel||'')   + ' ' +
			(link.title||'') + ' ' +
			(link.keywords||'')
		;
		var match = true;
		for (var j = 0; j < terms.length; j++) {
			if (!terms[j].test(linkText)) {
				match = false;
				break;
			}
		}
		if (match) {
			return link;
		}
	}
	return null;
}

function findRenderers(targetLink, maxMatches) {
	var matches = [];
	var renderers = _cfg.renderers[_cfg.curIndex];

	for (var i=0; i < renderers.length; i++) {
		var g = renderers[i];
		if (!g.for) continue;
		if (web.queryLink(targetLink, g.for)) {
			matches.push(g);
			if (matches.length >= maxMatches)
				return matches;
		}
	}
	return matches;
}

function findRenderer(targetLink) {
	return findRenderers(targetLink, 1)[0];
}
},{"../util":15}],6:[function(require,module,exports){
var sec = require('../security');
var mimetypes = require('../mimetypes');
var util = require('../util');
var feedcfg = require('./feedcfg');
var cache = require('./cache');

module.exports = {
	setup: setup,
	render: render,
	getActiveProgramLinks: function() { return _active_program_links; }
};

var _media_links = null;
var _active_program_links = null;
var _default_view_link = { rel: 'layer1.io/view', href: '#gui_defview' };
var _program_view_link = null; // current view
var _mode;/*
_mode = "program"; // viewing a set of links generated by the user's search program
*/
var _fetchproxy = web.client('/').service({ id: '.fetch', rel: 'layer1.io/proxy' });
function setup(mediaLinks) {
	_media_links = mediaLinks;

	// Setup program editor
	var $input = $('#program-input');
	$input.on('keyup', onProgramInputKeyup);
	$('#run-program-btn').on('click', onRunProgramButtonClick);

	// Setup program view
	var $programView = $('#program-view');
	$programView.on('request', onViewRequest);
}

function render(mode, opts) {
	opts = opts || {};
	_mode = mode || _mode;
	switch (_mode) {
	case 'program':
		// extract queries
		var queries = extractProgramQueries($('#program-input').val());
		console.debug('Extracted the following queries from your posted program:', queries);

		// resolve all queries
		var links = resolveProgramQueries(queries);
		console.debug('Queries resolved to:', links);
		links = web.processLinks(links); // decorate with helper methods

		// Run new program
		setActiveProgramLinks(links);
		runProgram(links.get('layer1.io/view') || _default_view_link);

		break;
	}
}

function resolveProgramQueries(queries) {
	return queries.map(function(query) {
		var link = feedcfg.findLink(query);
		if (!link) {
			// :TODO: how is this handled?
			console.error('Query failed:', query);
			return null;
		}
		return link;
	});
}

function setActiveProgramLinks(links) {
	_active_program_links = links;
}

function runProgram(link) {
	// Prep output region
	_program_view_link = link;
	var $view = $('#program-view');
	$view.data('view', link.href);

	// Set active agent client and GET the view
	var req = web.GET(link.href)
		.link(_active_program_links)
		.always(renderViewRes.bind(null, $view));
}

function renderViewRes($view, res) {
	// generate html
	var view = res.body;
	view = (view && typeof view == 'object') ? JSON.stringify(view) : (''+view);

	// sanitize and render
	$view.html(sec.sanitizeHtml(view, '#'+$view.attr('id')));
	// :TODO: mark which link this came from

	// post-process
	$view.find('div[data-src]').each(function(i, el) {
		var $subview = $(el);
		$subview.addClass('view');
		var href = ''; // :TODO: pull from parent view
		var link = ($view.attr('id') == 'program-view') ? _program_view_link : _active_program_links[href];
		viewDispatch({ method: 'GET', url: el.dataset.src }, link, $subview);
	});
}

function renderProgramLoadErrors(ress) {
	// :TODO:
	console.error('One of the bitches failed');

			/*if (res instanceof web.IncomingResponse) {
				$views.html('<h4>Error: '+util.escapeHTML(res.status||0)+' '+util.escapeHTML(res.reason||'')+'</h4>');
			} else {
				$views.html('<h4>Error: '+res.toString()+'</h4>');
			}*/
	throw ress;
}

function extractProgramQueries() {
	var $input = $('#program-input');
	var program = $input.val();
	return program.split('\n') // expect each line to be a url
		.map(function(str) { return str.trim(); })
		.filter(function(str) { return !!str; });
}

function autoSizeProgramInput() {
	var $input = $('#program-input');
	$input.prop('rows', Math.max($input.val().split('\n').length, 2)); // lazy alg
}

function onProgramInputKeyup(e) {
	// Auto-run on ctrl+enter
	// :TODO:

	// Auto-expand
	autoSizeProgramInput();
}

function onRunProgramButtonClick() {
	render('program');
	return false;
}

function onViewRequest(e) {
	var $view = $(this);
	var href = $view.data('view');
	var link = ($view.attr('id') == 'program-view') ? _program_view_link : _active_program_links[href];
	viewDispatch(e.originalEvent.detail, link, $view);
	return false;
}

// Helper to send requests to a renderer or from its rendered views
// - req: obj, the request
// - rendererLink: obj, the link to the view origin
// - $view: jquery element, the view element
function viewDispatch(req, rendererLink, $view) {
	var reqUrld      = web.parseUri(req.url);
	var reqDomain    = reqUrld.protocol + '://' + reqUrld.authority;
	var rendererUrld   = web.parseUri(rendererLink.href);
	var rendererDomain = (rendererUrld.authority) ? (rendererUrld.protocol + '://' + rendererUrld.authority) : '';

	// audit request
	// :TODO: must be to renderer

	// prep request
	var body = req.body;
	delete req.body;
	req = new web.Request(req);
	req.link(_active_program_links);

	if (!req.headers.Accept) { req.Accept('text/html, */*'); }

	if (!web.isAbsUri(req.headers.url)) {
		req.headers.url = web.joinRelPath(rendererUrld, req.headers.url);
	}

	// dispatch
	req.bufferResponse();
	req.end(body).always(renderViewRes.bind(null, $view));
	return req;
}
},{"../mimetypes":12,"../security":14,"../util":15,"./cache":4,"./feedcfg":5}],7:[function(require,module,exports){
var globals = require('../globals');
var util = require('../util');
var gui = require('./gui');
var mediaLinks = web.queryLinks(document, 'stdrel.com/media');
var indexLinks = web.queryLinks(document, 'layer1.io/index');

// Environment Setup
// =================
web.logAllExceptions = true;
require('../auth').setup();
require('../http-headers').setup();
require('./feedcfg').setup(indexLinks);

require('./renderers'); // :DEBUG:
require('./feedcfg').addIndex({ href: '#', rel: 'layer1.io/index', title: 'Builtins' }).then(function() {
	gui.setup(mediaLinks);
}).fail(function() {
	console.error('Failed to setup builtins index');
});


web.bindRequestEvents(document);
$(document).on('request', function(e) {
	// dispatch and log
	var req = new web.Request(e.originalEvent.detail);
	if (!req.headers.Accept) { req.Accept('text/html, */*'); }
	req.end(e.originalEvent.detail.body);
	return false;
});

// :TEMP: links to #todo will just alert Todo on click
web.export(todo);
function todo() { alert('Todo'); }

// server starting-point
function auth(req, res, worker) {
	// check action id
	req.actid = extractActId(req);
	if (req.actid === false) {
		res.status(401, 'must reuse Authorization header in incoming request for all outgoing requests').end();
		return false;
	}
	// :TODO:
	req.act = null;// executor.get(worker ? worker.getUrl() : true, req.actid); // worker DNE, req came from page so allow
	if (!req.act) {
		res.status(403, 'invalid actid - expired or not assigned to this worker').end();
		return false;
	}
	return true;
}

// toplevel
function getSelf(res) { return res.links.get('self'); }
var indexLinks = [
	web.HEAD('/column-layouts.js#col3').always(getSelf),
	web.HEAD('/column-layouts.js#col2').always(getSelf),
	web.HEAD('/image-viewer.js#').always(getSelf),
	web.HEAD('/list-view.js#').always(getSelf),
	web.HEAD('/media-summaries.js#').always(getSelf),
	web.HEAD('/thumbnail-view.js#').always(getSelf)
];
web.export(main);
function main(req, res) {
	/*res.link(
		['href',    'id',      'rel',                          'title'],
		'#',        undefined, 'self service layer1.io/index', 'Host Page',
		'#target',  'target',  'service layer1.io/target',     'Target for Rendering',
		'#feed',    'feed',    'service layer1.io/feed',       'Current Feed',
		'#service', 'service', 'service layer1.io/service',    'Layer1 Toplevel Service'
	);
	res.link(
		['href',           'rel',                'title',       'for'],
		'#thing-renderer', 'layer1.io/renderer', 'Thing',       'schema.org/Thing',
		'#about-renderer', 'layer1.io/renderer', 'About',       'stdrel.com/media',
		'#test-render',    'layer1.io/renderer', 'Test2',       'stdrel.com/media',
		'#hn-renderer',    'layer1.io/renderer', 'HN Renderer', 'stdrel.com/media text/html news.ycombinator.com'
	);*/
	return indexLinks.always(function(links) {
		links = links.filter(function(link) { return !!link; });
		res.link(links.concat([
			{ href: 'http://i.imgur.com/kijXP0K.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 1' },
			{ href: 'http://i.imgur.com/6pETKay.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 2' },
			{ href: 'http://i.imgur.com/yurJqpe.jpg', rel: 'layer1.io/media', type: 'image/jpg', title: 'Image 3' },
		]));
	});
}

// public web servers
require('./publicweb.js');

// feed items
/*web.at('#feed/?(.*)', function (req, res, worker) {
	// :TODO:
	// if (!auth(req, res, worker)) return;
	var itemid = req.pathd[1];

	if (itemid) {
		if (!mediaLinks[itemid]) { return res.s404().end(); }
		var link = web.util.deepClone(mediaLinks[itemid]);
		res.link(
			['href', 'id',      'rel',                       'title'],
			'/',     undefined, 'service via',               'Host Page',
			'/feed', 'feed',    'up service layer1.io/feed', 'Current Feed'
		);
		serveItem(req, res, worker, link);
	}
	else {
		var links = web.util.deepClone(mediaLinks);
		res.link(
			['href', 'id',      'rel',                         'title'],
			'/',     undefined, 'up service via',              'Host Page',
			'/feed', 'feed',    'self service layer1.io/feed', 'Current Feed'
		);
		serveCollection(req, res, worker, links);
	}
});

// collection behavior
function serveCollection(req, res, worker, links) {
	var uris = {};

	// set headers
	res.link(links);

	// :TODO: check permissions

	// route method
	if (req.HEAD) return res.s204().end();
	if (req.GET)  return res.s204().end(); // :TODO:
	if (req.POST) {
		var post = globals.pageClient
			.POST(req.params)
			.ContentType(req.ContentType)
			.then(function(res2) {
				res.Location(res2.Location);
				res.s201('created').end();
			}, function(res2) { res2.pipe(res); });
		req.pipe(post);
		return;
	}

	res.Allow('HEAD, GET, POST');
	res.s405('bad method').end();
}

// item behavior
function serveItem(req, res, worker, link) {
	// update link references to point to this service
	var url = link.href;
	link.rel = 'self '+link.rel;

	// set headers
	res.link(link);

	// :TODO: check permissions

	// route method
	if (req.HEAD) return res.s204().end();
	if (req.GET) return GET(url, req.params).Accept(req.Accept).pipe(res);
	res.Allow('HEAD, GET');
	res.s405('bad method').end();
}

// helper
function extractActId(req) {
	var auth = req.Authorization;
	if (!auth) return false;

	var parts = auth.split(' ');
	if (parts[0] != 'Action' || !parts[1]) return false;

	return +parts[1] || false;
}*/
},{"../auth":3,"../globals":10,"../http-headers":11,"../util":15,"./feedcfg":5,"./gui":6,"./publicweb.js":8,"./renderers":9}],8:[function(require,module,exports){
var cache = require('./cache');
var gui = require('./gui');

web.export(pubweb_proxy);
pubweb_proxy.opts({
    stream: true,
    allmethods: true
});
function pubweb_proxy(req, res, worker) {
    // :TODO: perms

    // try the cache
    if (req.method == 'HEAD' || req.method == 'GET') {
        if (cache.respond(req.params.url, res, req.method == 'HEAD')) {
            return;
        }
    }

    // :TODO: targets-cache
    var req2 = web.dispatch({ method: req.method, url: req.params.url });
    for (var k in req) {
        if (web.isHeaderKey(k)) {
            req2.header(k, req[k]);
        }
    }
    req2.link(gui.getActiveProgramLinks());
    req.pipe(req2);
    req2.pipe(res);
}
},{"./cache":4,"./gui":6}],9:[function(require,module,exports){
var util = require('../util');
/*
// Thing renderer
local.at('#thing-renderer', function(req, res) {
	GET(req.params.target).always(function(targetRes) {
		res.s200().ContentType('html');
		var desc = [];
		var url = (targetRes.body.url) ? util.escapeHTML(targetRes.body.url) : '#';
		if (targetRes.body.description) { desc.push(util.escapeHTML(targetRes.body.description)); }
		if (targetRes.body.url) { desc.push('<a href="'+url+'">Link</a>'); }
		var html = [
			'<div class="media">',
				'<div class="media-body">',
					'<h4 class="media-heading">'+util.escapeHTML(targetRes.body.name)+'</h4>',
					((desc.length) ? '<p>'+desc.join('<br>')+'</p>' : ''),
				'</div>',
			'</div>'
		].join('');
		res.end(html);
	});
});

local.at('#test-render', function(req, res) {
	res.s200().ContentType('html');
	if (req.params.other) {
		res.end('<a href="#test-render">first</a>');
	} else {
		res.end('<a href="#test-render?other=1">second</a>');
	}
});

// Default renderer
local.at('#about-renderer', function(req, res) {
	HEAD(req.params.target)
		.always(function(targetRes) {
			var selfLink = targetRes.links.get('self');
			if (!selfLink) {
				return res.s502().ContentType('html').end('Bad target');
			}
			var isLocalhosted = (selfLink.href.indexOf(window.location.origin) === 0 || selfLink.href.indexOf('#/') === 0);

			res.s200().ContentType('html');
			var html = '';

			html += '<div class="btn-group">';
			if (!isLocalhosted) {
				html += '<a href="#" class="btn btn-xs btn-default">Save</a> ';
			}
			html += '<a href="#" class="btn btn-xs btn-default">Create Link</a> ';
			if (isLocalhosted) {
				html += '<a href="#" class="btn btn-xs btn-danger">Delete</a> ';
			}
			html += '</div>';

			var desc = [];
			if (selfLink.type) { desc.push(util.escapeHTML(selfLink.type)); }
			if (selfLink.created_at) { desc.push('created '+((new Date(+selfLink.created_at)).toLocaleString())); }
			html += '<p>' + desc.join(', ') + '</p>';

			res.end(html);
		});
});

// Test renderer
local.at('#test-renderer', function(req, res) {
	res.s200().ContentType('html').end('<strong>This renderer does fucking nothing, totally useless.</strong><br><img src=/img/Turkish_Van_Cat.jpg>');
});

// Hacker news renderer
local.at('#hn-renderer', function(req, res) {
	GET(req.params.target)
		.always(function (targetRes) {
			var selfLink = targetRes.links.get('self');
			if (!selfLink) return res.s502('could not load target').end();
			if (selfLink.href.indexOf('https://news.ycombinator.com') !== 0) {
				return res.s418('I only understand URLs from https://news.ycombinator.com').end();
			}

			if (targetRes.ContentType.indexOf('text/html') !== 0) {
				console.warn(targetRes);
				return res.s415('expected html, got '+targetRes.ContentType).end();
			}

			if (!targetRes.body) {
				return res.s422('no content in target').end();
			}

			var $html = $(targetRes.body);
			if (/^https\:\/\/news\.ycombinator\.com\/?$/.test(selfLink.href)) {
				var $top = $html.find('.title a').eq(0);
				return res.s200().html('<p>Top Story: <a target="_top" href="'+$top.attr('href')+'">'+$top.text()+'</a></p>').end();
			}
			var $title = $html.find('.title a').eq(0);
			var $comments = $html.find('table table table');
			var $commenters = $comments.find('a[href^=user]');
			var $commentersGrouped = {};
			$commenters.each(function(i, a) {
				var $a = $(a);
				if ($commentersGrouped[$a.attr('href')]) {
					$commentersGrouped[$a.attr('href')].count++;
				} else {
					$commentersGrouped[$a.attr('href')] = $a;
					$a.count = 1;
				}
			});

			res.s200().html('');

			res.write('<p>')
				.write('<a target="_top" href="'+$title.attr('href')+'">'+$title.text()+'</a><br>')
				.write('<small><a target="_top" href="'+selfLink.href+'">'+$comments.length+' comments</a></small>')
				.write('</p>');

			res.write('<ul>');
			for (var url in $commentersGrouped) {
				res.write('<li>');
				res.write('<a target="_top" href="https://news.ycombinator.com/' + $commentersGrouped[url].attr('href') + '">');
				res.write($commentersGrouped[url].text());
				res.write('</a>');
				res.write(' ('+$commentersGrouped[url].count+')');
				res.write('</li>');
			}
			res.write('</ul>');

			res.end();
		});
});*/
},{"../util":15}],10:[function(require,module,exports){
var hostClient = web.client(window.location.protocol + '//' + window.location.host);
window.globals = module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	pageClient:       web.client(window.location.toString()),
	hostClient:       hostClient,
	authClient:       hostClient.service('auth'),
	meClient:         hostClient.item('.me'),
	fetchProxyClient: hostClient.service('.fetch'),
};
},{}],11:[function(require,module,exports){
module.exports = { setup: setup };
function setup() {
	web.httpHeaders.register('pragma',
		function serialize_pragma(obj) {
			var str, strs = [];
			for (var k in obj) {
				str = k;
				if (obj[k] !== true) {
					str += '="'+obj[k]+'"';
				}
				strs.push(str);
			}
			return strs.join(' ');
		},
		function parse_pragma(str) {
			//             "key"     "="      \""val\""    "val"
			//         -------------- -       ---------   -------
			var re = /([\-a-z0-9_\.]+)=?(?:(?:"([^"]+)")|([^;\s]+))?/g;
			var match, obj = {};
			while ((match = re.exec(str))) {
				obj[match[1]] = match[2] || match[3];
			}
			return obj;
		}
	);
}
},{}],12:[function(require,module,exports){
//
// mimetype.js - A catalog object of mime types based on file extensions
//
// @author: R. S. Doiel, <rsdoiel@gmail.com>
// copyright (c) 2012 all rights reserved
//
// Released under New the BSD License.
// See: http://opensource.org/licenses/bsd-license.php
//

(function (self) {
	var path;

	// If we're NodeJS I can use the path module.
	// If I'm MongoDB shell, not available.
	if (require !== undefined) {
		path = require('path');
	} else {
		path = {
			extname: function (filename) {
				var start = filename.lastIndexOf(".");
				if (start > 0) {
					var end = filename.indexOf('?');
					if (end == -1) end = filename.indexOf('#');
					if (end == -1) end = undefined;
					return filename.slice(start, end);
				}
			}
		};
	}

	if (exports === undefined) {
		exports = {};
	}

	MimeType = {
		charset: 'UTF-8',
		catalog: {},
		lookup: function (fname, include_charset, default_mime_type) {
			var ext, charset = this.charset;

			if (include_charset === undefined) {
				include_charset = false;
			}

			if (typeof include_charset === "string") {
				charset = include_charset;
				include_charset = true;
			}

			if (path.extname !== undefined) {
				ext = path.extname(fname).toLowerCase();
			} else if (fname.lastIndexOf('.') > 0) {
				ext = fname.substr(fname.lastIndexOf('.')).toLowerCase();
			} else {
				ext = fname;
			}

			// Handle the special cases where their is no extension
			// e..g README, manifest, LICENSE, TODO
			if (ext == "") {
				ext = fname;
			}

			if (this.catalog[ext] !== undefined) {
				if (include_charset === true &&
					this.catalog[ext].indexOf('text/') === 0 &&
					this.catalog[ext].indexOf('charset') < 0) {
					return this.catalog[ext] + '; charset=' + charset;
				} else {
					return this.catalog[ext];
				}
			} else if (default_mime_type !== undefined) {
				if (include_charset === true &&
					default_mime_type.indexOf('text/') === 0) {
					return default_mime_type + '; charset=' + charset;
				}
				return default_mime_type;
			}
			return false;
		},
		set: function (exts, mime_type_string) {
			var result = true, self = this;
			if (exts.indexOf(',')) {
				exts.split(',').forEach(function (ext) {
					ext = ext.trim();
					self.catalog[ext] = mime_type_string;
					if (self.catalog[ext] !== mime_type_string) {
						result = false;
					}
				});
			} else {
				result = (self.catalog[exts] === mime_type_string);
			}
			return result;
		},
		del: function (ext) {
			delete this.catalog[ext];
			return (this.catalog[ext] === undefined);
		},
		forEach: function (callback) {
			var self = this, ext;
			// Mongo 2.2. Shell doesn't support Object.keys()
			for (ext in self.catalog) {
				if (self.catalog.hasOwnProperty(ext)) {
					callback(ext, self.catalog[ext]);
				}
			}
			return self.catalog;
		}
	};

	// From Apache project's mime type list.
	MimeType.set(".ez", "application/andrew-inset");
	MimeType.set(".aw", "application/applixware");
	MimeType.set(".atom", "application/atom+xml");
	MimeType.set(".atomcat", "application/atomcat+xml");
	MimeType.set(".atomsvc", "application/atomsvc+xml");
	MimeType.set(".ccxml", "application/ccxml+xml");
	MimeType.set(".cu", "application/cu-seeme");
	MimeType.set(".davmount", "application/davmount+xml");
	MimeType.set(".ecma", "application/ecmascript");
	MimeType.set(".emma", "application/emma+xml");
	MimeType.set(".epub", "application/epub+zip");
	MimeType.set(".pfr", "application/font-tdpfr");
	MimeType.set(".stk", "application/hyperstudio");
	MimeType.set(".jar", "application/java-archive");
	MimeType.set(".ser", "application/java-serialized-object");
	MimeType.set(".class", "application/java-vm");
	MimeType.set(".js", "application/javascript");
	MimeType.set(".json", "application/json");
	MimeType.set(".lostxml", "application/lost+xml");
	MimeType.set(".hqx", "application/mac-binhex40");
	MimeType.set(".cpt", "application/mac-compactpro");
	MimeType.set(".mrc", "application/marc");
	MimeType.set(".ma,.nb,.mb", "application/mathematica");
	MimeType.set(".mathml", "application/mathml+xml");
	MimeType.set(".mbox", "application/mbox");
	MimeType.set(".mscml", "application/mediaservercontrol+xml");
	MimeType.set(".mp4s", "application/mp4");
	MimeType.set(".doc,.dot", "application/msword");
	MimeType.set(".mxf", "application/mxf");
	MimeType.set(".oda", "application/oda");
	MimeType.set(".opf", "application/oebps-package+xml");
	MimeType.set(".ogx", "application/ogg");
	MimeType.set(".onetoc,.onetoc2,.onetmp,.onepkg", "application/onenote");
	MimeType.set(".xer", "application/patch-ops-error+xml");
	MimeType.set(".pdf", "application/pdf");
	MimeType.set(".pgp", "application/pgp-encrypted");
	MimeType.set(".asc,.sig", "application/pgp-signature");
	MimeType.set(".prf", "application/pics-rules");
	MimeType.set(".p10", "application/pkcs10");
	MimeType.set(".p7m,.p7c", "application/pkcs7-mime");
	MimeType.set(".p7s", "application/pkcs7-signature");
	MimeType.set(".cer", "application/pkix-cert");
	MimeType.set(".crl", "application/pkix-crl");
	MimeType.set(".pkipath", "application/pkix-pkipath");
	MimeType.set(".pki", "application/pkixcmp");
	MimeType.set(".pls", "application/pls+xml");
	MimeType.set(".ai,.eps,.ps", "application/postscript");
	MimeType.set(".cww", "application/prs.cww");
	MimeType.set(".rdf", "application/rdf+xml");
	MimeType.set(".rif", "application/reginfo+xml");
	MimeType.set(".rnc", "application/relax-ng-compact-syntax");
	MimeType.set(".rl", "application/resource-lists+xml");
	MimeType.set(".rld", "application/resource-lists-diff+xml");
	MimeType.set(".rs", "application/rls-services+xml");
	MimeType.set(".rsd", "application/rsd+xml");
	MimeType.set(".rss", "application/rss+xml");
	MimeType.set(".rtf", "application/rtf");
	MimeType.set(".sbml", "application/sbml+xml");
	MimeType.set(".scq", "application/scvp-cv-request");
	MimeType.set(".scs", "application/scvp-cv-response");
	MimeType.set(".spq", "application/scvp-vp-request");
	MimeType.set(".spp", "application/scvp-vp-response");
	MimeType.set(".sdp", "application/sdp");
	MimeType.set(".setpay", "application/set-payment-initiation");
	MimeType.set(".setreg", "application/set-registration-initiation");
	MimeType.set(".shf", "application/shf+xml");
	MimeType.set(".smi,.smil", "application/smil+xml");
	MimeType.set(".rq", "application/sparql-query");
	MimeType.set(".srx", "application/sparql-results+xml");
	MimeType.set(".gram", "application/srgs");
	MimeType.set(".grxml", "application/srgs+xml");
	MimeType.set(".ssml", "application/ssml+xml");
	MimeType.set(".plb", "application/vnd.3gpp.pic-bw-large");
	MimeType.set(".psb", "application/vnd.3gpp.pic-bw-small");
	MimeType.set(".pvb", "application/vnd.3gpp.pic-bw-var");
	MimeType.set(".tcap", "application/vnd.3gpp2.tcap");
	MimeType.set(".pwn", "application/vnd.3m.post-it-notes");
	MimeType.set(".aso", "application/vnd.accpac.simply.aso");
	MimeType.set(".imp", "application/vnd.accpac.simply.imp");
	MimeType.set(".acu", "application/vnd.acucobol");
	MimeType.set(".atc,.acutc", "application/vnd.acucorp");
	MimeType.set(".air", "application/vnd.adobe.air-application-installer-package+zip");
	MimeType.set(".xdp", "application/vnd.adobe.xdp+xml");
	MimeType.set(".xfdf", "application/vnd.adobe.xfdf");
	MimeType.set(".azf", "application/vnd.airzip.filesecure.azf");
	MimeType.set(".azs", "application/vnd.airzip.filesecure.azs");
	MimeType.set(".azw", "application/vnd.amazon.ebook");
	MimeType.set(".acc", "application/vnd.americandynamics.acc");
	MimeType.set(".ami", "application/vnd.amiga.ami");
	MimeType.set(".apk", "application/vnd.android.package-archive");
	MimeType.set(".cii", "application/vnd.anser-web-certificate-issue-initiation");
	MimeType.set(".fti", "application/vnd.anser-web-funds-transfer-initiation");
	MimeType.set(".atx", "application/vnd.antix.game-component");
	MimeType.set(".mpkg", "application/vnd.apple.installer+xml");
	MimeType.set(".swi", "application/vnd.arastra.swi");
	MimeType.set(".aep", "application/vnd.audiograph");
	MimeType.set(".mpm", "application/vnd.blueice.multipass");
	MimeType.set(".bmi", "application/vnd.bmi");
	MimeType.set(".rep", "application/vnd.businessobjects");
	MimeType.set(".cdxml", "application/vnd.chemdraw+xml");
	MimeType.set(".mmd", "application/vnd.chipnuts.karaoke-mmd");
	MimeType.set(".cdy", "application/vnd.cinderella");
	MimeType.set(".cla", "application/vnd.claymore");
	MimeType.set(".c4g,.c4d,.c4f,.c4p,.c4u", "application/vnd.clonk.c4group");
	MimeType.set(".csp", "application/vnd.commonspace");
	MimeType.set(".cdbcmsg", "application/vnd.contact.cmsg");
	MimeType.set(".cmc", "application/vnd.cosmocaller");
	MimeType.set(".clkx", "application/vnd.crick.clicker");
	MimeType.set(".clkk", "application/vnd.crick.clicker.keyboard");
	MimeType.set(".clkp", "application/vnd.crick.clicker.palette");
	MimeType.set(".clkt", "application/vnd.crick.clicker.template");
	MimeType.set(".clkw", "application/vnd.crick.clicker.wordbank");
	MimeType.set(".wbs", "application/vnd.criticaltools.wbs+xml");
	MimeType.set(".pml", "application/vnd.ctc-posml");
	MimeType.set(".ppd", "application/vnd.cups-ppd");
	MimeType.set(".car", "application/vnd.curl.car");
	MimeType.set(".pcurl", "application/vnd.curl.pcurl");
	MimeType.set(".rdz", "application/vnd.data-vision.rdz");
	MimeType.set(".fe_launch", "application/vnd.denovo.fcselayout-link");
	MimeType.set(".dna", "application/vnd.dna");
	MimeType.set(".mlp", "application/vnd.dolby.mlp");
	MimeType.set(".dpg", "application/vnd.dpgraph");
	MimeType.set(".dfac", "application/vnd.dreamfactory");
	MimeType.set(".geo", "application/vnd.dynageo");
	MimeType.set(".mag", "application/vnd.ecowin.chart");
	MimeType.set(".nml", "application/vnd.enliven");
	MimeType.set(".esf", "application/vnd.epson.esf");
	MimeType.set(".msf", "application/vnd.epson.msf");
	MimeType.set(".qam", "application/vnd.epson.quickanime");
	MimeType.set(".slt", "application/vnd.epson.salt");
	MimeType.set(".ssf", "application/vnd.epson.ssf");
	MimeType.set(".es3,.et3", "application/vnd.eszigno3+xml");
	MimeType.set(".ez2", "application/vnd.ezpix-album");
	MimeType.set(".ez3", "application/vnd.ezpix-package");
	MimeType.set(".fdf", "application/vnd.fdf");
	MimeType.set(".mseed", "application/vnd.fdsn.mseed");
	MimeType.set(".seed,.dataless", "application/vnd.fdsn.seed");
	MimeType.set(".gph", "application/vnd.flographit");
	MimeType.set(".ftc", "application/vnd.fluxtime.clip");
	MimeType.set(".fm,.frame,.maker,.book", "application/vnd.framemaker");
	MimeType.set(".fnc", "application/vnd.frogans.fnc");
	MimeType.set(".ltf", "application/vnd.frogans.ltf");
	MimeType.set(".fsc", "application/vnd.fsc.weblaunch");
	MimeType.set(".oas", "application/vnd.fujitsu.oasys");
	MimeType.set(".oa2", "application/vnd.fujitsu.oasys2");
	MimeType.set(".oa3", "application/vnd.fujitsu.oasys3");
	MimeType.set(".fg5", "application/vnd.fujitsu.oasysgp");
	MimeType.set(".bh2", "application/vnd.fujitsu.oasysprs");
	MimeType.set(".ddd", "application/vnd.fujixerox.ddd");
	MimeType.set(".xdw", "application/vnd.fujixerox.docuworks");
	MimeType.set(".xbd", "application/vnd.fujixerox.docuworks.binder");
	MimeType.set(".fzs", "application/vnd.fuzzysheet");
	MimeType.set(".txd", "application/vnd.genomatix.tuxedo");
	MimeType.set(".ggb", "application/vnd.geogebra.file");
	MimeType.set(".ggt", "application/vnd.geogebra.tool");
	MimeType.set(".gex,.gre", "application/vnd.geometry-explorer");
	MimeType.set(".gmx", "application/vnd.gmx");
	MimeType.set(".kml", "application/vnd.google-earth.kml+xml");
	MimeType.set(".kmz", "application/vnd.google-earth.kmz");
	MimeType.set(".gqf,.gqs", "application/vnd.grafeq");
	MimeType.set(".gac", "application/vnd.groove-account");
	MimeType.set(".ghf", "application/vnd.groove-help");
	MimeType.set(".gim", "application/vnd.groove-identity-message");
	MimeType.set(".grv", "application/vnd.groove-injector");
	MimeType.set(".gtm", "application/vnd.groove-tool-message");
	MimeType.set(".tpl", "application/vnd.groove-tool-template");
	MimeType.set(".vcg", "application/vnd.groove-vcard");
	MimeType.set(".zmm", "application/vnd.handheld-entertainment+xml");
	MimeType.set(".hbci", "application/vnd.hbci");
	MimeType.set(".les", "application/vnd.hhe.lesson-player");
	MimeType.set(".hpgl", "application/vnd.hp-hpgl");
	MimeType.set(".hpid", "application/vnd.hp-hpid");
	MimeType.set(".hps", "application/vnd.hp-hps");
	MimeType.set(".jlt", "application/vnd.hp-jlyt");
	MimeType.set(".pcl", "application/vnd.hp-pcl");
	MimeType.set(".pclxl", "application/vnd.hp-pclxl");
	MimeType.set(".sfd-hdstx", "application/vnd.hydrostatix.sof-data");
	MimeType.set(".x3d", "application/vnd.hzn-3d-crossword");
	MimeType.set(".mpy", "application/vnd.ibm.minipay");
	MimeType.set(".afp,.listafp,.list3820", "application/vnd.ibm.modcap");
	MimeType.set(".irm", "application/vnd.ibm.rights-management");
	MimeType.set(".sc", "application/vnd.ibm.secure-container");
	MimeType.set(".icc,.icm", "application/vnd.iccprofile");
	MimeType.set(".igl", "application/vnd.igloader");
	MimeType.set(".ivp", "application/vnd.immervision-ivp");
	MimeType.set(".ivu", "application/vnd.immervision-ivu");
	MimeType.set(".xpw,.xpx", "application/vnd.intercon.formnet");
	MimeType.set(".qbo", "application/vnd.intu.qbo");
	MimeType.set(".qfx", "application/vnd.intu.qfx");
	MimeType.set(".rcprofile", "application/vnd.ipunplugged.rcprofile");
	MimeType.set(".irp", "application/vnd.irepository.package+xml");
	MimeType.set(".xpr", "application/vnd.is-xpr");
	MimeType.set(".jam", "application/vnd.jam");
	MimeType.set(".rms", "application/vnd.jcp.javame.midlet-rms");
	MimeType.set(".jisp", "application/vnd.jisp");
	MimeType.set(".joda", "application/vnd.joost.joda-archive");
	MimeType.set(".ktz,.ktr", "application/vnd.kahootz");
	MimeType.set(".karbon", "application/vnd.kde.karbon");
	MimeType.set(".chrt", "application/vnd.kde.kchart");
	MimeType.set(".kfo", "application/vnd.kde.kformula");
	MimeType.set(".flw", "application/vnd.kde.kivio");
	MimeType.set(".kon", "application/vnd.kde.kontour");
	MimeType.set(".kpr,.kpt", "application/vnd.kde.kpresenter");
	MimeType.set(".ksp", "application/vnd.kde.kspread");
	MimeType.set(".kwd,.kwt", "application/vnd.kde.kword");
	MimeType.set(".htke", "application/vnd.kenameaapp");
	MimeType.set(".kia", "application/vnd.kidspiration");
	MimeType.set(".kne,.knp", "application/vnd.kinar");
	MimeType.set(".skp,.skd,.skt,.skm", "application/vnd.koan");
	MimeType.set(".sse", "application/vnd.kodak-descriptor");
	MimeType.set(".lbd", "application/vnd.llamagraphics.life-balance.desktop");
	MimeType.set(".lbe", "application/vnd.llamagraphics.life-balance.exchange+xml");
	MimeType.set(".123", "application/vnd.lotus-1-2-3");
	MimeType.set(".apr", "application/vnd.lotus-approach");
	MimeType.set(".pre", "application/vnd.lotus-freelance");
	MimeType.set(".nsf", "application/vnd.lotus-notes");
	MimeType.set(".org", "application/vnd.lotus-organizer");
	MimeType.set(".scm", "application/vnd.lotus-screencam");
	MimeType.set(".lwp", "application/vnd.lotus-wordpro");
	MimeType.set(".portpkg", "application/vnd.macports.portpkg");
	MimeType.set(".mcd", "application/vnd.mcd");
	MimeType.set(".mc1", "application/vnd.medcalcdata");
	MimeType.set(".cdkey", "application/vnd.mediastation.cdkey");
	MimeType.set(".mwf", "application/vnd.mfer");
	MimeType.set(".mfm", "application/vnd.mfmp");
	MimeType.set(".flo", "application/vnd.micrografx.flo");
	MimeType.set(".igx", "application/vnd.micrografx.igx");
	MimeType.set(".mif", "application/vnd.mif");
	MimeType.set(".daf", "application/vnd.mobius.daf");
	MimeType.set(".dis", "application/vnd.mobius.dis");
	MimeType.set(".mbk", "application/vnd.mobius.mbk");
	MimeType.set(".mqy", "application/vnd.mobius.mqy");
	MimeType.set(".msl", "application/vnd.mobius.msl");
	MimeType.set(".plc", "application/vnd.mobius.plc");
	MimeType.set(".txf", "application/vnd.mobius.txf");
	MimeType.set(".mpn", "application/vnd.mophun.application");
	MimeType.set(".mpc", "application/vnd.mophun.certificate");
	MimeType.set(".xul", "application/vnd.mozilla.xul+xml");
	MimeType.set(".cil", "application/vnd.ms-artgalry");
	MimeType.set(".cab", "application/vnd.ms-cab-compressed");
	MimeType.set(".xls,.xlm,.xla,.xlc,.xlt,.xlw", "application/vnd.ms-excel");
	MimeType.set(".xlam", "application/vnd.ms-excel.addin.macroenabled.12");
	MimeType.set(".xlsb", "application/vnd.ms-excel.sheet.binary.macroenabled.12");
	MimeType.set(".xlsm", "application/vnd.ms-excel.sheet.macroenabled.12");
	MimeType.set(".xltm", "application/vnd.ms-excel.template.macroenabled.12");
	MimeType.set(".eot", "application/vnd.ms-fontobject");
	MimeType.set(".chm", "application/vnd.ms-htmlhelp");
	MimeType.set(".ims", "application/vnd.ms-ims");
	MimeType.set(".lrm", "application/vnd.ms-lrm");
	MimeType.set(".cat", "application/vnd.ms-pki.seccat");
	MimeType.set(".stl", "application/vnd.ms-pki.stl");
	MimeType.set(".ppt,.pps,.pot", "application/vnd.ms-powerpoint");
	MimeType.set(".ppam", "application/vnd.ms-powerpoint.addin.macroenabled.12");
	MimeType.set(".pptm", "application/vnd.ms-powerpoint.presentation.macroenabled.12");
	MimeType.set(".sldm", "application/vnd.ms-powerpoint.slide.macroenabled.12");
	MimeType.set(".ppsm", "application/vnd.ms-powerpoint.slideshow.macroenabled.12");
	MimeType.set(".potm", "application/vnd.ms-powerpoint.template.macroenabled.12");
	MimeType.set(".mpp,.mpt", "application/vnd.ms-project");
	MimeType.set(".docm", "application/vnd.ms-word.document.macroenabled.12");
	MimeType.set(".dotm", "application/vnd.ms-word.template.macroenabled.12");
	MimeType.set(".wps,.wks,.wcm,.wdb", "application/vnd.ms-works");
	MimeType.set(".wpl", "application/vnd.ms-wpl");
	MimeType.set(".xps", "application/vnd.ms-xpsdocument");
	MimeType.set(".mseq", "application/vnd.mseq");
	MimeType.set(".mus", "application/vnd.musician");
	MimeType.set(".msty", "application/vnd.muvee.style");
	MimeType.set(".nlu", "application/vnd.neurolanguage.nlu");
	MimeType.set(".nnd", "application/vnd.noblenet-directory");
	MimeType.set(".nns", "application/vnd.noblenet-sealer");
	MimeType.set(".nnw", "application/vnd.noblenet-web");
	MimeType.set(".ngdat", "application/vnd.nokia.n-gage.data");
	MimeType.set(".n-gage", "application/vnd.nokia.n-gage.symbian.install");
	MimeType.set(".rpst", "application/vnd.nokia.radio-preset");
	MimeType.set(".rpss", "application/vnd.nokia.radio-presets");
	MimeType.set(".edm", "application/vnd.novadigm.edm");
	MimeType.set(".edx", "application/vnd.novadigm.edx");
	MimeType.set(".ext", "application/vnd.novadigm.ext");
	MimeType.set(".odc", "application/vnd.oasis.opendocument.chart");
	MimeType.set(".otc", "application/vnd.oasis.opendocument.chart-template");
	MimeType.set(".odb", "application/vnd.oasis.opendocument.database");
	MimeType.set(".odf", "application/vnd.oasis.opendocument.formula");
	MimeType.set(".odft", "application/vnd.oasis.opendocument.formula-template");
	MimeType.set(".odg", "application/vnd.oasis.opendocument.graphics");
	MimeType.set(".otg", "application/vnd.oasis.opendocument.graphics-template");
	MimeType.set(".odi", "application/vnd.oasis.opendocument.image");
	MimeType.set(".oti", "application/vnd.oasis.opendocument.image-template");
	MimeType.set(".odp", "application/vnd.oasis.opendocument.presentation");
	MimeType.set(".ods", "application/vnd.oasis.opendocument.spreadsheet");
	MimeType.set(".ots", "application/vnd.oasis.opendocument.spreadsheet-template");
	MimeType.set(".odt", "application/vnd.oasis.opendocument.text");
	MimeType.set(".otm", "application/vnd.oasis.opendocument.text-master");
	MimeType.set(".ott", "application/vnd.oasis.opendocument.text-template");
	MimeType.set(".oth", "application/vnd.oasis.opendocument.text-web");
	MimeType.set(".xo", "application/vnd.olpc-sugar");
	MimeType.set(".dd2", "application/vnd.oma.dd2+xml");
	MimeType.set(".oxt", "application/vnd.openofficeorg.extension");
	MimeType.set(".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
	MimeType.set(".sldx", "application/vnd.openxmlformats-officedocument.presentationml.slide");
	MimeType.set(".ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow");
	MimeType.set(".potx", "application/vnd.openxmlformats-officedocument.presentationml.template");
	MimeType.set(".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
	MimeType.set(".xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template");
	MimeType.set(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
	MimeType.set(".dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template");
	MimeType.set(".dp", "application/vnd.osgi.dp");
	MimeType.set(".pdb,.pqa,.oprc", "application/vnd.palm");
	MimeType.set(".str", "application/vnd.pg.format");
	MimeType.set(".ei6", "application/vnd.pg.osasli");
	MimeType.set(".efif", "application/vnd.picsel");
	MimeType.set(".plf", "application/vnd.pocketlearn");
	MimeType.set(".pbd", "application/vnd.powerbuilder6");
	MimeType.set(".box", "application/vnd.previewsystems.box");
	MimeType.set(".mgz", "application/vnd.proteus.magazine");
	MimeType.set(".qps", "application/vnd.publishare-delta-tree");
	MimeType.set(".ptid", "application/vnd.pvi.ptid1");
	MimeType.set(".qxd,.qxt,.qwd,.qwt,.qxl,.qxb", "application/vnd.quark.quarkxpress");
	MimeType.set(".mxl", "application/vnd.recordare.musicxml");
	MimeType.set(".musicxml", "application/vnd.recordare.musicxml+xml");
	MimeType.set(".cod", "application/vnd.rim.cod");
	MimeType.set(".rm", "application/vnd.rn-realmedia");
	MimeType.set(".link66", "application/vnd.route66.link66+xml");
	MimeType.set(".see", "application/vnd.seemail");
	MimeType.set(".sema", "application/vnd.sema");
	MimeType.set(".semd", "application/vnd.semd");
	MimeType.set(".semf", "application/vnd.semf");
	MimeType.set(".ifm", "application/vnd.shana.informed.formdata");
	MimeType.set(".itp", "application/vnd.shana.informed.formtemplate");
	MimeType.set(".iif", "application/vnd.shana.informed.interchange");
	MimeType.set(".ipk", "application/vnd.shana.informed.package");
	MimeType.set(".twd,.twds", "application/vnd.simtech-mindmapper");
	MimeType.set(".mmf", "application/vnd.smaf");
	MimeType.set(".teacher", "application/vnd.smart.teacher");
	MimeType.set(".sdkm,.sdkd", "application/vnd.solent.sdkm+xml");
	MimeType.set(".dxp", "application/vnd.spotfire.dxp");
	MimeType.set(".sfs", "application/vnd.spotfire.sfs");
	MimeType.set(".sdc", "application/vnd.stardivision.calc");
	MimeType.set(".sda", "application/vnd.stardivision.draw");
	MimeType.set(".sdd", "application/vnd.stardivision.impress");
	MimeType.set(".smf", "application/vnd.stardivision.math");
	MimeType.set(".sdw", "application/vnd.stardivision.writer");
	MimeType.set(".vor", "application/vnd.stardivision.writer");
	MimeType.set(".sgl", "application/vnd.stardivision.writer-global");
	MimeType.set(".sxc", "application/vnd.sun.xml.calc");
	MimeType.set(".stc", "application/vnd.sun.xml.calc.template");
	MimeType.set(".sxd", "application/vnd.sun.xml.draw");
	MimeType.set(".std", "application/vnd.sun.xml.draw.template");
	MimeType.set(".sxi", "application/vnd.sun.xml.impress");
	MimeType.set(".sti", "application/vnd.sun.xml.impress.template");
	MimeType.set(".sxm", "application/vnd.sun.xml.math");
	MimeType.set(".sxw", "application/vnd.sun.xml.writer");
	MimeType.set(".sxg", "application/vnd.sun.xml.writer.global");
	MimeType.set(".stw", "application/vnd.sun.xml.writer.template");
	MimeType.set(".sus,.susp", "application/vnd.sus-calendar");
	MimeType.set(".svd", "application/vnd.svd");
	MimeType.set(".sis,.sisx", "application/vnd.symbian.install");
	MimeType.set(".xsm", "application/vnd.syncml+xml");
	MimeType.set(".bdm", "application/vnd.syncml.dm+wbxml");
	MimeType.set(".xdm", "application/vnd.syncml.dm+xml");
	MimeType.set(".tao", "application/vnd.tao.intent-module-archive");
	MimeType.set(".tmo", "application/vnd.tmobile-livetv");
	MimeType.set(".tpt", "application/vnd.trid.tpt");
	MimeType.set(".mxs", "application/vnd.triscape.mxs");
	MimeType.set(".tra", "application/vnd.trueapp");
	MimeType.set(".ufd,.ufdl", "application/vnd.ufdl");
	MimeType.set(".utz", "application/vnd.uiq.theme");
	MimeType.set(".umj", "application/vnd.umajin");
	MimeType.set(".unityweb", "application/vnd.unity");
	MimeType.set(".uoml", "application/vnd.uoml+xml");
	MimeType.set(".vcx", "application/vnd.vcx");
	MimeType.set(".vsd,.vst,.vss,.vsw", "application/vnd.visio");
	MimeType.set(".vis", "application/vnd.visionary");
	MimeType.set(".vsf", "application/vnd.vsf");
	MimeType.set(".wbxml", "application/vnd.wap.wbxml");
	MimeType.set(".wmlc", "application/vnd.wap.wmlc");
	MimeType.set(".wmlsc", "application/vnd.wap.wmlscriptc");
	MimeType.set(".wtb", "application/vnd.webturbo");
	MimeType.set(".wpd", "application/vnd.wordperfect");
	MimeType.set(".wqd", "application/vnd.wqd");
	MimeType.set(".stf", "application/vnd.wt.stf");
	MimeType.set(".xar", "application/vnd.xara");
	MimeType.set(".xfdl", "application/vnd.xfdl");
	MimeType.set(".hvd", "application/vnd.yamaha.hv-dic");
	MimeType.set(".hvs", "application/vnd.yamaha.hv-script");
	MimeType.set(".hvp", "application/vnd.yamaha.hv-voice");
	MimeType.set(".osf", "application/vnd.yamaha.openscoreformat");
	MimeType.set(".osfpvg", "application/vnd.yamaha.openscoreformat.osfpvg+xml");
	MimeType.set(".saf", "application/vnd.yamaha.smaf-audio");
	MimeType.set(".spf", "application/vnd.yamaha.smaf-phrase");
	MimeType.set(".cmp", "application/vnd.yellowriver-custom-menu");
	MimeType.set(".zir,.zirz", "application/vnd.zul");
	MimeType.set(".zaz", "application/vnd.zzazz.deck+xml");
	MimeType.set(".vxml", "application/voicexml+xml");
	MimeType.set(".hlp", "application/winhlp");
	MimeType.set(".wsdl", "application/wsdl+xml");
	MimeType.set(".wspolicy", "application/wspolicy+xml");
	MimeType.set(".abw", "application/x-abiword");
	MimeType.set(".ace", "application/x-ace-compressed");
	MimeType.set(".aab,.x32,.u32,.vox", "application/x-authorware-bin");
	MimeType.set(".aam", "application/x-authorware-map");
	MimeType.set(".aas", "application/x-authorware-seg");
	MimeType.set(".bcpio", "application/x-bcpio");
	MimeType.set(".torrent", "application/x-bittorrent");
	MimeType.set(".bz", "application/x-bzip");
	MimeType.set(".bz2,.boz", "application/x-bzip2");
	MimeType.set(".vcd", "application/x-cdlink");
	MimeType.set(".chat", "application/x-chat");
	MimeType.set(".pgn", "application/x-chess-pgn");
	MimeType.set(".cpio", "application/x-cpio");
	MimeType.set(".csh", "application/x-csh");
	MimeType.set(".deb,.udeb", "application/x-debian-package");
	MimeType.set(".dir,.dcr,.dxr,.cst,.cct,.cxt,.w3d,.fgd,.swa", "application/x-director");
	MimeType.set(".wad", "application/x-doom");
	MimeType.set(".ncx", "application/x-dtbncx+xml");
	MimeType.set(".dtb", "application/x-dtbook+xml");
	MimeType.set(".res", "application/x-dtbresource+xml");
	MimeType.set(".dvi", "application/x-dvi");
	MimeType.set(".bdf", "application/x-font-bdf");
	MimeType.set(".gsf", "application/x-font-ghostscript");
	MimeType.set(".psf", "application/x-font-linux-psf");
	MimeType.set(".otf", "application/x-font-otf");
	MimeType.set(".pcf", "application/x-font-pcf");
	MimeType.set(".snf", "application/x-font-snf");
	MimeType.set(".ttf,.ttc", "application/x-font-ttf");
	MimeType.set(".pfa,.pfb,.pfm,.afm", "application/x-font-type1");
	MimeType.set(".spl", "application/x-futuresplash");
	MimeType.set(".gnumeric", "application/x-gnumeric");
	MimeType.set(".gtar", "application/x-gtar");
	MimeType.set(".hdf", "application/x-hdf");
	MimeType.set(".jnlp", "application/x-java-jnlp-file");
	MimeType.set(".latex", "application/x-latex");
	MimeType.set(".prc,.mobi", "application/x-mobipocket-ebook");
	MimeType.set(".application", "application/x-ms-application");
	MimeType.set(".wmd", "application/x-ms-wmd");
	MimeType.set(".wmz", "application/x-ms-wmz");
	MimeType.set(".xbap", "application/x-ms-xbap");
	MimeType.set(".mdb", "application/x-msaccess");
	MimeType.set(".obd", "application/x-msbinder");
	MimeType.set(".crd", "application/x-mscardfile");
	MimeType.set(".clp", "application/x-msclip");
	MimeType.set(".exe,.dll,.com,.bat,.msi", "application/x-msdownload");
	MimeType.set(".mvb,.m13,.m14", "application/x-msmediaview");
	MimeType.set(".wmf", "application/x-msmetafile");
	MimeType.set(".mny", "application/x-msmoney");
	MimeType.set(".pub", "application/x-mspublisher");
	MimeType.set(".scd", "application/x-msschedule");
	MimeType.set(".trm", "application/x-msterminal");
	MimeType.set(".wri", "application/x-mswrite");
	MimeType.set(".nc,.cdf", "application/x-netcdf");
	MimeType.set(".p12,.pfx", "application/x-pkcs12");
	MimeType.set(".p7b,.spc", "application/x-pkcs7-certificates");
	MimeType.set(".p7r", "application/x-pkcs7-certreqresp");
	MimeType.set(".rar", "application/x-rar-compressed");
	MimeType.set(".sh", "application/x-sh");
	MimeType.set(".shar", "application/x-shar");
	MimeType.set(".swf", "application/x-shockwave-flash");
	MimeType.set(".xap", "application/x-silverlight-app");
	MimeType.set(".sit", "application/x-stuffit");
	MimeType.set(".sitx", "application/x-stuffitx");
	MimeType.set(".sv4cpio", "application/x-sv4cpio");
	MimeType.set(".sv4crc", "application/x-sv4crc");
	MimeType.set(".tar", "application/x-tar");
	MimeType.set(".tcl", "application/x-tcl");
	MimeType.set(".tex", "application/x-tex");
	MimeType.set(".tfm", "application/x-tex-tfm");
	MimeType.set(".texinfo,.texi", "application/x-texinfo");
	MimeType.set(".ustar", "application/x-ustar");
	MimeType.set(".src", "application/x-wais-source");
	MimeType.set(".der,.crt", "application/x-x509-ca-cert");
	MimeType.set(".fig", "application/x-xfig");
	MimeType.set(".xpi", "application/x-xpinstall");
	MimeType.set(".xenc", "application/xenc+xml");
	MimeType.set(".xhtml,.xht", "application/xhtml+xml");
	MimeType.set(".xml,.xsl", "application/xml");
	MimeType.set(".dtd", "application/xml-dtd");
	MimeType.set(".xop", "application/xop+xml");
	MimeType.set(".xslt", "application/xslt+xml");
	MimeType.set(".xspf", "application/xspf+xml");
	MimeType.set(".mxml,.xhvml,.xvml,.xvm", "application/xv+xml");
	MimeType.set(".zip", "application/zip");
	MimeType.set(".adp", "audio/adpcm");
	MimeType.set(".au,.snd", "audio/basic");
	MimeType.set(".mid,.midi,.kar,.rmi", "audio/midi");
	MimeType.set(".mp4a", "audio/mp4");
	MimeType.set(".m4a,.m4p", "audio/mp4a-latm");
	MimeType.set(".mpga,.mp2,.mp2a,.mp3,.m2a,.m3a", "audio/mpeg");
	MimeType.set(".oga,.ogg,.spx", "audio/ogg");
	MimeType.set(".eol", "audio/vnd.digital-winds");
	MimeType.set(".dts", "audio/vnd.dts");
	MimeType.set(".dtshd", "audio/vnd.dts.hd");
	MimeType.set(".lvp", "audio/vnd.lucent.voice");
	MimeType.set(".pya", "audio/vnd.ms-playready.media.pya");
	MimeType.set(".ecelp4800", "audio/vnd.nuera.ecelp4800");
	MimeType.set(".ecelp7470", "audio/vnd.nuera.ecelp7470");
	MimeType.set(".ecelp9600", "audio/vnd.nuera.ecelp9600");
	MimeType.set(".aac", "audio/x-aac");
	MimeType.set(".aif,.aiff,.aifc", "audio/x-aiff");
	MimeType.set(".m3u", "audio/x-mpegurl");
	MimeType.set(".wax", "audio/x-ms-wax");
	MimeType.set(".wma", "audio/x-ms-wma");
	MimeType.set(".ram,.ra", "audio/x-pn-realaudio");
	MimeType.set(".rmp", "audio/x-pn-realaudio-plugin");
	MimeType.set(".wav", "audio/x-wav");
	MimeType.set(".cdx", "chemical/x-cdx");
	MimeType.set(".cif", "chemical/x-cif");
	MimeType.set(".cmdf", "chemical/x-cmdf");
	MimeType.set(".cml", "chemical/x-cml");
	MimeType.set(".csml", "chemical/x-csml");
	MimeType.set(".xyz", "chemical/x-xyz");
	MimeType.set(".bmp", "image/bmp");
	MimeType.set(".cgm", "image/cgm");
	MimeType.set(".g3", "image/g3fax");
	MimeType.set(".gif", "image/gif");
	MimeType.set(".ief", "image/ief");
	MimeType.set(".jp2", "image/jp2");
	MimeType.set(".jpeg,.jpg,.jpe", "image/jpeg");
	MimeType.set(".pict,.pic,.pct", "image/pict");
	MimeType.set(".png", "image/png");
	MimeType.set(".btif", "image/prs.btif");
	MimeType.set(".svg,.svgz", "image/svg+xml");
	MimeType.set(".tiff,.tif", "image/tiff");
	MimeType.set(".psd", "image/vnd.adobe.photoshop");
	MimeType.set(".djvu,.djv", "image/vnd.djvu");
	MimeType.set(".dwg", "image/vnd.dwg");
	MimeType.set(".dxf", "image/vnd.dxf");
	MimeType.set(".fbs", "image/vnd.fastbidsheet");
	MimeType.set(".fpx", "image/vnd.fpx");
	MimeType.set(".fst", "image/vnd.fst");
	MimeType.set(".mmr", "image/vnd.fujixerox.edmics-mmr");
	MimeType.set(".rlc", "image/vnd.fujixerox.edmics-rlc");
	MimeType.set(".mdi", "image/vnd.ms-modi");
	MimeType.set(".npx", "image/vnd.net-fpx");
	MimeType.set(".wbmp", "image/vnd.wap.wbmp");
	MimeType.set(".xif", "image/vnd.xiff");
	MimeType.set(".ras", "image/x-cmu-raster");
	MimeType.set(".cmx", "image/x-cmx");
	MimeType.set(".fh,.fhc,.fh4,.fh5,.fh7", "image/x-freehand");
	MimeType.set(".ico", "image/x-icon");
	MimeType.set(".pntg,.pnt,.mac", "image/x-macpaint");
	MimeType.set(".pcx", "image/x-pcx");
	//MimeType.set(".pic,.pct", "image/x-pict");
	MimeType.set(".pnm", "image/x-portable-anymap");
	MimeType.set(".pbm", "image/x-portable-bitmap");
	MimeType.set(".pgm", "image/x-portable-graymap");
	MimeType.set(".ppm", "image/x-portable-pixmap");
	MimeType.set(".qtif,.qti", "image/x-quicktime");
	MimeType.set(".rgb", "image/x-rgb");
	MimeType.set(".xbm", "image/x-xbitmap");
	MimeType.set(".xpm", "image/x-xpixmap");
	MimeType.set(".xwd", "image/x-xwindowdump");
	MimeType.set(".eml,.mime", "message/rfc822");
	MimeType.set(".igs,.iges", "model/iges");
	MimeType.set(".msh,.mesh,.silo", "model/mesh");
	MimeType.set(".dwf", "model/vnd.dwf");
	MimeType.set(".gdl", "model/vnd.gdl");
	MimeType.set(".gtw", "model/vnd.gtw");
	MimeType.set(".mts", "model/vnd.mts");
	MimeType.set(".vtu", "model/vnd.vtu");
	MimeType.set(".wrl,.vrml", "model/vrml");
	MimeType.set(".ics,.ifb", "text/calendar");
	MimeType.set(".css", "text/css");
	MimeType.set(".csv", "text/csv");
	MimeType.set(".html,.htm", "text/html");
	MimeType.set(".txt,.text,.conf,.def,.list,.log,.in", "text/plain");
	MimeType.set(".dsc", "text/prs.lines.tag");
	MimeType.set(".rtx", "text/richtext");
	MimeType.set(".sgml,.sgm", "text/sgml");
	MimeType.set(".tsv", "text/tab-separated-values");
	MimeType.set(".t,.tr,.roff,.man,.me,.ms", "text/troff");
	MimeType.set(".uri,.uris,.urls", "text/uri-list");
	MimeType.set(".curl", "text/vnd.curl");
	MimeType.set(".dcurl", "text/vnd.curl.dcurl");
	MimeType.set(".scurl", "text/vnd.curl.scurl");
	MimeType.set(".mcurl", "text/vnd.curl.mcurl");
	MimeType.set(".fly", "text/vnd.fly");
	MimeType.set(".flx", "text/vnd.fmi.flexstor");
	MimeType.set(".gv", "text/vnd.graphviz");
	MimeType.set(".3dml", "text/vnd.in3d.3dml");
	MimeType.set(".spot", "text/vnd.in3d.spot");
	MimeType.set(".jad", "text/vnd.sun.j2me.app-descriptor");
	MimeType.set(".wml", "text/vnd.wap.wml");
	MimeType.set(".wmls", "text/vnd.wap.wmlscript");
	MimeType.set(".s,.asm", "text/x-asm");
	MimeType.set(".c,.cc,.cxx,.cpp,.h,.hh,.dic", "text/x-c");
	MimeType.set(".f,.for,.f77,.f90", "text/x-fortran");
	MimeType.set(".p,.pas", "text/x-pascal");
	MimeType.set(".java", "text/x-java-source");
	MimeType.set(".etx", "text/x-setext");
	MimeType.set(".uu", "text/x-uuencode");
	MimeType.set(".vcs", "text/x-vcalendar");
	MimeType.set(".vcf", "text/x-vcard");
	MimeType.set(".3gp", "video/3gpp");
	MimeType.set(".3g2", "video/3gpp2");
	MimeType.set(".h261", "video/h261");
	MimeType.set(".h263", "video/h263");
	MimeType.set(".h264", "video/h264");
	MimeType.set(".jpgv", "video/jpeg");
	MimeType.set(".jpm,.jpgm", "video/jpm");
	MimeType.set(".mj2,.mjp2", "video/mj2");
	MimeType.set(".mp4,.mp4v,.mpg4,.m4v", "video/mp4");
	MimeType.set(".mpeg,.mpg,.mpe,.m1v,.m2v", "video/mpeg");
	MimeType.set(".ogv", "video/ogg");
	MimeType.set(".qt,.mov", "video/quicktime");
	MimeType.set(".fvt", "video/vnd.fvt");
	MimeType.set(".mxu,.m4u", "video/vnd.mpegurl");
	MimeType.set(".pyv", "video/vnd.ms-playready.media.pyv");
	MimeType.set(".viv", "video/vnd.vivo");
	MimeType.set(".dv,.dif", "video/x-dv");
	MimeType.set(".f4v", "video/x-f4v");
	MimeType.set(".fli", "video/x-fli");
	MimeType.set(".flv", "video/x-flv");
	//MimeType.set(".m4v", "video/x-m4v");
	MimeType.set(".asf,.asx", "video/x-ms-asf");
	MimeType.set(".wm", "video/x-ms-wm");
	MimeType.set(".wmv", "video/x-ms-wmv");
	MimeType.set(".wmx", "video/x-ms-wmx");
	MimeType.set(".wvx", "video/x-ms-wvx");
	MimeType.set(".avi", "video/x-msvideo");
	MimeType.set(".movie", "video/x-sgi-movie");
	MimeType.set(".ice", "x-conference/x-cooltalk");
	MimeType.set(".webm", "video/webm");

	// Not really sure about these...
	MimeType.set(".epub", "application/epub+zip");
	MimeType.set(".mobi", "application/x-mobipocket-ebook");

	// Here's some common special cases without filename extensions
	MimeType.set("README,LICENSE,COPYING,TODO,ABOUT,AUTHORS,CONTRIBUTORS",
		"text/plain");
	MimeType.set("manifest,.manifest,.mf,.appcache", "text/cache-manifest");
	if (exports !== undefined) {
		exports.charset = MimeType.charset;
		exports.catalog = MimeType.catalog;
		exports.lookup = MimeType.lookup;
		exports.set = MimeType.set;
		exports.del = MimeType.del;
		exports.forEach = MimeType.forEach;
	}

	self.MimeType = MimeType;
	return self;
}(this));
},{"path":2}],13:[function(require,module,exports){
// Policies for HTML rendered from untrusted sources
var policies = {

	// HTML Policies
	// =============
	allowedHtmlTags: [ // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/HTML5_element_list
		// metadata
		'style',

		// sections
		'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'header', 'footer', 'section', 'nav', 'article', 'aside', 'address',

		// grouping
		'hr', 'p', 'pre', 'blockquote',
		'ol', 'ul', 'li', 'dl', 'dt', 'dd',
		'figure', 'figcaption',
		'div',

		// text-level semantics
		'a', 'em', 'strong', 'small', 's',
		'cite', 'q', 'dfn', 'abbr',
		'data', 'time', 'code', 'var', 'samp', 'kbd',
		'sub', 'sup', 'i', 'b', 'u',
		'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo',
		'span', 'br', 'wbr',

		// edits
		'ins', 'del',

		// embedded content
		'img', 'video', 'audio', 'source', 'track',

		// tabular data
		'table', 'caption', 'colgroup', 'col',
		'tbody', 'thead', 'tfoot',
		'tr', 'td', 'th',

		// forms
		'form', 'fieldset', 'legend',
		'label', 'input', 'button', 'select',
		'datalist', 'optgroup', 'option',
		'textarea', 'keygen', 'output',
		'progress', 'meter',

		// crummy old tags that really shouldnt be used anymore
		'center'
	],
	disallowedClasses: [
		// Bootstrap
		// because of position: fixed or position: absolute
		'affix', 'dropdown-backdrop', 'navbar-fixed-top', 'navbar-fixed-bottom',
		'modal', 'modal-backdrop',
		'carousel-control', 'carousel-indicators',
		'next', 'prev', // these are from .carousel-inner > .next

		// Custom
		'addlink-panel', 'config-panel'
	],
	urlsPolicy: function(url) { return url; }, // allow all (for now)
	tokensPolicy: function(token) {
		if (policies.disallowedClasses.indexOf(token) == -1) {
			return token;
		}
		console.warn('Removed disallowed id/class:', token);
	},
	htmlTagPolicy: function(tagName, attribs) {
		if (policies.allowedHtmlTags.indexOf(tagName) !== -1) {
			return {
				attribs: require('./security').sanitizeHtmlAttribs(
					tagName,
					attribs,
					policies.urlsPolicy,
					policies.tokensPolicy,
					policies.cssPropertyPolicy,
					policies.cssValuePolicy
				)
			};
		} else {
			console.warn('Removed disallowed tag:', tagName);
		}
	},

	// CSS Policies
	// ============
	cssPropertyPolicy: function(decl) {
		var is = function(str) { return decl.property == str; };
		var starts = function(str) { return decl.property.indexOf(str) === 0; };
		var contains = function(str) { return decl.property.indexOf(str) !== -1; };

		if (contains('@')) return false;
		if (starts('background')) return true;
		if (starts('border')) return true;
		if (is('box-shadow')) return true;
		if (is('clear')) return true;
		if (is('color')) return true;
		if (is('content')) return true;
		if (is('display')) return true;
		if (is('direction')) return true;
		if (is('display')) return true;
		if (is('float')) return true;
		if (starts('font')) return true;
		if (is('height')) return true;
		if (is('letter-spacing')) return true;
		if (is('line-height')) return true;
		if (starts('list-style')) return true;
		if (starts('margin')) return true;
		if (starts('max-')) return true;
		if (starts('min-')) return true;
		if (is('opacity')) return true;
		if (starts('outline')) return true;
		if (starts('overflow')) return true;
		if (starts('padding')) return true;
		if (is('pointer-events')) return true;
		if (is('resize')) return true;
		if (is('table-layout')) return true;
		if (starts('text-')) return true;
		if (is('vertical-align')) return true;
		if (is('visibility')) return true;
		if (is('white-space')) return true;
		if (is('width')) return true;
		if (starts('word-')) return true;

		return false;
	},
	cssValuePolicy: function(decl) {
		var is = function(str) { return decl.value == str; };
		var starts = function(str) { return decl.value.indexOf(str) === 0; };
		var contains = function(str) { return decl.value.indexOf(str) !== -1; };

		if (contains('url')) return false;

		return true;
	}
};
module.exports = policies;
},{"./security":14}],14:[function(require,module,exports){
var policies = require('./security-policies');

module.exports = {
	sanitizeHtml: function(html, selectorPrefix) {
		var sanitize = makeHtmlSanitizer(
			policies.htmlTagPolicy,
			sanitizeStyles.bind(
				null,
				selectorPrefix,
				policies.cssPropertyPolicy,
				policies.cssValuePolicy
			)
		);

		var outputArray = [];
		sanitize(html, outputArray);
		return outputArray.join('');
	},
	sanitizeHtmlAttribs: sanitizeHtmlAttribs,
	sanitizeStyles: sanitizeStyles
};

// HTML sanitation
// ===============
var ampRe = /&/g;
var looseAmpRe = /&([^a-z#]|#(?:[^0-9x]|x(?:[^0-9a-f]|$)|$)|$)/gi;
var ltRe = /</g;
var gtRe = />/g;
var quotRe = /\"/g;
function escapeAttrib(s) {
	return ('' + s).replace(ampRe, '&amp;').replace(ltRe, '&lt;')
		.replace(gtRe, '&gt;').replace(quotRe, '&#34;');
}

// Returns a function that strips unsafe tags and attributes from html.
// - `tagPolicy`: function(string, [string]) -> [string]
//   - A function that takes (tagName, attribs[]), where
//     - `tagName` is a key in html4.ELEMENTS
//     - `attribs` is an array of alternating attribute names and values.
//   - Should return a record (as follows) or null to delete the element.
//   - Can modify the attribs array
//   - Returned record:
//     - `attribs`: (required) Sanitized attributes array.
//     - `tagName`: Replacement tag name.
function makeHtmlSanitizer(tagPolicy, styleSanitizer) {
	var lastTag;
	var stack;
	var ignoring;
	var emit = function (text, out) {
		if (!ignoring) {
			if (lastTag == 'style' && styleSanitizer) {
				text = styleSanitizer(text);
			}
			out.push(text);
		}
	};
	return window.html.makeSaxParser({
		'startDoc': function(_) {
			stack = [];
			ignoring = false;
		},
		'startTag': function(tagNameOrig, attribs, out) {
			if (ignoring) { return; }
			if (!window.html4.ELEMENTS.hasOwnProperty(tagNameOrig)) { return; }
			var eflagsOrig = window.html4.ELEMENTS[tagNameOrig];
			if (eflagsOrig & window.html4.eflags['FOLDABLE']) {
				return;
			}

			var decision = tagPolicy(tagNameOrig, attribs);
			if (!decision) {
				ignoring = !(eflagsOrig & window.html4.eflags['EMPTY']);
				return;
			} else if (typeof decision !== 'object') {
				throw new Error('tagPolicy did not return object (old API?)');
			}
			if ('attribs' in decision) {
				attribs = decision['attribs'];
			} else {
				throw new Error('tagPolicy gave no attribs');
			}
			var eflagsRep;
			var tagNameRep;
			if ('tagName' in decision) {
				tagNameRep = decision['tagName'];
				eflagsRep = window.html4.ELEMENTS[tagNameRep];
			} else {
				tagNameRep = tagNameOrig;
				eflagsRep = eflagsOrig;
			}

			// If this is an optional-end-tag element and either this element or its
			// previous like sibling was rewritten, then insert a close tag to
			// preserve structure.
			if (eflagsOrig & window.html4.eflags['OPTIONAL_ENDTAG']) {
				var onStack = stack[stack.length - 1];
				if (onStack && onStack.orig === tagNameOrig &&
					(onStack.rep !== tagNameRep || tagNameOrig !== tagNameRep)) {
					out.push('<\/', onStack.rep, '>');
				}
			}

			if (!(eflagsOrig & window.html4.eflags['EMPTY'])) {
				stack.push({orig: tagNameOrig, rep: tagNameRep});
			}

			out.push('<', tagNameRep);
			for (var i = 0, n = attribs.length; i < n; i += 2) {
				var attribName = attribs[i],
				value = attribs[i + 1];
				if (value !== null && value !== void 0) {
					out.push(' ', attribName, '="', escapeAttrib(value), '"');
				}
			}
			out.push('>');

			lastTag = tagNameRep;

			if ((eflagsOrig & html4.eflags['EMPTY'])
				&& !(eflagsRep & html4.eflags['EMPTY'])) {
				// replacement is non-empty, synthesize end tag
				out.push('<\/', tagNameRep, '>');
			}
		},
		'endTag': function(tagName, out) {
			if (ignoring) {
				ignoring = false;
				return;
			}
			if (!window.html4.ELEMENTS.hasOwnProperty(tagName)) { return; }
			var eflags = window.html4.ELEMENTS[tagName];
			if (!(eflags & (window.html4.eflags['EMPTY'] | window.html4.eflags['FOLDABLE']))) {
				var index;
				if (eflags & window.html4.eflags['OPTIONAL_ENDTAG']) {
					for (index = stack.length; --index >= 0;) {
						var stackElOrigTag = stack[index].orig;
						if (stackElOrigTag === tagName) { break; }
						if (!(window.html4.ELEMENTS[stackElOrigTag] &
							  window.html4.eflags['OPTIONAL_ENDTAG'])) {
							// Don't pop non optional end tags looking for a match.
							return;
						}
					}
				} else {
					for (index = stack.length; --index >= 0;) {
						if (stack[index].orig === tagName) { break; }
					}
				}
				if (index < 0) { return; }  // Not opened.
				for (var i = stack.length; --i > index;) {
					var stackElRepTag = stack[i].rep;
					if (!(window.html4.ELEMENTS[stackElRepTag] &
						  window.html4.eflags['OPTIONAL_ENDTAG'])) {
						out.push('<\/', stackElRepTag, '>');
					}
				}
				if (index < stack.length) {
					tagName = stack[index].rep;
				}
				stack.length = index;
				out.push('<\/', tagName, '>');
			}
		},
		'pcdata': emit,
		'rcdata': emit,
		'cdata': emit,
		'endDoc': function(out) {
			for (; stack.length; stack.length--) {
				out.push('<\/', stack[stack.length - 1].rep, '>');
			}
		}
	});
}

// Sanitizers attributes on an HTML tag.
// - tagName: string, the HTML tag name in lowercase.
// - attribs: [string], an array of alternating names and values
// - uriPolicy: function(string) -> string, a transform to apply to URI attributes.
//   - Can return a new string value, or null to delete the attribute.
//   - If unspecified, URI attributes are deleted.
// - tokenPolicy: function(string) -> string, A transform to apply to attributes.
//   - Applied to names, IDs, and classes.
//   - Can return a new string value, or null to delete the attribute.
//   - If unspecified, these attributes are kept unchanged.
// - `cssPropertyPolicy`: function(decl) -> bool, return false to strip the declaration
// - `cssValuePolicy`: function(dec;) -> bool, return false to strip the declaration
// - returns [string], The sanitized attributes as a list of alternating names and values,
//                     where a null value means to omit the attribute.
function sanitizeHtmlAttribs(tagName, attribs, uriPolicy, tokenPolicy, cssPropertyPolicy, cssValuePolicy) {
	for (var i = 0; i < attribs.length; i += 2) {
		var attribName = attribs[i];
		var value = attribs[i + 1];
		var oldValue = value;

		// Look up the attribute key
		var atype = null;
		var attribKey = tagName + '::' + attribName;
		if (!html4.ATTRIBS.hasOwnProperty(attribKey)) {
			attribKey = '*::' + attribName;
			if (!html4.ATTRIBS.hasOwnProperty(attribKey)) {
				attribKey = null;
			}
		}

		// Look up attribute type by key
		if (attribKey) {
			atype = html4.ATTRIBS[attribKey];
		} else {
			// Is the attr data-* ?
			if (attribName.indexOf('data-') === 0) {
				// Allow
				attribs[i + 1] = value;
				continue;
			} else {
				// Type not known, scrub
				attribs[i + 1] = null;
				console.warn('Removed disallowed attribute', attribName);
				continue;
			}
		}

		// Sanitize by type
		switch (atype) {
				// sanitize with style policy
			case html4.atype['STYLE']:
				value = '* {\n'+value+'\n}';
				value = sanitizeStyles(null, cssPropertyPolicy, cssValuePolicy, value);
				value = value.slice(3,-1);
				break;

				// sanitize with token policy
			case html4.atype['GLOBAL_NAME']:
			case html4.atype['LOCAL_NAME']:
			case html4.atype['CLASSES']:
				value = tokenPolicy ? tokenPolicy(value) : value;
				break;

				// sanitize with uri policy
			case html4.atype['URI']:
				value = uriPolicy(value);
				break;

				// allowed
			case html4.atype['FRAME_TARGET']:
				break;

				// disallowed
			case html4.atype['NONE']:
			case html4.atype['SCRIPT']:
			case html4.atype['ID']:
			case html4.atype['IDREF']:
			case html4.atype['IDREFS']:
			default:
				console.warn('Removed disallowed attribute', attribName);
				value = null;
				break;
		}
		attribs[i + 1] = value;
	}
	return attribs;
}

// CSS Sanitation
// ==============

// Scopes all styles under a selector prefix and strips rules deemed unsafe
// - `selectorPrefix`: optional string, selector to scope the output selectors with
// - `propertyPolicy`: function(decl) -> bool, return false to strip the declaration
// - `valuePolicy`: function(decl) -> bool, return false to strip the declaration
// - `styles`: string, the styles to sanitize
// - returns string, the sanitized styles
function sanitizeStyles(selectorPrefix, propertyPolicy, valuePolicy, styles) {
	try {
		var ast = rework.parse(styles);
		removeUnsafeRules(ast, propertyPolicy, valuePolicy);
		if (selectorPrefix) {
			prefixSelectors(ast, selectorPrefix);
		}
		return rework.stringify(ast);
	} catch(e) {
		return '';
	}
}

function prefixSelectors(ast, prefix) {
	ast.stylesheet.rules.forEach(function(rule) {
		rule.selectors = rule.selectors.map(function(sel) { return prefix + ' ' + sel; });
	});
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/Reference
function removeUnsafeRules(ast, propertyPolicy, valuePolicy) {
	ast.stylesheet.rules.forEach(function(rule) {
		rule.declarations = rule.declarations.filter(function(decl) {
			var description = '"'+decl.property+': '+decl.value+'"';
			if (!propertyPolicy(decl)) {
				console.warn('Removed disallowed style', description, 'due to unsafe property', '('+decl.property+')');
				return false;
			}
			if (!valuePolicy(decl)) {
				console.warn('Removed disallowed style', description, 'due to unsafe value', '('+decl.value+')');
				return false;
			}
			return true;
		});
	});
}
},{"./security-policies":13}],15:[function(require,module,exports){
var globals = require('./globals');

var lbracket_regex = /</g;
var rbracket_regex = />/g;
function escapeHTML(str) {
	return (''+str).replace(lbracket_regex, '&lt;').replace(rbracket_regex, '&gt;');
}

var quoteRegex = /"/g;
function escapeQuotes(str) {
	return (''+str).replace(quoteRegex, '&quot;');
}

var sanitizeHtmlRegexp = /<script(.*?)>(.*?)<\/script>/g;
function stripScripts (html) {
	// CSP stops inline or remote script execution, but we still want to stop inclusions of scripts on our domain
	// :TODO: this approach probably naive in some important way
	return html.replace(sanitizeHtmlRegexp, '');
}

function pad0(n, width, z) {
	// all glory to the hypnotoad
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function decorateReltype(str) {
	return str.split(' ').map(function(rel) {
		if (rel == 'up' || rel == 'self' || rel == 'current') return '';
		if (rel.indexOf('.') === -1) {
			return '<a href="http://www.iana.org/assignments/link-relations/link-relations.xhtml" target=_blank>'+rel+'</a>';
		}
		var href = (rel.indexOf(':') === -1) ? 'http://'+rel : rel;
		return '<a href="'+href+'" target=_blank>'+rel+'</a>';
	}).join(' ');
}

/*function renderResponse(req, res) {
	if (res.body !== '') {
		if (typeof res.body == 'string') {
			if (res.header('Content-Type').indexOf('text/html') !== -1)
				return res.body;
			if (res.header('Content-Type').indexOf('image/') === 0) {
				return '<img src="'+req.url+'">';
				// :HACK: it appears that base64 encoding cant occur without retrieving the data as a binary array buffer
				// - this could be done by first doing a HEAD request, then deciding whether to use binary according to the reported content-type
				// - but that relies on consistent HEAD support, which is unlikely
				// return '<img src="data:'+res.header('Content-Type')+';base64,'+btoa(res.body)+'">';
			}
			if (res.header('Content-Type').indexOf('javascript') !== -1)
				return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+escapeHTML(res.body)+'</code></pre>';
			return '<pre>'+escapeHTML(res.body)+'</pre>';
		} else {
			return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+escapeHTML(JSON.stringify(res.body))+'</code></pre>';
		}
	}
	return res.status + ' ' + res.reason;
}*/

function serializeRawMeta(obj) {
	var parts = [];
	for (var k in obj) {
		if (k == 'href') continue;
		parts.push(k+': '+obj[k]);
	}
	return parts.join('\n');
}

function parseRawMeta(str) {
	var obj = {};
	var re = /^([^:]*): ?(.*)/;
	str.split('\n').forEach(function(line, i) {
		var parse = re.exec(line);
		if (!parse) throw {line: 5, error: 'Bad line'};
		obj[parse[1]] = parse[2];
	});
	return obj;
}

var lookupReq;
var lookupAttempts;
function fetch(url, useHead) {
	if (url === null) {
		if (lookupReq) lookupReq.close();
		lookupAttempts = null;
		return;
	}

	var method = (useHead) ? 'HEAD' : 'GET';
	var p = web.promise();
	var urld = web.parseUri(url);
	if (!urld || !urld.authority) {
		p.fulfill(false); // bad url, dont even try it!
		return p;
	}

	var triedProxy = false;
	var attempts = lookupAttempts = [new web.Request({ method: method, url: url, binary: true })]; // first attempt, as given
	if (!urld.protocol) {
		// No protocol? Two more attempts - 1 with https, then one with plain http
		attempts.push(new web.Request({ method: method, url: 'https://'+urld.authority+urld.relative, binary: true }));
		attempts.push(new web.Request({ method: method, url: 'http://'+urld.authority+urld.relative, binary: true }));
	}

	function makeAttempt() {
		if (lookupReq) lookupReq.close();
		if (lookupAttempts != attempts) { // have we started a new set of attempts?
			console.log('Aborting lookup attempts');
			return;
		}
		lookupReq = attempts.shift();
		lookupReq.bufferResponse().end().always(handleAttempt);
	}
	makeAttempt();

	function handleAttempt(res) {
		if (res.status >= 200 && res.status < 300) {
			p.fulfill(res); // Done!
		} else if (!attempts.length && res.status === 0 && !triedProxy) {
			// May be a CORS issue, try the proxy
			triedProxy = true;
			globals.fetchProxyClient.resolve({ nohead: true }).always(function(proxyUrl) {
				if (!urld.protocol) {
					if (useHead) {
						attempts.push(new web.Request({ method: 'HEAD', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative } }));
						attempts.push(new web.Request({ method: 'HEAD', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative } }));
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					} else {
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					}
				} else {
					if (useHead) {
						attempts.push(new web.Request({ method: 'HEAD', url: proxyUrl, params: { url: url } }));
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: url }, binary: true }));
					} else {
						attempts.push(new web.Request({ method: 'GET', url: proxyUrl, params: { url: url }, binary: true }));
					}
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
	}

	return p;
}

module.exports = {
	escapeHTML: escapeHTML,
	makeSafe: escapeHTML,
	escapeQuotes: escapeQuotes,
	stripScripts: stripScripts,

	decorateReltype: decorateReltype,
	// renderResponse: renderResponse,

	pad0: pad0,

	serializeRawMeta: serializeRawMeta,
	parseRawMeta: parseRawMeta,

	fetch: fetch,
	fetchMeta: function(url) { return fetch(url, true); }
};
},{"./globals":10}]},{},[7])