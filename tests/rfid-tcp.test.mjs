import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

async function until(check, timeout = 5000) {
  const started = Date.now();
  while (!check()) { if (Date.now() - started > timeout) throw Error("Timed out waiting for gateway"); await new Promise(r => setTimeout(r, 25)); }
}
test("real TCP gateway forwards scans, handles framing and reports actual socket lifecycle", { timeout: 20000 }, async () => {
  const statuses = [], scans = [];
  let mode = "success";
  const app = http.createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    if (req.url === "/api/rfid/tcp") {
      assert.equal(req.headers["x-gateway-token"], "test-gateway-token");
      statuses.push(JSON.parse(body)); res.end("{}"); return;
    }
    assert.equal(req.headers["x-reader-token"], "test-reader-token");
    scans.push(body);
    if (mode === "invalid") { res.end("<html>Error</html>"); return; }
    res.end(mode === "denied" ? "code=0001&&desc=RFID card is not registered" : "code=0000&&desc=Parking allowed");
  });
  app.listen(0, "127.0.0.1"); await once(app, "listening");
  const dir = await mkdtemp(path.join(tmpdir(), "parking-rfid-test-"));
  const config = path.join(dir, "readers.json");
  await writeFile(config, JSON.stringify([{ deviceNumber: "22110001", readerIp: "127.0.0.1" }]));
  const child = spawn(process.execPath, ["scripts/rfid-tcp.mjs"], {
    cwd: process.cwd(), windowsHide: true,
    env: { ...process.env, RFID_READERS_FILE: config, RFID_HTTP_TOKEN: "test-reader-token", RFID_GATEWAY_TOKEN: "test-gateway-token",
      RFID_APP_URL: "http://127.0.0.1:" + app.address().port, RFID_TCP_HOST: "127.0.0.1", RFID_TCP_PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "", errors = ""; child.stdout.on("data", d => output += d); child.stderr.on("data", d => errors += d);
  let socket;
  try {
    await until(() => /listener on 127.0.0.1:\d+/.test(output) || child.exitCode !== null);
    assert.equal(child.exitCode, null, errors);
    const port = Number(/listener on 127.0.0.1:(\d+)/.exec(output)[1]);
    socket = net.connect(port, "127.0.0.1"); await once(socket, "connect");
    let received = ""; socket.on("data", d => received += d);
    await until(() => statuses.some(s => s.action === "connect"));
    await new Promise(r => setTimeout(r, 100));
    assert.equal(received, "", "Connection monitoring must not send hardware success commands");
    async function scan(packet, expected) {
      received = ""; socket.write(packet); await until(() => received.length >= expected.length); assert.equal(received, expected);
    }
    socket.write("vgdecoderesultD9E0"); await new Promise(r => setTimeout(r, 50));
    assert.equal(scans.length, 0);
    await scan("7D0Edevicenumber22110001otherparams", "code=0000&&desc=Parking allowed");
    const packet = "vgdecoderresult=00AA&&devicenumber=22110001";
    await scan(packet + packet, "code=0000&&desc=Parking allowed".repeat(2));
    mode = "denied";
    await scan(packet, "code=0001&&desc=RFID card is not registered");
    mode = "invalid";
    await scan(packet, "code=0001&&desc=Parking server unavailable");
    const count = scans.length;
    await scan("vgdecoderesultAAdevicenumber22110002otherparams", "code=0001&&desc=Reader packet does not match approved device");
    assert.equal(scans.length, count);
    socket.destroy();
    await until(() => statuses.some(s => s.action === "disconnect"));
    const connected = statuses.find(s => s.action === "connect"), disconnected = statuses.find(s => s.action === "disconnect");
    assert.equal(connected.connectionId, disconnected.connectionId);
    assert.ok(connected.sourcePort > 0);
    assert.equal(connected.readerIp, "127.0.0.1");
  } finally {
    socket?.destroy();
    if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
    await new Promise(resolve => app.close(resolve));
    if (!path.basename(dir).startsWith("parking-rfid-test-")) throw Error("Unexpected test cleanup path");
    await rm(dir, { recursive: true, force: true });
  }
});
