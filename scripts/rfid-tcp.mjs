import net from "node:net";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { ReaderFrames } from "./tcp-framing.mjs";
import { parseRfidReaderMessage, readerReply } from "../src/lib/rfid-reader.ts";

try { process.loadEnvFile(new URL("../.env", import.meta.url)); } catch (error) { if (error.code !== "ENOENT") throw error; }
const approved = JSON.parse(readFileSync(process.env.RFID_READERS_FILE || new URL("../config/readers.json", import.meta.url), "utf8"));
const host = process.env.RFID_TCP_HOST || "0.0.0.0";
const port = Number(process.env.RFID_TCP_PORT || 8080);
const app = process.env.RFID_APP_URL || "http://127.0.0.1:3000";
const scanToken = process.env.RFID_HTTP_TOKEN, gatewayToken = process.env.RFID_GATEWAY_TOKEN;
if (!scanToken || !gatewayToken) throw new Error("Configure RFID_HTTP_TOKEN and RFID_GATEWAY_TOKEN before starting the TCP listener.");
const sessions = new Map();
const gatewayId = randomUUID();
let shuttingDown = false, offlineTimer;
let statusQueue = Promise.resolve();
function report(data) {
  const task = statusQueue.catch(() => {}).then(async () => {
    const response = await fetch(app + "/api/rfid/tcp", {
      method: "POST", headers: { "Content-Type": "application/json", "x-gateway-token": gatewayToken },
      body: JSON.stringify(data), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Connection status update failed");
  });
  statusQueue = task;
  return task;
}
const server = net.createServer((socket) => {
  const ip = socket.remoteAddress?.replace(/^::ffff:/, "");
  const reader = approved.find((item) => item.readerIp === ip);
  if (!reader) { socket.end(readerReply(false, "Reader IP is not approved")); return; }
  sessions.get(reader.deviceNumber)?.destroy();
  sessions.set(reader.deviceNumber, socket);
  socket.setKeepAlive(true, 5000);
  socket.setNoDelay(true);
  const state = { deviceNumber: reader.deviceNumber, readerIp: ip, sourcePort: socket.remotePort, connectionId: randomUUID() };
  const frames = new ReaderFrames(reader.deviceNumber);
  let queued = 0, stopped = false;
  let queue = report({ ...state, action: "connect" }).catch(() => { console.error("Could not report reader connection: " + reader.deviceNumber); });
  let reporting = false;
  const heartbeat = setInterval(() => {
    if (!socket.destroyed && !reporting) {
      reporting = true;
      void report({ ...state, action: "alive" }).catch(() => console.error("Reader status update unavailable")).finally(() => { reporting = false; });
    }
  }, 10000);
  let frameTimer;
  socket.on("data", (chunk) => {
    clearTimeout(frameTimer);
    let packets;
    try { packets = frames.push(chunk); }
    catch { socket.end(readerReply(false, "Reader packet exceeds limit")); return; }
    if (frames.buffer.trim()) frameTimer = setTimeout(() => { if (!socket.destroyed) socket.end(readerReply(false, "Incomplete reader packet")); }, 5000);
    for (const raw of packets) {
      if (++queued > 32) { socket.destroy(); return; }
      queue = queue.then(async () => {
        if (socket.destroyed) return;
        const parsed = parseRfidReaderMessage(raw);
        if (!parsed || parsed.deviceNumber !== reader.deviceNumber) { socket.write(readerReply(false, "Reader packet does not match approved device")); return; }
        try {
          const response = await fetch(app + "/test", {
            method: "POST", headers: { "Content-Type": "text/html; charset=UTF-8", "x-reader-token": scanToken },
            body: raw, signal: AbortSignal.timeout(25000),
          });
          const reply = await response.text();
          if (!response.ok || !/^code=000[01]&&desc=[^\r\n]*$/.test(reply)) throw new Error("Invalid parking server response");
          if (!socket.destroyed) socket.write(reply);
        } catch { if (!socket.destroyed) socket.write(readerReply(false, "Parking server unavailable")); }
      }).catch(() => { if (!socket.destroyed) socket.write(readerReply(false, "Reader processing failed")); })
        .finally(() => { queued--; });
    }
  });
  function close() {
    if (stopped) return;
    stopped = true; clearInterval(heartbeat); clearTimeout(frameTimer);
    if (sessions.get(reader.deviceNumber) === socket) sessions.delete(reader.deviceNumber);
    void report({ ...state, action: "disconnect" }).catch(() => console.error("Could not report reader disconnection"));
    console.log("Reader disconnected: " + reader.deviceNumber);
  }
  socket.on("close", close);
  socket.on("error", () => socket.destroy());
  console.log("Reader connected: " + reader.deviceNumber + " (" + ip + ")");
});
async function reportOffline() {
  for (const reader of approved) {
    if (shuttingDown) return;
    if (!sessions.has(reader.deviceNumber)) await report({ deviceNumber: reader.deviceNumber, readerIp: reader.readerIp, connectionId: gatewayId, action: "offline" }).catch(() => console.error("Gateway status update unavailable"));
  }
  if (!shuttingDown) offlineTimer = setTimeout(reportOffline, 10000);
}
server.on("error", (error) => { console.error("TCP listener failed: " + error.code); process.exitCode = 1; shuttingDown = true; clearTimeout(offlineTimer); });
server.listen(port, host, () => { console.log("RFID TCP listener on " + host + ":" + server.address().port); void reportOffline(); });
function stop() {
  shuttingDown = true; clearTimeout(offlineTimer);
  for (const socket of sessions.values()) socket.destroy();
  server.close(() => { void statusQueue.catch(() => {}).finally(() => process.exit()); });
  setTimeout(() => process.exit(), 5000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
