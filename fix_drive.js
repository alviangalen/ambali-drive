const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// Fix 1: ShareModal user
content = content.replace(/function ShareModal\(\{ item, onClose, onUpdate \}: \{ item: DriveItem; onClose: \(\) => void; onUpdate: \(item: DriveItem\) => void \}\) \{/,
  "function ShareModal({ item, onClose, onUpdate }: { item: DriveItem; onClose: () => void; onUpdate: (item: DriveItem) => void }) {\n  const user = useAuthStore(s => s.user)"
);

// Fix 2: ctxItem
content = content.replace(/const ctxItem = ctx \? items\.find\(i => i\.id === ctx\.itemId\) \?\? \[\]\.find\(i => i\.id === ctx\.itemId\) : null/, 
  "const ctxItem = ctx ? items.find(i => i.id === ctx.itemId) : null"
);

// Fix 3: FileGrid user
content = content.replace(/function FileGrid\(\{ items, allItems, selected, section, onSelect, onOpen, onCtx, onStar, onShare, onTrash \}: \{[\s\S]*?\}\) \{/, 
  match => match + "\n  const user = useAuthStore(s => s.user)"
);

// Fix 4: FileList user
content = content.replace(/function FileList\(\{ items, allItems, selected, section, onSelect, onOpen, onCtx, onStar, onShare, onTrash \}: \{[\s\S]*?\}\) \{/, 
  match => match + "\n  const user = useAuthStore(s => s.user)"
);

// Fix 5: QUOTA and USED_BYTES
content = content.replace(/const \[items, setItems\] = useState<DriveItem\[\]>\(\[\]\)/, 
  "const QUOTA = 15 * 1024 ** 3;\n  const [items, setItems] = useState<DriveItem[]>([])\n  const USED_BYTES = items.reduce((acc, i) => acc + i.size, 0);"
);

// Also remove unused icons that are causing warnings
content = content.replace(/File,\s*Upload, Download, Plus, Search, Star, Share2, Trash2, MoreVertical,\s*LayoutGrid, List, ChevronRight, Clock, Users, X, Copy, Link, Eye,\s*EyeOff, Calendar, Lock, RotateCcw, Pencil, ArrowLeft, Home,\s*ZoomIn, ZoomOut, ChevronLeft, CloudUpload, Globe, Shield, FolderPlus,\s*Check, AlertTriangle, Move, LogOut, Settings, HelpCircle, Bell,\s*ChevronDown, Play, Pause, Volume2, VolumeX, Maximize2, SkipBack,\s*SkipForward, CheckCircle2/,
  "Upload, Download, Plus, Search, Star, Share2, Trash2, LayoutGrid, List, ChevronRight, Clock, Users, X, Copy, Link, Eye, EyeOff, Calendar, Lock, RotateCcw, Pencil, Home, ZoomIn, ZoomOut, ChevronLeft, CloudUpload, Globe, FolderPlus, Check, AlertTriangle, Move, Settings, HelpCircle, Bell, ChevronDown, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, CheckCircle2"
);

fs.writeFileSync(file, content);
console.log('Fix script completed');
