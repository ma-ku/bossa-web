import { Applet } from "./applet";
import { SamBA } from "./samba";

const applet = {
  // dst_addr
  dst_addr: 0x00000028,
  // reset
  reset: 0x00000024,
  // src_addr
  src_addr: 0x0000002c,
  // stack
  stack: 0x00000020,
  // start
  start: 0x00000000,
  // words
  words: 0x00000030,
  // code
  code: new Uint8Array(
      [
        0x09, 0x48, 0x0a, 0x49, 0x0a, 0x4a, 0x02, 0xe0, 0x08, 0xc9, 0x08, 0xc0, 0x01, 0x3a, 0x00, 0x2a,
        0xfa, 0xd1, 0x04, 0x48, 0x00, 0x28, 0x01, 0xd1, 0x01, 0x48, 0x85, 0x46, 0x70, 0x47, 0xc0, 0x46,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00
      ]
    )
};


export class WordCopyApplet extends Applet {

  constructor(samba: SamBA, addr: number) {
    super(
      samba,
      addr,
      applet.code,
      applet.code.length,
      addr + applet.start,
      addr + applet.stack,
      addr + applet.reset);
  }

  async setDstAddr(dstAddr: number) : Promise<void> {
    // Check if applet is already on the board and install if not
    await this.checkInstall();
    await this._samba.writeWord(this._addr + applet.dst_addr, dstAddr);
  }

  async setSrcAddr(srcAddr: number) : Promise<void> {
    // Check if applet is already on the board and install if not
    await this.checkInstall();
    await this._samba.writeWord(this._addr + applet.src_addr, srcAddr);
  }

  async setWords(words: number) : Promise<void> {
    // Check if applet is already on the board and install if not
    await this.checkInstall();
    await this._samba.writeWord(this._addr + applet.words, words);
  }
}
