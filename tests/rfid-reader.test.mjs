import test from "node:test";
import assert from "node:assert/strict";
import { parseRfidReaderMessage, readerReply, readReaderBody, normalizeCard } from "../src/lib/rfid-reader.ts";
import { ReaderFrames } from "../scripts/tcp-framing.mjs";
import { readerStatus } from "../src/lib/reader-status.ts";

test("parses both documented and firmware spellings without changing card bytes", () => {
  for (const key of ["vgdecoderresult", "vgdecoderesult"]) {
    assert.deepEqual(parseRfidReaderMessage(key + "=00Ab12&& devicenumber = 22110001"), { decodedResult: "00Ab12", deviceNumber: "22110001" });
    assert.deepEqual(parseRfidReaderMessage(key + "59807c0edevicenumber22110002otherparams"), { decodedResult: "59807c0e", deviceNumber: "22110002" });
  }
  assert.equal(normalizeCard(" 00Ab12 "), "00AB12");
  assert.equal(parseRfidReaderMessage("Vgdecoderresult=ABC123&&devicenumber=RDR-7").deviceNumber, "RDR-7");
});
test("rejects missing, ambiguous, oversized and malformed packets", () => {
  for (const raw of ["", "vgdecoderresult=A", "devicenumber=22110001", "vgdecoderresult=A&&vgdecoderesult=B&&devicenumber=22110001",
    "vgdecoderresult=%ZZ&&devicenumber=22110001", "vgdecoderresult=%00&&devicenumber=22110001",
    "vgdecoderesultAAdevicenumber22110001", "vgdecoderresult=" + "A".repeat(129) + "&&devicenumber=22110001",
    "vgdecoderresult=A&&devicenumber=bad/device"]) assert.equal(parseRfidReaderMessage(raw), null, raw);
});
test("success/failure responses follow the reader LED contract", () => {
  assert.equal(readerReply(true, "Parking allowed"), "code=0000&&desc=Parking allowed");
  assert.equal(readerReply(true, "Vehicle checked out"), "code=0000&&desc=Vehicle checked out");
  assert.equal(readerReply(false, "RFID card is not registered"), "code=0001&&desc=RFID card is not registered");
  assert.ok(!readerReply(false, "bad\r\n&&code=0000").includes("&&code="));
});
test("HTTP input rejects bodies over 4096 bytes", async () => {
  await assert.rejects(readReaderBody(new Request("http://localhost/test", { method: "POST", body: "A".repeat(4097) })));
});
test("TCP framing handles every split position and combined packets", () => {
  const packets = ["vgdecoderresult=D9E07D0E&&devicenumber=22110001", "vgdecoderesultD9E07D0Edevicenumber22110001otherparams"];
  for (const packet of packets) for (let split = 1; split < packet.length; split++) {
    const frames = new ReaderFrames("22110001");
    assert.deepEqual(frames.push(Buffer.from(packet.slice(0, split))), []);
    assert.deepEqual(frames.push(Buffer.from(packet.slice(split))), [packet]);
    assert.equal(frames.buffer, "");
  }
  const frames = new ReaderFrames("22110001");
  assert.deepEqual(frames.push(Buffer.from(packets.join("") + "\r\n")), packets);
  assert.throws(() => frames.push(Buffer.alloc(8193, 65)));
});
test("TCP state never calls stale gateway reports connected", () => {
  const now = Date.now();
  const base = { connectionType: "TCP", tcpConnected: true, lastGatewaySeenAt: new Date(now).toISOString(), lastSeenAt: null, heartbeatSeconds: 0 };
  assert.equal(readerStatus(base, now).label, "Connected");
  assert.equal(readerStatus({ ...base, tcpConnected: false }, now).label, "Disconnected");
  assert.equal(readerStatus(base, now + 45001).label, "Gateway unavailable");
  assert.equal(readerStatus({ ...base, lastGatewaySeenAt: null }, now).tone, "unknown");
});
