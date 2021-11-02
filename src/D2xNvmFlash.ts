
import { Flash } from './flash';
import { SamBA } from './samba';

// CMDEX field should be 0xA5 to allow execution of any command.
const CMDEX_KEY                 :  number =    0xa500;

// NVM ready bit mask
const NVM_INT_STATUS_READY_MASK :  number =    0x1;

// NVM status mask
const NVM_CTRL_STATUS_MASK      :  number =    0xFFEB;

const NVM_REG_BASE              :  number =    0x41004000;

const NVM_REG_CTRLA   :  number =    0x00;
const NVM_REG_CTRLB   :  number =    0x04;
const NVM_REG_INTFLAG :  number =    0x14;
const NVM_REG_STATUS  :  number =    0x18;
const NVM_REG_ADDR    :  number =    0x1c;
const NVM_REG_LOCK    :  number =    0x20;

const NVM_CMD_ER      :  number =    0x02;
const NVM_CMD_WP      :  number =    0x04;
const NVM_CMD_EAR     :  number =    0x05;
const NVM_CMD_WAP     :  number =    0x06;
const NVM_CMD_LR      :  number =    0x40;
const NVM_CMD_UR      :  number =    0x41;
const NVM_CMD_SSB     :  number =    0x45;
const NVM_CMD_PBC     :  number =    0x44;

const ERASE_ROW_PAGES :  number =    4;   // pages

// NVM User Row
const NVM_UR_ADDR                 :  number =    0x804000;
const NVM_UR_BOD33_ENABLE_OFFSET  :  number =    0x1;
const NVM_UR_BOD33_ENABLE_MASK    :  number =    0x6;
const NVM_UR_BOD33_RESET_OFFSET   :  number =    0x1;
const NVM_UR_BOD33_RESET_MASK     :  number =    0x7;
const NVM_UR_NVM_LOCK_OFFSET      :  number =    0x6;

export class FlashEraseError extends Error {

  constructor(msg: string | undefined = undefined ) {
    super(msg);
  }
}

export class FlashCmdError extends Error {

  constructor(msg: string | undefined = undefined ) {
    super(msg);
  }
}

export class FlashPageError extends Error {

  constructor(msg: string | undefined = undefined ) {
    super(msg);
  }
}

export class D2xNvmFlash extends Flash {

  protected _eraseAuto: boolean;

  constructor(
    samba: SamBA,
    name: string,
    pages: number,
    size: number,
    user: number,
    stack: number) {

    super(samba, name, 0, pages, size, 1, 16, user, stack);

    this._eraseAuto = true;
  }

  protected get NVM_UR_SIZE() {
    return this._size * ERASE_ROW_PAGES
  }

  protected async erase(offset: number, size: number) : Promise<void> {
    let eraseSize: number  = this._size * ERASE_ROW_PAGES;

    // Offset must be a multiple of the erase size
    if (offset % eraseSize)
      throw new FlashEraseError();

    // Offset and size must be in range
    if (offset + size > this.totalSize)
      throw new FlashEraseError();

    let eraseEnd: number  = (offset + size + eraseSize - 1) / eraseSize;

    // Erase each erase size set of pages
    for (var eraseNum: number  = offset / eraseSize; eraseNum < eraseEnd; eraseNum++) {
      await this.waitReady();

      // Clear error bits
      let statusReg: number  = await this.readReg(NVM_REG_STATUS);
      await this.writeReg(NVM_REG_STATUS, statusReg | NVM_CTRL_STATUS_MASK);

      // Issue erase command
      let wordAddr: number = (eraseNum * eraseSize) / 2;
      await this.writeReg(NVM_REG_ADDR, wordAddr);
      await this.command(NVM_CMD_ER);
    }
  }

  async eraseAll(offset: number) : Promise<void> {
    // Use the extended Samba command if available
    if (this._samba.canChipErase)
    {
      await this._samba.chipErase(offset);
    }
    else
    {
      await this.erase(offset, this.totalSize - offset);
    }
  }

  public get eraseAuto() : boolean {
    return this._eraseAuto;
  }

  public set eraseAuto(enable: boolean) {
    this._eraseAuto = enable;
  }

  async getLockRegions() : Promise<Array<boolean>> {
    var lockBits: number = 0;
    let addr: number = NVM_UR_ADDR + NVM_UR_NVM_LOCK_OFFSET;
    var regions = new Array<boolean>(this._lockRegions);

    for (var region = 0; region < this._lockRegions; region++) {
      if (region % 8 == 0)
        lockBits = await this._samba.readByte(addr++);

      regions[region] = (lockBits & (1 << (region % 8))) == 0;
    }

    return regions;
  }

  async getSecurity(): Promise<boolean> {
    let reg = await this.readReg(NVM_REG_STATUS);
    return (reg & 0x100) != 0;
  }

  async getBod() : Promise<boolean> {
    let byte = await this._samba.readByte(NVM_UR_ADDR + NVM_UR_BOD33_ENABLE_OFFSET);

    return (byte & NVM_UR_BOD33_ENABLE_MASK) != 0;
  }

  canBod() : boolean { return true; }

  async getBor() : Promise<boolean> {
    let byte = await this._samba.readByte(NVM_UR_ADDR + NVM_UR_BOD33_RESET_OFFSET);

    return (byte & NVM_UR_BOD33_RESET_MASK) != 0;
  }

  canBor() : boolean { return true; }

  getBootFlash() : boolean { return true; }
  canBootFlash() : boolean { return false; }

  async readUserRow(userRow: Uint8Array) : Promise<void> {
    if (userRow.length != this.NVM_UR_SIZE)
      throw new Error('Invalid row buffer size');

    await this._samba.read(NVM_UR_ADDR, userRow, this.NVM_UR_SIZE);
  }

