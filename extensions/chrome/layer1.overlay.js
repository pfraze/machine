
// Gui State
// =========
var searchform = document.querySelector('#layer1-searchform');
var views = document.querySelector('#layer1-views');

// Gui Methods
// ===========
function focusInput() {
	searchform.querySelector('input').focus();
}
function blurInput() {
	searchform.querySelector('input').blur();
}

// Keyboard shortcuts
// ==================
document.addEventListener('keydown', function(e) {
	if (e.shiftKey && e.ctrlKey) {
		if (e.keyIdentifier == 'Down') {
			focusInput();
		}
		else if (e.keyIdentifier == 'Up') {
			blurInput();
			msgCloseOverlay();
		}
	}
});

// Messaging
// =========
window.addEventListener('message', function(e) {
	if (e.data.open) {
		focusInput();
	}
});
function msgCloseOverlay() {
	sendMessage({ close: true });
}
function sendMessage(msg) {
	parent.postMessage(msg, '*');
}

// Gui Events
// ==========
var history = [];
searchform.addEventListener('submit', function(e) {
	e.preventDefault();
	var input = searchform.querySelector('input');
	history.push(input.value);
	views.innerHTML = history.join('<br>');
	input.value = '';
});