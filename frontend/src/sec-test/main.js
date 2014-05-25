var sec = require('../security');
var secPol = require('../security-policies');

// Load preset styles
var presetStyles = document.getElementById('preset-styles').innerHTML;
$(document.body).append('<style>'+presetStyles+'</style>');

// Load and sanitize test styles
var testStyles = document.getElementById('test-styles').innerHTML;
testStyles = sec.sanitizeStyles('#sandbox', secPol.cssPropertyPolicy, secPol.cssValuePolicy, testStyles);
document.getElementById('sanitized-styles').innerHTML = testStyles;
$(document.body).append('<style>'+testStyles+'</style>');

// Load and sanitize test HTML
var testHTML = document.getElementById('test-html').innerHTML;
testHTML = sec.sanitizeHtml(testHTML, 'prefix');
document.getElementById('sanitized-html').innerHTML = testHTML;