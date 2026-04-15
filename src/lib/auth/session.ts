/**
 * Session management using AES-256-GCM encrypted cookies.
 * No extra dependencies — pure Node.js crypto.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ass_session";
const ALGORITHM = "aes-256-gcm";

export interface SessionUser {
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

export interface Session {
  github_token: string;
  user: SessionUser;
}

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET environment variable is not set. " +
      "Set it to a random string of at least 32 characters before starting the server."
    );
  }
  const buf = Buffer.alloc(32, 0);
  Buffer.from(secret, "utf8").copy(buf);
  return buf;
}

export function encryptSession(session: Session): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSession(token: string): Session | null {
  try {
    const key = getKey();
    const data = Buffer.from(token, "base64url");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const val = jar.get(COOKIE_NAME)?.value;
  if (!val) return null;
  return decryptSession(val);
}

export function makeSessionCookie(session: Session): string {
  return encryptSession(session);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