  async writeOptions() : Promise<void> {

    var userRow = new Uint8Array(this.NVM_UR_SIZE);

    if (this.canBor() && this._bor.isDirty() && this._bor.get() != await this.getBor())
    {
      await this.readUserRow( userRow );

      if (this._bor.get())
        userRow[NVM_UR_BOD33_RESET_OFFSET] |= NVM_UR_BOD33_RESET_MASK;
      else
        userRow[NVM_UR_BOD33_RESET_OFFSET] &= ~NVM_UR_BOD33_RESET_MASK;
    }

    if (this.canBod() && this._bod.isDirty() && this._bod.get() != await this.getBod())
    {
      await this.readUserRow(userRow);

      if (this._bod.get())
        userRow[NVM_UR_BOD33_ENABLE_OFFSET] |= NVM_UR_BOD33_ENABLE_MASK;
      else
        userRow[NVM_UR_BOD33_ENABLE_OFFSET] &= ~NVM_UR_BOD33_ENABLE_MASK;
    }

    if (this._regions.isDirty()) {
      // Check if any lock bits are different from the current set
      var current: Array<boolean> = await this.getLockRegions();

      var regions = this._regions.get();
      var equal = true;
      for (var i = 0; i < regions.length && equal; i++) {
        equal &&= (regions[ i ] == current[ i ]);
      }
      if (!equal) {
        await this.readUserRow(userRow);

        for (var region: number = 0; region < this._regions.get().length; region++) {
          if (this._regions.get()[region])
            userRow[NVM_UR_NVM_LOCK_OFFSET + region / 8] &= ~(1 << (region % 8));
          else
            userRow[NVM_UR_NVM_LOCK_OFFSET + region / 8] |= (1 << (region % 8));
        }
      }
    }

    // Erase and write the user row if modified
    if (userRow)
    {
      // Disable cache and configure manual page write
      await this.writeReg(NVM_REG_CTRLB, (await this.readReg(NVM_REG_CTRLB)) | (0x1 << 18) | (0x1 << 7));

      // Erase user row
      await this.writeReg(NVM_REG_ADDR, NVM_UR_ADDR / 2);
      await this.command(NVM_CMD_EAR);

      // Write user row in page chunks
      for (var offset = 0; offset < this.NVM_UR_SIZE; offset += this._size)
      {
        // Load the buffer with the page
        await this.loadBuffer(userRow, offset, this._size);

        // Clear page buffer
        await this.command(NVM_CMD_PBC);

        // Copy page to page buffer
        await this.prepareApplet();
        await this._wordCopy.setDstAddr(NVM_UR_ADDR + offset);
        await this._wordCopy.setSrcAddr(this._onBufferA ? this._pageBufferA : this._pageBufferB);
        this._onBufferA = !this._onBufferA;
        await this.waitReady();
        await this._wordCopy.runv();

        // Write the page
        await this.writeReg(NVM_REG_ADDR, (NVM_UR_ADDR + offset) / 2);
        await this.command(NVM_CMD_WAP);
      }
    }

    // Always do security last
    if (this._security.isDirty() && this._security.get() == true && this._security.get() != await this.getSecurity())
    {
      await this.command(NVM_CMD_SSB);
    }
  }

  async writePage(page: number) : Promise<void> {

    if (page >= this._pages) {
      throw new FlashPageError();
    }

    // Disable cache and configure manual page write
    await this.writeReg(NVM_REG_CTRLB, (await this.readReg(NVM_REG_CTRLB)) | (0x1 << 18) | (0x1 << 7));

    // Auto-erase if writing at the start of the erase page
    if (this.eraseAuto && page % ERASE_ROW_PAGES == 0)
      await this.erase(page * this._size, ERASE_ROW_PAGES * this._size);

    // Clear page buffer
    await this.command(NVM_CMD_PBC);

    // Compute the start address.
    let addr = this._addr + (page * this._size);

    await this.prepareApplet();
    await this._wordCopy.setDstAddr(addr);
    await this._wordCopy.setSrcAddr(this._onBufferA ? this._pageBufferA : this._pageBufferB);
    this._onBufferA = !this._onBufferA;
    await this.waitReady();
    await this._wordCopy.runv();

    await this.writeReg(NVM_REG_ADDR, addr / 2);
    await this.command(NVM_CMD_WP);
  }

  async waitReady() : Promise<void> {
    while (((await this.readReg(NVM_REG_INTFLAG)) & 0x1) == 0);
  }

  async readPage(page: number, buf: Uint8Array) : Promise<void> {

    if (page >= this._pages) {
      throw new FlashPageError();
    }

    await this._samba.read(this._addr + (page * this._size), buf, this._size);
  }

  async readReg(reg: number) : Promise<number> {
    return await this._samba.readWord(NVM_REG_BASE + reg);
  }

  async writeReg(reg: number, value: number) : Promise<void> {
    await this._samba.writeWord(NVM_REG_BASE + reg, value);
  }

  async command(cmd: number) : Promise<void> {

    await this.waitReady();

    await this.writeReg(NVM_REG_CTRLA, CMDEX_KEY | cmd);

    await this.waitReady();

    if ((await this.readReg(NVM_REG_INTFLAG)) & 0x2) {
      // Clear the error bit
      await this.writeReg(NVM_REG_INTFLAG, 0x2);
      throw new FlashCmdError();
    }
  }

  async writeBuffer(dst_addr: number, size: number) : Promise<void> {

    // Auto-erase if enabled
    if (this.eraseAuto)
      await this.erase(dst_addr, size);

    // Call the base class method
    await super.writeBuffer(dst_addr, size);
  }
}
