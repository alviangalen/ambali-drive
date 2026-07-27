import { useAuthStore } from '../store/authStore';

const BASE_URL = '/api/files';

function getHeaders() {
  const token = useAuthStore.getState().token;
  return {
    'Authorization': `Bearer ${token}`
  };
}

export async function fetchFiles(parentId: string | null = null, trashed: boolean = false) {
  let url = `${BASE_URL}?trashed=${trashed}`;
  if (parentId) url += `&parentId=${parentId}`;
  
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

export async function uploadFile(file: File, parentId: string | null = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (parentId) formData.append('parentId', parentId);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: getHeaders(), // Don't set Content-Type for FormData, browser does it with boundary
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload file');
  return res.json();
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
