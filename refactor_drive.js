const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Move imports to the top
content = content.replace(/import \{ fetchFiles.*\nimport \{ useAuthStore \} from '\.\.\/store\/authStore'\n/, '');
content = content.replace(/import ambaliLogo from '@\/imports\/ambalilogocrop-removebg-preview\.png'/, 
  "import ambaliLogo from '@/imports/ambalilogocrop-removebg-preview.png'\n" +
  "import { fetchFiles, createFolder as apiCreateFolder, uploadFile, renameFile, trashFile, restoreFile, deleteFile, moveFile, createShareLink } from '../lib/api'\n" +
  "import { useAuthStore } from '../store/authStore'"
);

// 2. Remove mock data
content = content.replace(/\/\/ ─── Mock Users ───[\s\S]*?const OWNER_NAMES: Record<string, string> = [^\n]+\n/, '');

// 3. Replace ME usages in ShareModal
content = content.replace(/function ShareModal\([^)]+\) \{/, match => match + '\n  const user = useAuthStore(s => s.user)');
content = content.replace(/ME\.initials/g, "(user?.name?.substring(0,2).toUpperCase() || 'U')");
content = content.replace(/ME\.name/g, "(user?.name || 'User')");
content = content.replace(/ME\.email/g, "(user?.email || '')");

// 4. OWNER_NAMES in row rendering
content = content.replace(/const ownerName = OWNER_NAMES\[item\.owner\] \?\? 'Unknown'/g, "const ownerName = item.owner === user?.id ? user?.name : 'Unknown'");

// 5. Replace ctxItem SHARED_WITH_ME fallback
content = content.replace(/SHARED_WITH_ME\.find/g, "[].find");

// 6. SHARED_WITH_ME in visibleItems
content = content.replace(/if \(section === 'shared'\) return SHARED_WITH_ME/, "if (section === 'shared') return []");

// 7. Add user to Drive component
content = content.replace(/const logout = useAuthStore\(s => s\.logout\)/, "const logout = useAuthStore(s => s.logout)\n  const user = useAuthStore(s => s.user)");

fs.writeFileSync(file, content);
console.log('Refactor script completed');
