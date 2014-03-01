all: clean build
	@echo "Done!"

clean:
	@-rm static/js/chat.js
	@echo Cleaned Out Built Assets

build: static/js/chat.js
	@echo Browserified Assets
static/js/chat.js:
	browserify -o static/js/chat.js static/src/chat/main.js