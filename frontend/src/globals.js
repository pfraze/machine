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