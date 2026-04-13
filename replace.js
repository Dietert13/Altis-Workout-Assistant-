const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/bg-transparent border border-white\/20/g, 'bg-white/5 backdrop-blur-md border border-white/20');

fs.writeFileSync(filePath, content);
console.log('Done');
