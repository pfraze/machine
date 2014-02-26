navigator.id.watch({
	loggedInUser: _session.user,
	onlogin: function(assertion) {
		$auth.POST({ assertion: assertion })
			.then(function() { window.location.reload(); })
			.fail(function(res) { navigator.id.logout(); console.error('Failed to log in', res); });
	},
	onlogout: function() {
		$auth.DELETE()
			.then(function() { window.location.reload(); })
			.fail(function(res) { console.error('Failed to log out', res); });
	}
});

if (_session.user) {
	$('.profile-btn').text(_session.user).css('display', 'inline-block');
	$('.show-on-authed').show();
	$('.auth-btn').text('Logout').on('click', function() {
		navigator.id.logout();
	});
} else {
	$('.auth-btn').removeClass('btn-default').addClass('btn-success').on('click', function() {
		navigator.id.request();
	});
}

if (_session.isPageAdmin) {
	$('.show-on-admin').show();
}