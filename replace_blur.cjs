const fs = require('fs');
const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\[backdrop-filter:none\]/g, 'no-blur');
fs.writeFileSync(path, content);
console.log('Replacement complete');
