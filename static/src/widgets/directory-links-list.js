var globals = require('../globals');

module.exports = {
	setup: function() {
		$('.directory-links-list').on('click', function(e) {
			var slotEl = local.util.findParentNode.byClass(e.target, 'directory-item-slot');
			if (slotEl) {
				if (!e.ctrlKey) {
					// unselect current selection if ctrl isnot held down
					$('.directory-links-list .selected').removeClass('selected');
				}
				slotEl.classList.add('selected');
			}
		});
	}
};