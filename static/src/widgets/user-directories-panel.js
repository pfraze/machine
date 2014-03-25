var globals = require('../globals');

module.exports = {
	setup: function() {
		if (globals.session.user) {
			// Populate "my dirs"
			globals.meUA.GET().then(function(res) {
				var html = res.body.directories.map(function(dir) {
					return '<a href="/'+dir.id+'" class="list-group-item"><h4 class="list-group-item-heading">'+dir.name+'</h4></a>';
				}).join('');
				$('.user-directories-panel .list-group').html(html);
			});

			// Create new directory btn
			$('.user-directories-panel .btn').on('click', function(req, res) {
				var id = prompt('Enter the name of your new directory');
				if (!id) return false;
				globals.hostUA.POST({ id: id })
					.then(function(res) {
						window.location = res.headers.location;
					})
					.fail(function(res) {
						if (res.status == 422 && res.body && res.body.id) {
							alert('Sorry, '+res.body.id);
						} else if (res.status == 409) {
							alert('Sorry, that name is taken.');
						} else {
							alert('Unexpected error: ' + res.status +' '+res.reason);
						}
					});
				return false;
			});
		}
	}
};