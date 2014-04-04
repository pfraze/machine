var hostUA = local.agent(window.location.protocol + '//' + window.location.host);
window.globals = module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	hostUA: hostUA,
	pageUA: local.agent(window.location.toString()),
	authUA: hostUA.follow({ rel: 'service', id: 'auth' }),
	meUA: hostUA.follow({ rel: 'item', id: '.me' }),
	fetchProxyUA: hostUA.follow({ rel: 'service', id: '.fetch' }),
};