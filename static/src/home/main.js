// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();

// ui
require('../widgets/user-directories-panel').setup();