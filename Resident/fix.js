const fs = require('fs');
const file = 'C:/Users/hanzc/Documents/Get-Trash/Resident/src/screens/CommunityFeedScreen.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/color="\{colors\.([a-zA-Z]+)\}/g, 'color={colors.$1}');
fs.writeFileSync(file, content);
