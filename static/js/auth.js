var currentUser = $('body').data('user') || null;

var $host = local.agent(window.location.protocol + '//' + window.location.host);
var $auth = $host.follow({ rel: 'service', id: 'auth' });
navigator.id.watch({
	loggedInUser: currentUser,
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

if (currentUser) {
	$('.profile-btn').text(currentUser).css('display', 'inline-block');
	$('.show-on-authed').show();
	$('.auth-btn').text('Logout').on('click', function() {
		navigator.id.logout();
	});
} else {
	$('.auth-btn').removeClass('btn-default').addClass('btn-success').on('click', function() {
		navigator.id.request();
	});
}