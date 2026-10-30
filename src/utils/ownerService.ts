import type { GlobalAppUpdate, OwnerSession } from '../types/owner';

export const OWNER_TOKEN_STORAGE_KEY = 'mgc_owner_token_v1';
export const OWNER_EMAIL_DEFAULT = 'ahmadsyarif08@admin.sd.belajar.id';

export function getStoredOwnerSession(): OwnerSession | null {
  try {
    const raw = localStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as OwnerSession;
    if (session && session.token && session.expiresAt > Date.now()) {
      return session;
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

export function saveOwnerSession(session: OwnerSession): void {
  try {
    localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage write error
  }
}

export function clearOwnerSession(): void {
  try {
    localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage write error
  }
}

export async function loginAsOwner(
  email: string,
  passkey: string
): Promise<{ success: boolean; session?: OwnerSession; message: string }> {
  try {
    const res = await fetch('/api/owner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), passkey: passkey.trim() }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'Login gagal: Email atau kata sandi pemilik tidak sesuai.',
      };
    }

    const session: OwnerSession = {
      token: data.token,
      email: data.owner.email,
      name: data.owner.name,
      role: 'OWNER',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    saveOwnerSession(session);

    return {
      success: true,
      session,
      message: 'Berhasil login sebagai Pemilik Aplikasi!',
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal menghubungi server: ${err instanceof Error ? err.message : 'Kesalahan jaringan'}`,
    };
  }
}

export async function verifyOwnerSession(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/owner/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return Boolean(res.ok && data.valid);
  } catch {
    return false;
  }
}

export async function fetchGlobalUpdates(): Promise<GlobalAppUpdate[]> {
  try {
    const res = await fetch('/api/updates');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.updates) ? data.updates : [];
  } catch {
    return [];
  }
}

export async function publishGlobalUpdate(
  token: string,
  update: {
    version: string;
    title: string;
    category: string;
    summary: string;
    details: string[];
    giftCoins?: number;
    giftTickets?: number;
  }
): Promise<{ success: boolean; update?: GlobalAppUpdate; message: string }> {
  try {
    const res = await fetch('/api/owner/updates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(update),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'Gagal mempublikasikan pembaruan.' };
    }

    return {
      success: true,
      update: data.update,
      message: 'Pembaruan aplikasi berhasil dipublikasikan dan disiarkan ke semua pengguna!',
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal mengirim pembaruan: ${err instanceof Error ? err.message : 'Kesalahan jaringan'}`,
    };
  }
}

export async function deleteGlobalUpdate(
  token: string,
  updateId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/owner/updates/${updateId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return {
      success: Boolean(res.ok && data.success),
      message: data.message || (res.ok ? 'Pembaruan dihapus' : 'Gagal menghapus pembaruan'),
    };
  } catch (err) {
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function broadcastImmediateAnnouncement(
  token: string,
  title: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/owner/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, message }),
    });

    const data = await res.json();
    return {
      success: Boolean(res.ok && data.success),
      message: data.message || 'Pengumuman instan berhasil disiarkan ke semua pengguna aktif!',
    };
  } catch (err) {
    return { success: false, message: 'Gagal mengirim siaran instan.' };
  }
}
