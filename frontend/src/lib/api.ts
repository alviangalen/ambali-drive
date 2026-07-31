import { useAuthStore } from '../store/authStore';

const BASE_URL = '/api/files';

function getHeaders() {
  const token = useAuthStore.getState().token;
  return {
    'Authorization': `Bearer ${token}`
  };
}

export async function fetchFiles(parentId: string | null = null, trashed: boolean = false, all: boolean = false) {
  let url = `${BASE_URL}?trashed=${trashed}`;
  if (parentId && !all) url += `&parentId=${parentId}`;
  if (all) url += `&all=true`;
  
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch files');
  return res.json();
}

export async function createFolder(name: string, parentId: string | null = null) {
  const res = await fetch(`${BASE_URL}/folder`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId })
  });
  if (!res.ok) throw new Error('Failed to create folder');
  return res.json();
}

export async function uploadFile(file: File, parentId: string | null = null, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<any> {
  const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = Date.now().toString() + '-' + Math.round(Math.random() * 1E9);
  
  if (totalChunks === 0) {
    throw new Error('File is empty');
  }

  let responseData: any = null;

  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) {
      throw new Error('Upload canceled');
    }

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('file', chunk, file.name);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('filename', file.name);
    formData.append('mimeType', file.type);
    formData.append('totalSize', file.size.toString());
    if (parentId) formData.append('parentId', parentId);

    responseData = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/upload-chunk`);
      
      const headers = getHeaders();
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key as keyof typeof headers]);
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload canceled'));
        });
      }

      xhr.upload.onprogress = (e) => {
        if (signal?.aborted) return;
        if (e.lengthComputable && onProgress) {
          const overallLoaded = start + e.loaded;
          const pct = Math.round((overallLoaded / file.size) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(xhr.responseText || 'Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Network Error'));
      xhr.send(formData);
    });
  }

  return responseData.file;
}

export async function renameFile(id: string, name: string) {
  const res = await fetch(`${BASE_URL}/${id}/rename`, {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to rename');
  return res.json();
}

export async function trashFile(id: string) {
  const res = await fetch(`${BASE_URL}/${id}/trash`, {
    method: 'PUT',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to trash');
  return res.json();
}

export async function restoreFile(id: string) {
  const res = await fetch(`${BASE_URL}/${id}/restore`, {
    method: 'PUT',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to restore');
  return res.json();
}

export async function deleteFile(id: string) {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

export async function moveFile(id: string, parentId: string | null) {
  const res = await fetch(`${BASE_URL}/${id}/move`, {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentId })
  });
  if (!res.ok) throw new Error('Failed to move');
  return res.json();
}

export async function copyFile(id: string, parentId: string | null) {
  const res = await fetch(`${BASE_URL}/${id}/copy`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentId })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to copy');
  }
  return res.json();
}

export async function createShareLink(id: string, allowDownload: boolean = true, password?: string | null, expiresAt?: string | null) {
  const res = await fetch(`/api/share/${id}/link`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowDownload, password, expiresAt })
  });
  if (!res.ok) throw new Error('Failed to create share link');
  return res.json();
}

export async function removeShareLink(id: string) {
  const res = await fetch(`/api/share/${id}/link`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to remove share link');
  return res.json();
}

export async function getPublicFile(hash: string, password?: string) {
  let url = `/api/share/public/${hash}`;
  if (password) {
    url += `?password=${encodeURIComponent(password)}`;
  }
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw error;
  }
  return res.json();
}

export async function getStorageUsed() {
  const res = await fetch('/api/files/storage', { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch storage');
  return res.json();
}

// --- Admin API ---
export async function getAdminUsers() {
  const res = await fetch('/api/admin/users', { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function blockUser(id: string, isBlocked: boolean) {
  const res = await fetch(`/api/admin/users/${id}/block`, {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ isBlocked })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update user');
  }
  return res.json();
}

export async function updateUserQuota(id: string, quotaBytes: number) {
  const res = await fetch(`/api/admin/users/${id}/quota`, {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ quotaBytes })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update user quota');
  }
  return res.json();
}

export async function getAdminLogs() {
  const res = await fetch('/api/admin/logs', { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function getAdminStats() {
  const res = await fetch('/api/admin/stats', { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function changeAdminPassword(oldPassword: string, newPassword: string) {
  const res = await fetch('/api/admin/change-password', {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to change password');
  }
  return res.json();
}

export async function updateProfile(name?: string, oldPassword?: string, newPassword?: string) {
  const res = await fetch('/api/auth/profile', {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, oldPassword, newPassword })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update profile');
  }
  return res.json();
}

export async function getSessions() {
  const res = await fetch('/api/auth/sessions', {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function revokeSession(id: string) {
  const res = await fetch(`/api/auth/sessions/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to revoke session');
  return res.json();
}
