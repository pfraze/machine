## Machine

Run `./machine setup` to prep, then `./machine start`. Could probably have done both of those via npm scripts but hey.

#### LevelDB structure

Here's how I went with it. `./lib/db.js` gives a good overview.

 - The server's dataset is split up into directories
 - Main database has an entry for each directory. The directory ID is the keyname. It contains data about the dir (eg perms/owner)
 - Each dir has two sublevels (check level-sublevel for explanation): a meta sublevel and a document sublevel.
 - The ID for an added document is shared between the meta and document sublevel. Makes it easy to lookup the other.
 - A single ID counter is maintained to assign time-of-insertion-ordered IDs for the entire DB. A given sublevel will have gaps in its id-space, but that doesnt matter so long as they are constantly increasing. [Based on this suggestion](http://stackoverflow.com/questions/16554808/leveldb-iterate-keys-by-insertion-order)

#### About the frontend

Frontend JS is a half-way between a transition to browserify, and includes some of the old chat code. Let me know if you don't like browserify. Otherwise, going to pull out the chat code, unify everything under browserify, add a script to simplify the browserify build (maybe `./machine build`) and implement the feed rendering.