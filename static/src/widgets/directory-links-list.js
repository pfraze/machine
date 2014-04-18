var globals = require('../globals');

module.exports = {
	setup: function() {
		$('.center-pane').on('click', function(e) {
			if (!e.ctrlKey) {
				// unselect current selection if ctrl isnot held down
				$('.directory-links-list .selected').removeClass('selected');
			}

			var slotEl = local.util.findParentNode.byClass(e.target, 'directory-item-slot');
			if (slotEl) {
				slotEl.classList.add('selected');
			}
		});
	}
};