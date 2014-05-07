var sec = require('../security');

// Load preset styles
var presetStyles = document.getElementById('preset-styles').innerHTML;
$(document.body).append('<style>'+presetStyles+'</style>');

// Load and sanitize test styles
var testStyles = document.getElementById('test-styles').innerHTML;
testStyles = sec.sanitizeStyles('#sandbox', testStyles);
document.getElementById('sanitized-styles').innerHTML = testStyles;
$(document.body).append('<style>'+testStyles+'</style>');