var hostUA = local.agent(window.location.protocol + '//' + window.location.host);
module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	pageUA: local.agent(window.location.toString()),
	authUA: hostUA.follow({ rel: 'service', id: 'auth' }),
	meUA: hostUA.follow({ rel: 'item', id: '.me' }),
	lookupProxyUA: hostUA.follow({ rel: 'service', id: '.lookup' }),
};