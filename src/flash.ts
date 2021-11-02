
import { WordCopyApplet } from './wordcopyapplet';
import { SamBA } from './samba';

export class FlashConfigError extends Error {

  constructor(msg: string | undefined = undefined ) {
    super(msg);
  }
}
export class FlashRegionError extends Error {

  constructor(msg: string | undefined = undefined ) {
    super(msg);
  }
}

class FlashOption<T>
{
    constructor(value: T) {
      this._dirty = false;
      this._value = value;
    }

    set(value: T) : void {
      this._value = value;
      this._dirty = true;
    }

    get() : T {
      return this._value;
    }

    isDirty() : boolean { return this._dirty; }

    private _value: T;
    private _dirty: boolean;
};

/**
 *
 */
export abstract class Flash {

  /**
   * Create a flasher
   *
   * @param samba SamBA instance handling IO with board
   * @param name Name of the board
   * @param addr Flash base address
   * @param pages Number of pages
   * @param size Page size in bytes
   * @param planes Number of flash planes
   * @param lockRegions Number of flash lock regions
   * @param user Address in SRAM where the applet and buffers will be placed
   * @param stack Address in SRAM where the applet stack will be placed
   */
  constructor(
          samba: SamBA,
          name: string,
          addr: number,
          pages: number,
          size: number,
          planes: number,
          lockRegions: number,
          user: number,
          stack: number) {

    this._samba = samba;
    this._name = name;

    this._addr = addr;
    this._pages = pages;
    this._size = size;
    this._planes = planes;
    this._lockRegions = lockRegions;
    this._user = user;
    this._stack = stack;

    this._bootFlash = new FlashOption<boolean>(true);
    this._bod = new FlashOption<boolean>(true);
    this._bor = new FlashOption<boolean>(true);
    this._security = new FlashOption<boolean>(true);

    this._regions = new FlashOption<Array<boolean>>(new Array<boolean>(0));

    this._wordCopy = new WordCopyApplet(samba, user);

    if (!((size & (size - 1)) == 0)) {
      throw new FlashConfigError();
    }

    if (!((pages & (pages - 1)) == 0)) {
      throw new FlashConfigError();
    }
    
    if (!((lockRegions & (lockRegions - 1)) == 0)) {
      throw new FlashConfigError();
    }

    this._onBufferA = true;

    // page buffers will have the size of a physical page and will be situated right after the applet
    this._pageBufferA = Math.trunc((this._user + this._wordCopy.size + 3) / 4) * 4; // we need to avoid non 32bits aligned access on Cortex-M0+
    this._pageBufferB = this._pageBufferA + size;

  }

  protected _samba: SamBA;
  protected _name: string;
  protected _addr: number;
  protected _pages: number;
  protected _size: number;
  protected _planes: number;
  protected _lockRegions: number;
  protected _user: number;
  protected _stack: number;

  protected _prepared : boolean = false;

  abstract set eraseAuto(enable: boolean);

  get address() { return this._addr; }
  get pageSize() { return this._size; }
  get numPages() { return this._pages; }
  get numPlanes() { return this._planes; }
  get totalSize() { return this._size * this._pages; }
  get lockRegions() { return this._lockRegions; }

  abstract eraseAll(offset: number) : void;

  abstract getLockRegions() : Promise<Array<boolean>>;
  setLockRegions(regions: Array<boolean>) {
    if (regions.length > this._lockRegions)
        throw new FlashRegionError();

    this._regions.set(regions);
  }

  abstract getSecurity() : Promise<boolean>;
  setSecurity() : void {
    this._security.set(true);
  }

  abstract getBod() : Promise<boolean>;
  setBod(enable: boolean) {
    if (this.canBod())
      this._bod.set(enable);
  }
  abstract canBod() : boolean;

  abstract getBor() : Promise<boolean>;
  setBor(enable: boolean) {
    if (this.canBor())
      this._bor.set(enable);
  }
  abstract canBor() : boolean;

  abstract getBootFlash() : boolean;
  setBootFlash(enable: boolean) {
    if (this.canBootFlash())
      this._bootFlash.set(enable);
  }
  abstract canBootFlash() : boolean;

  abstract writeOptions() : void;

  abstract writePage(page: number) : void;
  abstract readPage(page: number, buf: Uint8Array) : Promise<void>;

  async writeBuffer(dst_addr: number, size: number) : Promise<void> {
    await this._samba.writeBuffer(this._onBufferA ? this._pageBufferA : this._pageBufferB, dst_addr + this._addr, size);
  }

  async loadBuffer(data: Uint8Array, offset: number = 0, bufferSize: number = data.length) : Promise<void> {

    if (offset > 0) {
      data = data.subarray(offset);
    }

    await this._samba.write(this._onBufferA ? this._pageBufferA : this._pageBufferB, data, bufferSize);
  }

  async prepareApplet() : Promise<void> {

    if (!this._prepared) {
      await this._wordCopy.setWords(this._size / 4 /* sizeof(uint32_t) */);
      await this._wordCopy.setStack(this._stack);

      this._prepared = true;
    }
  }

  protected _wordCopy: WordCopyApplet;

  protected _bootFlash: FlashOption<boolean>;
  protected _regions : FlashOption<Array<boolean>>;
  protected _bod : FlashOption<boolean>;
  protected _bor : FlashOption<boolean>;
  protected _security : FlashOption<boolean>;

  protected _onBufferA: boolean = true;
  protected _pageBufferA : number = 0;
  protected _pageBufferB : number = 0;
}
