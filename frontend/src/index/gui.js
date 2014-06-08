
var $iframe;
module.exports = {
	setup: setup,
};

function setup() {
	$iframe = $('#program-view iframe');
	$(window).on('resize', onWindowResize);
	onWindowResize();
}

function onWindowResize() {
	$iframe.height($(window).height() - 10);
}