
// Gui State
// =========
var searchform = document.querySelector('#layer1-searchform');
var views = document.querySelector('#layer1-views');

// Gui Methods
// ===========
function focusInput() {
	searchform.querySelector('input').focus();
}

// Keyboard shortcuts
// ==================
document.addEventListener('keydown', function(e) {
	if (e.shiftKey && e.ctrlKey) {
		if (e.keyIdentifier == 'Down') {
			focusInput();
		}
		else if (e.keyIdentifier == 'Up') {
			sendMessage({ close: true });
		}
		else if (e.keyIdentifier == 'Right') {
			sendMessage({ right: true });
		}
		else if (e.keyIdentifier == 'Left') {
			sendMessage({ left: true });
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