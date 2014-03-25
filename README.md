## Machine

Run `./machine setup` to prep, `npm start` (or `./machine start`) to run server and `npm test` (or `./machine test`) to run tests.

Config is stored in `./config.json`, which is created after setup and should be modified. Its values can be overriden with `./machine start` params, type `./machine` to see the full list of config/switches.

#### LevelDB structure

Here's how I went with it. `./lib/db.js` gives a good overview.

 - The server's dataset is split up into directories
 - Main database has an entry for each directory. The directory ID is the keyname. It contains data about the dir (eg perms/owner)
 - Each dir has two sublevels (check level-sublevel for explanation): a meta sublevel and a document sublevel.
 - The ID for an added document is shared between the meta and document sublevel. Makes it easy to lookup the other.
 - A single ID counter is maintained to assign time-of-insertion-ordered IDs for the entire DB. A given sublevel will have gaps in its id-space, but that doesnt matter so long as they are constantly increasing. [Based on this suggestion](http://stackoverflow.com/questions/16554808/leveldb-iterate-keys-by-insertion-order)

#### About the frontend

Frontend JS is a half-way between a transition to browserify, and includes some of the old chat code. Let me know if you don't like browserify. Otherwise, going to pull out the chat code, unify everything under browserify, add a script to simplify the browserify build (maybe `./machine build`) and implement the feed rendering.

#### v1 Checklist

Done:

 - Directories and documents
  - Dirs: create/delete/get/getMeta
  - Docs: create/delete
 - Auth with Persona
  - Owner perms on directories

Todo:

 - Frontend
  - Overall styles
  - Directory rendering
 - 3rdparty App Auth
 - Directory SSE streams