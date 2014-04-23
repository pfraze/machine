var globals = require('../globals');

module.exports = {
	setup: function() {
		if (globals.session.isPageAdmin) {
			$('.directory-delete-btn').on('click', function() {
				if (!confirm('Delete this directory. Are you sure?')) return false;
				globals.pageAgent.DELETE()
					.then(function(res) {
						window.location = '/';
					})
					.fail(function(res) {
						alert('Unexpected error: ' + res.status +' '+res.reason);
					});
				return false;
			});
		}
	}
};