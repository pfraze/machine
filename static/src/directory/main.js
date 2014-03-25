// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();

// ui
require('../widgets/user-directories-panel').setup();
require('../widgets/addlink-panel').setup();
require('../widgets/directory-links-list').setup();
require('../widgets/directory-delete-btn').setup();