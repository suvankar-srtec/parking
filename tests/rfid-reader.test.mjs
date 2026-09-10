import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRfidReaderMessage } from '../src/lib/rfid-reader.ts';

test('parses Vgdecoderresult and device number from the reader payload', () => {
  const parsed = parseRfidReaderMessage('Vgdecoderresult = 123456&& devicenumber = 22110001');

  assert.deepStrictEqual(parsed, {
    decodedResult: '123456',
    deviceNumber: '22110001',
  });
});

test('accepts the alternate packet format with trimmed spaces', () => {
  const parsed = parseRfidReaderMessage('Vgdecoderresult=ABC123&&devicenumber=RDR-7');

  assert.deepStrictEqual(parsed, {
    decodedResult: 'ABC123',
    deviceNumber: '22110002',
  });
});
