import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  atomicWriteFileSync,
  decryptBuffer,
  encryptBuffer,
  isEncryptedFile,
  loadOrCreateKey
} from '../electron/db/crypto';
import { hashPassword, verifyPassword } from '../electron/auth';

test('키 파일 생성: 32바이트, 재호출 시 동일 키 반환', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csel-key-'));
  const keyPath = path.join(dir, 'db.key');
  const key1 = loadOrCreateKey(keyPath);
  assert.strictEqual(key1.length, 32);
  const key2 = loadOrCreateKey(keyPath);
  assert.deepStrictEqual(key1, key2);
});

test('암호화/복호화 왕복: 내용이 동일하게 복원된다', () => {
  const key = loadOrCreateKey(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csel-')), 'db.key'));
  const plain = Buffer.from('SQLite format 3\0 — 학생상담기록 테스트 데이터 123', 'utf8');
  const enc = encryptBuffer(plain, key);
  assert.ok(isEncryptedFile(enc));
  assert.ok(!enc.includes(plain.subarray(16, 30))); // 평문이 그대로 노출되지 않음
  const dec = decryptBuffer(enc, key);
  assert.deepStrictEqual(dec, plain);
});

test('다른 키로 복호화 시 실패한다', () => {
  const key1 = loadOrCreateKey(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csel-')), 'k1'));
  const key2 = loadOrCreateKey(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csel-')), 'k2'));
  const enc = encryptBuffer(Buffer.from('secret'), key1);
  assert.throws(() => decryptBuffer(enc, key2));
});

test('변조된 암호 파일은 복호화 시 실패한다 (GCM 인증)', () => {
  const key = loadOrCreateKey(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csel-')), 'db.key'));
  const enc = encryptBuffer(Buffer.from('원본 데이터'), key);
  enc[enc.length - 1] ^= 0xff; // 마지막 바이트 변조
  assert.throws(() => decryptBuffer(enc, key));
});

test('매직이 아닌 파일은 isEncryptedFile=false', () => {
  assert.strictEqual(isEncryptedFile(Buffer.from('SQLite format 3\0 ...')), false);
});

test('atomicWrite: 파일 내용이 정확히 기록되고 tmp가 남지 않는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csel-atomic-'));
  const target = path.join(dir, 'out.bin');
  atomicWriteFileSync(target, Buffer.from('hello'));
  assert.deepStrictEqual(fs.readFileSync(target), Buffer.from('hello'));
  assert.strictEqual(fs.existsSync(`${target}.tmp`), false);
});

test('비밀번호 해시: 검증 성공/실패', () => {
  const stored = hashPassword('비밀번호123');
  assert.strictEqual(verifyPassword('비밀번호123', stored), true);
  assert.strictEqual(verifyPassword('다른비밀번호', stored), false);
  assert.strictEqual(verifyPassword('비밀번호123', 'garbage'), false);
  // 같은 비밀번호여도 salt가 달라 해시는 매번 다르다
  assert.notStrictEqual(stored, hashPassword('비밀번호123'));
});
