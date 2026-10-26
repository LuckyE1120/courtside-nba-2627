import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectPhotoType, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_GAME, PHOTO_ID_PATTERN } from '../lib/photo.ts';

test('accepts only supported image signatures', () => {
  assert.equal(detectPhotoType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(detectPhotoType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(detectPhotoType(Uint8Array.from(Buffer.from('RIFF0000WEBP'))), 'image/webp');
  assert.equal(detectPhotoType(Uint8Array.from(Buffer.from('<script>'))), null);
});

test('photo references use UUIDs and bounded upload limits', () => {
  assert.match(crypto.randomUUID(), PHOTO_ID_PATTERN);
  assert.equal(PHOTO_ID_PATTERN.test('../other-user/photo'), false);
  assert.equal(MAX_PHOTOS_PER_GAME, 3);
  assert.equal(MAX_PHOTO_BYTES, 2 * 1024 * 1024);
});
