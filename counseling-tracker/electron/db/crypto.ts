// DB 파일 암호화 유틸 (electron 의존 없음 — 순수 node라 테스트 가능)
//
// 방식:
// - 키 파일(db.key, 32바이트 랜덤, 권한 0600)을 userData에 1회 생성
// - AES-256-GCM으로 DB 스냅샷 전체를 암호화해 counseling.db.enc에 저장
// - 파일 형식: MAGIC(8) + iv(12) + authTag(16) + ciphertext
//
// 이로써 DB 파일을 실수로 복사·동기화·메일 첨부해도 내용이 드러나지 않는다.
// (PC 자체에 대한 물리적 접근은 OS 계정 보안의 영역)
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAGIC = Buffer.from('CSELDB1\n', 'ascii');
const IV_LEN = 12;
const TAG_LEN = 16;

export function loadOrCreateKey(keyFilePath: string): Buffer {
  if (fs.existsSync(keyFilePath)) {
    const key = fs.readFileSync(keyFilePath);
    if (key.length === 32) return key;
  }
  const key = randomBytes(32);
  fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });
  fs.writeFileSync(keyFilePath, key, { mode: 0o600 });
  try {
    fs.chmodSync(keyFilePath, 0o600);
  } catch {
    /* Windows 등에서는 무시 */
  }
  return key;
}

export function encryptBuffer(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ct]);
}

export function decryptBuffer(blob: Buffer, key: Buffer): Buffer {
  if (blob.length < MAGIC.length + IV_LEN + TAG_LEN || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('올바른 암호화 파일이 아닙니다.');
  }
  const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = blob.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN);
  const ct = blob.subarray(MAGIC.length + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function isEncryptedFile(blob: Buffer): boolean {
  return blob.length >= MAGIC.length && blob.subarray(0, MAGIC.length).equals(MAGIC);
}

// 원자적 파일 쓰기: 임시 파일에 먼저 쓰고 rename — 저장 중 크래시에도 기존 파일이 손상되지 않는다.
export function atomicWriteFileSync(filePath: string, data: Buffer) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, data);
  fs.renameSync(tmpPath, filePath);
}
