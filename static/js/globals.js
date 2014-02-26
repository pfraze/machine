var currentUser = $('body').data('user') || null;

var $host = local.agent(window.location.protocol + '//' + window.location.host);
var $auth = $host.follow({ rel: 'service', id: 'auth' });
var $me = $host.follow({ rel: 'item', id: '.me' });