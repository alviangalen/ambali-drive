const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Fix ContextMenu parameter list to include onDownload
content = content.replace(
  /function ContextMenu\(\{\n  ctx, item, section, onClose, onPreview, onStar, onShare, onRename, onMove, onTrash, onRestore, onDelete\n\}: \{/g,
  "function ContextMenu({\n  ctx, item, section, onClose, onPreview, onStar, onShare, onRename, onMove, onTrash, onRestore, onDelete, onDownload\n}: {"
);

// 2. Fix PreviewModal tag at line 1201 (multi-line)
content = content.replace(
  /<PreviewModal\n          item=\{previewItem\}\n          siblings=\{items\.filter\(i => i\.parentId === previewItem\.parentId && !i\.trashed\)\}\n          onClose=\{\(\) => setPreviewItem\(null\)\}\n        \/>/g,
  `<PreviewModal
          item={previewItem}
          siblings={items.filter(i => i.parentId === previewItem.parentId && !i.trashed)}
          onClose={() => setPreviewItem(null)}
          onDownload={downloadFile}
        />`
);

// 3. Fix folderHistory usage in openFolder
content = content.replace(
  /if \(folderId\) setFolderHistory\(h => \[\.\.\.h, folderId\]\)/g,
  "if (folderId) setFolderHistory(h => [...h, { id: folderId, name: items.find(i => i.id === folderId)?.name || 'Folder' }])"
);
content = content.replace(
  /else setFolderHistory\(h => \[\.\.\.h, ''\]\)/g,
  "// Removed invalid history assignment"
);

fs.writeFileSync(file, content);
console.log('Fixed typescript errors');
