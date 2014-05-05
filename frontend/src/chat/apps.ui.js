// Apps
// ====
// Manages apps that appear in the index

var util = require('../util');
var agents = require('../agents');
var linkRegistry = require('./linkregistry');
var pagent = require('./pagent');

var currentAppId = false;
var currentAppTxn = null;
var activeApps = {}; // linkRegistryEntryId -> { link:, $iframe:, etc }

var server = servware();
module.exports = server;

server.setup = function() {
	// Link registry events
	linkRegistry.on('add', onLinksAdded);
	linkRegistry.on('remove', onLinksRemoved);
	// $(window).resize(onWindowResize);
};

server.route('/:app', function(link, method) {
	method('SETCURRENT', function(req, res) {
		if (req.header('Origin')) return 403;
		setCurrentApp(req.params.app);
		renderAppsNav();
		return 204;
	});
});

function onLinksAdded(entry) {
	// Check for applications
	var appLink = local.queryLinks(entry.links, 'todo.com/rel/agent/app')[0];
	if (appLink) {
		activeApps[entry.id] = { link: appLink };
		if (currentAppId === false) {
			setCurrentApp(entry.id);
		}
		renderAppsNav();
	}
}

function onLinksRemoved(entry) {
	// Remove from our apps if present
	if (activeApps[entry.id]) {
		delete activeApps[entry.id];
		if (currentAppId !== false && currentAppId == entry.id) {
			setCurrentApp(Object.keys(activeApps)[0] || false);
		}
		renderAppsNav();
	}
}

function onWindowResize() {
	var app = activeApps[currentAppId];
	if (app && app.$iframe) {
		// Resize iframe
		app.$iframe.height(calcIframeHeight());
	}
}

function calcIframeHeight() {
	return ($(window).height() - 100) + 'px';
}

function setCurrentApp(id) {
	// Shut down current app
	if (currentAppTxn) {
		currentAppTxn.end();
		currentAppTxn = null;
	}
	// Load new app if available
	if (activeApps[id]) {
		currentAppId = id;
		var app = activeApps[id];
		var urld = local.parseUri(app.link.href);
		// Invoke app agent
		currentAppTxn = agents.invoke(app.link,
			function(dep) {
				if (dep == 'todo.com/rel/nquery') {
					// Create iframe
					app.$iframe = pagent.createIframe($('#apps'), urld.protocol + '://' + urld.authority);
					pagent.renderIframe(app.$iframe, '');
					app.$iframe.height('5000px');//calcIframeHeight());

					// Add nquery region
					app.n$path = pagent.n$Service.addRegion(null, { token: 1234 }); // :TODO: token!!
					var n$url = 'httpl://' + pagent.n$Service.config.domain + app.n$path;

					// Update nquery region when ready
					app.$iframe.load(function() {
						pagent.n$Service.setRegionEl(app.n$path, app.$iframe.contents().find('body'));
					});

					// Return URL
					return { nquery: n$url };
				}
				return {};
			},
			function() {
				if (app.n$path) {
					pagent.n$Service.removeRegion(app.n$path);
					delete app.n$path;
				}
				if (app.$iframe) {
					app.$iframe.remove();
					delete app.$iframe;
				}
			}
		);
	} else {
		currentAppId = false;
	}
}

function renderAppsNav() {
	var html = [];
	for (var entryId in activeApps) {
		var link = activeApps[entryId].link;
		html.push('<li'+((currentAppId == entryId)?' class="active"':'')+'><a method="SETCURRENT" href="httpl://apps.ui/'+entryId+'">'+(link.title||link.id||link.href)+'</a></li>');
	}
	$('#apps-nav').html(html.join(''));
}