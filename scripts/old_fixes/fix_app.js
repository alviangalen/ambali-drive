const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/App.tsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import PublicShare')) {
  content = content.replace(
    /import Drive from '\.\/pages\/Drive';/,
    `import Drive from './pages/Drive';\nimport PublicShare from './pages/PublicShare';`
  );

  content = content.replace(
    /<Route path="\/register" element=\{<Register \/>\} \/>/,
    `<Route path="/register" element={<Register />} />\n        <Route path="/s/:hash" element={<PublicShare />} />`
  );

  fs.writeFileSync(file, content);
  console.log('App.tsx updated');
} else {
  console.log('App.tsx already updated');
}
