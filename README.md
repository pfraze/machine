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

Frontend JS is compiled with browserify. Run `./machine build` to rebuild. Also, all templates are in `./static` as .html files, and they are loaded into memory at server load. If you make changes to them, you either restart the server, or run `./machine reload` to trigger a config and template reload. (Not ideal, I know. Maybe we can add a dev-flag to always load templates from disk each request.)

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