// Encrypted session-storage adapter — KAN-87 SEC rework #2 (ruling 11015).
//
// Threat model: persecuted leaders, device seizure, hostile forensics. SEC's
// bar is "session material does not sit in plaintext on a seized Android
// device." AsyncStorage on Android is SharedPreferences (unencrypted). iOS
// stores it in NSUserDefaults under data-protection-after-first-unlock — also
// recoverable on a seized device.
//
// Pattern: encryption-key-wrap (per SM lean).
//   - One AES-256 key per AsyncStorage key, generated lazily, stored in
//     Expo SecureStore (Keychain on iOS, EncryptedSharedPreferences /
//     Keystore on Android).
//   - Session blob is JSON-stringified, AES-GCM-encrypted with that key,
//     and stored as ciphertext in AsyncStorage.
//   - Forward-resilient: if Supabase's session shape grows past the iOS
//     keychain item-size ceiling (~4KB), the encryption key is small enough
//     to always fit; the bigger ciphertext lives in AsyncStorage.
//
// removeItem deletes both halves: ciphertext from AsyncStorage AND the key
// from SecureStore. Once removed, the data is unrecoverable.
//
// On decryption failure (corrupt blob, missing key, key/ciphertext drift) we
// force-clean both sides and return null so Supabase reinitializes cleanly.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes.js";

// Local UTF-8 helpers — TextEncoder/TextDecoder are global in Hermes (since
// RN 0.74). @noble/ciphers v2 removed bytesToUtf8/utf8ToBytes from /utils so
// we use the built-ins directly.
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const KEY_PREFIX = "replant.session.k.";

// SecureStore on iOS+Android allows [A-Za-z0-9._-] in key names. Sanitize the
// Supabase storage key (which can contain ':' and other characters) before
// using it as a SecureStore key suffix.
function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_");
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getOrCreateKey(name: string): Promise<Uint8Array> {
  const skey = `${KEY_PREFIX}${sanitize(name)}`;
  const existing = await SecureStore.getItemAsync(skey);
  if (existing) return b64ToBytes(existing);
  const fresh = await Crypto.getRandomBytesAsync(32); // AES-256
  await SecureStore.setItemAsync(skey, bytesToB64(fresh));
  return fresh;
}

async function deleteKey(name: string): Promise<void> {
  const skey = `${KEY_PREFIX}${sanitize(name)}`;
  await SecureStore.deleteItemAsync(skey);
}

interface Envelope {
  v: 1;        // envelope schema version — bump if format changes
  iv: string;  // base64 12-byte GCM IV
  ct: string;  // base64 ciphertext + 16-byte GCM auth tag
}

export const secureStorageAdapter = {
  async getItem(name: string): Promise<string | null> {
    try {
      const blob = await AsyncStorage.getItem(name);
      if (!blob) return null;
      const env = JSON.parse(blob) as Envelope;
      if (env.v !== 1) return null;
      const key = await getOrCreateKey(name);
      const iv = b64ToBytes(env.iv);
      const ct = b64ToBytes(env.ct);
      const pt = gcm(key, iv).decrypt(ct);
      return textDecoder.decode(pt);
    } catch {
      // Decryption failure (key/ciphertext drift, corrupt blob, schema bump).
      // Wipe both sides so Supabase reinitializes from a clean slate rather
      // than looping on a stale undecryptable blob.
      await AsyncStorage.removeItem(name).catch(() => {});
      await deleteKey(name).catch(() => {});
      return null;
    }
  },

  async setItem(name: string, value: string): Promise<void> {
    const key = await getOrCreateKey(name);
    const iv = await Crypto.getRandomBytesAsync(12); // 96-bit GCM IV
    const ct = gcm(key, iv).encrypt(textEncoder.encode(value));
    const env: Envelope = { v: 1, iv: bytesToB64(iv), ct: bytesToB64(ct) };
    await AsyncStorage.setItem(name, JSON.stringify(env));
  },

  async removeItem(name: string): Promise<void> {
    await AsyncStorage.removeItem(name);
    await deleteKey(name);
  },
};
