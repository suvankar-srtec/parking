// TCP can split a packet across chunks or combine several packets in one chunk.
export class ReaderFrames {
  constructor(deviceNumber) { this.deviceNumber = deviceNumber; this.buffer = ""; }
  push(chunk) {
    this.buffer += chunk.toString("utf8");
    if (Buffer.byteLength(this.buffer) > 8192) throw new Error("Reader packet exceeds limit");
    const frames = [];
    while (this.buffer.length) {
      this.buffer = this.buffer.replace(/^[\r\n\0\s]+/, "");
      if (!this.buffer) break;
      const marker = /otherparams/i.exec(this.buffer);
      if (marker && !/^vgdecoder{1,2}esult\s*=/i.test(this.buffer)) {
        const end = marker.index + marker[0].length;
        frames.push(this.buffer.slice(0, end)); this.buffer = this.buffer.slice(end); continue;
      }
      const safeNumber = this.deviceNumber.replace(/[^a-zA-Z0-9_-]/g, "");
      const endPattern = new RegExp("devicenumber\\s*=\\s*" + safeNumber + "(?=\\s|$|vgdecode)", "i");
      const endMatch = endPattern.exec(this.buffer);
      if (endMatch) {
        const end = endMatch.index + endMatch[0].length;
        frames.push(this.buffer.slice(0, end)); this.buffer = this.buffer.slice(end); continue;
      }
      const delimiter = /[\r\n\0]/.exec(this.buffer);
      if (delimiter) { frames.push(this.buffer.slice(0, delimiter.index)); this.buffer = this.buffer.slice(delimiter.index + 1); continue; }
      break;
    }
    return frames;
  }
}
