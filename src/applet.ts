
import { SamBA } from "./samba";

export abstract class Applet {

  /**
   * Create a flasher
   *
   * @param samba SamBA instance handling IO with board
   * @param addr Flash base address
   * @param size Page size in bytes
   * @param user Address in SRAM where the applet and buffers will be placed
   */
  constructor(
    samba: SamBA,
    addr: number,
    code: Uint8Array,
    size: number,
    start: number,
    stack: number,
    reset: number) {

    this._samba = samba;
    this._addr = addr;
    this._size = size;
    this._start = start;
    this._stack = stack;
    this._reset = reset;
    this._code = code;

    this._installed = false;
  }

  get size() : number { return this._size; }
  get addr() : number { return this._addr; }

  protected _samba : SamBA;
  protected _addr : number; // Address in device SRAM where will be placed the applet
  protected _size : number; // Applet size
  protected _start : number; //
  protected _stack : number; // Applet stack address in device SRAM
  protected _reset : number;
  protected _code: Uint8Array;

  protected _installed : boolean;

  protected async checkInstall() : Promise<void> {
    if (!this._installed) {
      await this._samba.write(this._addr, this._code, this._size);

      this._installed = true;
    }
  }
  async setStack(stack: number) : Promise<void> {
    // Check if applet is already on the board and install if not
    await this.checkInstall();
    await this._samba.writeWord(this._stack, stack);
  }

  // To be used for Thumb-1 based devices (ARM7TDMI, ARM9)
  async run() : Promise<void> {
    // Check if applet is already on the board and install if not
    await this.checkInstall();
    // Add one to the start address for Thumb mode
    await this._samba.go(this._start + 1);
  }

  // To be used for Thumb-2 based devices (Cortex-Mx)
  async runv() : Promise<void> {
    // Check if applet is already on the board and install if not
    await this.checkInstall();
    // Add one to the start address for Thumb mode
    await this._samba.writeWord(this._reset, this._start + 1);

    // The stack is the first reset vector
    await this._samba.go(this._stack);
  }
}
