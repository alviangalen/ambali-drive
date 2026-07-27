const fs = require('fs');
const path = require('path');

const filesToFix = ['frontend/src/pages/Login.tsx', 'frontend/src/pages/Register.tsx'];

for (const relPath of filesToFix) {
  const file = path.join(__dirname, relPath);
  let content = fs.readFileSync(file, 'utf8');

  // Add useEffect to react import
  if (!content.includes('useEffect')) {
    content = content.replace(/import\s*\{\s*useState\s*\}\s*from\s*'react'/, "import { useState, useEffect } from 'react'");
  }

  // Add token and useEffect logic
  if (!content.includes('if (token) navigate')) {
    content = content.replace(
      /const navigate = useNavigate\(\);\n\s*const login = useAuthStore\(\(state\) => state\.login\);/,
      `const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      navigate('/drive');
    }
  }, [token, navigate]);`
    );
  }

  fs.writeFileSync(file, content);
}

console.log('Auth redirect logic added.');
