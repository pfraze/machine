## Machine

Run `./machine setup` to prep, then `./machine start`. Could probably have done both of those via npm scripts but hey.

Currently got postgres as a dep, going to replace that with leveldb.

Frontend JS is a half-way between a transition to browserify, and includes some of the old chat code. Let me know if you don't like browserify. Otherwise, going to pull out the chat code, unify everything under browserify, add a script to simplify the browserify build (maybe `./machine build`) and implement the feed rendering.