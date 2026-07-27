const fs = require('fs');
const path = require('path');

// 1. Update Drive.tsx
const driveFile = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let driveContent = fs.readFileSync(driveFile, 'utf8');

// Fix copyLink
driveContent = driveContent.replace(
  /const copyLink = \(\) => \{\n\s*setCopied\(true\)/,
  `const copyLink = () => {\n    navigator.clipboard.writeText(link.url);\n    setCopied(true)`
);

// Add getStorageUsed import
if (!driveContent.includes('getStorageUsed')) {
  driveContent = driveContent.replace(
    /removeShareLink \} from '\.\.\/lib\/api'/,
    `removeShareLink, getStorageUsed } from '../lib/api'`
  );
}

// Add state for storage
driveContent = driveContent.replace(
  /const USED_BYTES = items\.reduce\(\(acc, i\) => acc \+ i\.size, 0\);/,
  `const [USED_BYTES, setUsedBytes] = useState(0);`
);

// Fetch storage in loadData
driveContent = driveContent.replace(
  /const data = await fetchFiles\(folderId, section === 'trash'\)\n\s*\/\/ Map API files/,
  `const data = await fetchFiles(folderId, section === 'trash')
      getStorageUsed().then(s => setUsedBytes(s.used)).catch(console.error)
      // Map API files`
);

// Update upload success to also refresh storage (though loadData is called usually)
// Wait, when upload finishes, does it call loadData?
// In Drive.tsx:
// const uploadFiles = async (files: FileList) => ...
// onDone={() => { setUploads(null); loadData() }}
// Yes, loadData is called when upload is done! So this is sufficient.

fs.writeFileSync(driveFile, driveContent);

// 2. Update api.ts
const apiFile = path.join(__dirname, 'frontend/src/lib/api.ts');
let apiContent = fs.readFileSync(apiFile, 'utf8');

if (!apiContent.includes('export async function getStorageUsed')) {
  apiContent += `\nexport async function getStorageUsed() {
  const res = await fetch('/api/files/storage', { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch storage');
  return res.json();
}\n`;
  fs.writeFileSync(apiFile, apiContent);
}

// 3. Update backend files.ts
const backendFile = path.join(__dirname, 'backend/src/routes/files.ts');
let backendContent = fs.readFileSync(backendFile, 'utf8');

if (!backendContent.includes('/storage')) {
  const storageRoute = `
// Get total storage used
router.get('/storage', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.userId;
    // We sum all file sizes for the user (including trashed, to be accurate to quota)
    const result = await prisma.file.aggregate({
      where: { ownerId: userId },
      _sum: { size: true }
    });
    // BigInt serialization issue in JSON, so we convert to Number (safe for up to 9 PB)
    const used = Number(result._sum.size || 0);
    res.json({ used });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate storage' });
  }
});
`;
  
  backendContent = backendContent.replace(
    /\/\/ Rename\nrouter\.put\('\/:id\/rename'/,
    storageRoute + '\n// Rename\nrouter.put(\'/:id/rename\''
  );
  
  fs.writeFileSync(backendFile, backendContent);
}

console.log('Storage and copy link fixes applied');
