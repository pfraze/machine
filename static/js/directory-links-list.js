if (_session.isPageAdmin) {
	$('.directory-links-list .remove-link-btn').on('click', function() {
		var $link = $(this).parents('.directory-link');
		var internal_id = $link.data('internal-id');
		if (typeof internal_id == 'undefined') return false;
		$page.follow({ rel: 'item', id: internal_id }).DELETE()
			.then(function() { $link.remove(); })
			.fail(function(res) { alert('Unexpected error: '+res.status+' '+res.reason); });
		return false;
	});
}