var hostAgent = local.agent(window.location.protocol + '//' + window.location.host);
window.globals = module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	hostAgent: hostAgent,
	pageAgent: local.agent(window.location.toString()),
	authAgent: hostAgent.follow({ rel: 'service', id: 'auth' }),
	meAgent: hostAgent.follow({ rel: 'item', id: '.me' }),
	fetchProxyAgent: hostAgent.follow({ rel: 'service', id: '.fetch' }),
};