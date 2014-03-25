var globals = require('./globals');

module.exports = {
	setup: function() {
		navigator.id.watch({
			loggedInUser: globals.session.user,
			onlogin: function(assertion) {
				globals.authUA.POST({ assertion: assertion })
					.then(function() { window.location.reload(); })
					.fail(function(res) { navigator.id.logout(); console.error('Failed to log in', res); });
			},
			onlogout: function() {
				globals.authUA.DELETE()
					.then(function() { window.location.reload(); })
					.fail(function(res) { console.error('Failed to log out', res); });
			}
		});

		if (globals.session.user) {
			$('.profile-btn').text(globals.session.user).css('display', 'inline-block');
			$('.show-on-authed').show();
			$('.auth-btn').text('Logout').on('click', function() {
				navigator.id.logout();
			});
		} else {
			$('.auth-btn').removeClass('btn-default').addClass('btn-success').on('click', function() {
				navigator.id.request();
			});
		}

		if (globals.session.isPageAdmin) {
			$('.show-on-admin').show();
		}
	}
};