import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTIF_STORAGE_KEY = '@gtrash_notifications';

export async function saveNotification(notif) {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      ...notif,
      id: Date.now().toString(),
      read: false,
      receivedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {}
}

export async function getUnreadCount() {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return 0;
    return JSON.parse(raw).filter((n) => !n.read).length;
  } catch { return 0; }
}
