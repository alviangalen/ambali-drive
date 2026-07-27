const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add createShareLink and removeShareLink to imports
content = content.replace(
  /import \{ fetchFiles, createFolder as apiCreateFolder, uploadFile, renameFile, trashFile, restoreFile, deleteFile, moveFile, createShareLink \} from '\.\.\/lib\/api'/,
  `import { fetchFiles, createFolder as apiCreateFolder, uploadFile, renameFile, trashFile, restoreFile, deleteFile, moveFile, createShareLink, removeShareLink } from '../lib/api'`
);

// 2. Fix the loadData mapping to handle publicLink
content = content.replace(
  /shareLink: f\.publicLink,/,
  `shareLink: f.publicLink ? {
          url: window.location.origin + '/s/' + f.publicLink.urlHash,
          password: f.publicLink.passwordHash ? 'has_password' : null,
          expiresAt: f.publicLink.expiresAt,
          allowDownload: f.publicLink.allowDownload
        } : null,`
);

// 3. Fix ShareModal default link generation and save function
// Default link:
content = content.replace(
  /const \[link, setLink\] = useState<ShareLink>\(item\.shareLink \?\? \{ url: \`https:\/\/drive\.ambali\.io\/s\/\$\{genId\(\)\}\`, password: null, expiresAt: null, allowDownload: true \}\)/,
  `const [link, setLink] = useState<ShareLink>(item.shareLink ?? { url: 'Link will be generated on save', password: null, expiresAt: null, allowDownload: true })`
);

// Save function:
content = content.replace(
  /const save = \(\) => \{\n\s*onUpdate\(\{\n\s*\.\.\.item,\n\s*sharedWith: shared,\n\s*shareLink: linkActive \? \{ \.\.\.link, password: showPwInput && pwValue \? pwValue : null, expiresAt: showExpiry && expiryValue \? expiryValue \+ 'T23:59:00Z' : null \} : null,\n\s*\}\)\n\s*onClose\(\)\n\s*\}/,
  `const save = async () => {
    try {
      if (linkActive) {
        const pass = showPwInput && pwValue ? pwValue : null;
        const expiry = showExpiry && expiryValue ? expiryValue + 'T23:59:00Z' : null;
        const res = await createShareLink(item.id, link.allowDownload, pass, expiry);
        onUpdate({
          ...item,
          sharedWith: shared,
          shareLink: {
            url: window.location.origin + '/s/' + res.urlHash,
            password: res.passwordHash ? 'has_password' : null,
            expiresAt: res.expiresAt,
            allowDownload: res.allowDownload
          }
        });
      } else if (item.shareLink) {
        await removeShareLink(item.id);
        onUpdate({
          ...item,
          sharedWith: shared,
          shareLink: null
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save share settings');
    }
  }`
);

fs.writeFileSync(file, content);
console.log('Share logic in Drive updated');
