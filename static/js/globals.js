var _session = {
	user: $('body').data('user') || null,
	isPageAdmin: $('body').data('user-is-admin') == '1'
};

var $host = local.agent(window.location.protocol + '//' + window.location.host);
var $page = local.agent(window.location.toString());
var $auth = $host.follow({ rel: 'service', id: 'auth' });
var $me = $host.follow({ rel: 'item', id: '.me' });
var $lookupProxy = $host.follow({ rel: 'service', id: '.lookup' });

// Environment Setup
local.logAllExceptions = true;

// Traffic logging
local.setDispatchWrapper(function(req, res, dispatch) {
	var res_ = dispatch(req, res);
	res_.then(
		function() { console.log(req, res); },
		function() { console.error(req, res); }
	);
});
