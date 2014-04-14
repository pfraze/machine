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