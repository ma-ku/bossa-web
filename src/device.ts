
import { SamBA } from "./samba";
import { D2xNvmFlash } from './D2xNvmFlash';
import { D5xNvmFlash } from './D5xNvmFlash';
import { Flash } from './flash';

interface ChipId {
  chipId: number;
  extChipId: number;
}

export enum Family {
    FAMILY_NONE,

    FAMILY_SAM7S,
    FAMILY_SAM7SE,
    FAMILY_SAM7X,
    FAMILY_SAM7XC,
    FAMILY_SAM7L,

    FAMILY_SAM3N,
    FAMILY_SAM3S,
    FAMILY_SAM3U,
    FAMILY_SAM3X,
    FAMILY_SAM3A,

    FAMILY_SAM4S,
    FAMILY_SAM4E,

    FAMILY_SAM9XE,

    FAMILY_SAMD21,
    FAMILY_SAMR21,
    FAMILY_SAML21,

    FAMILY_SAMD51,
    FAMILY_SAME51,
    FAMILY_SAME53,
    FAMILY_SAME54,

    FAMILY_SAME70,
    FAMILY_SAMS70,
    FAMILY_SAMV70,
    FAMILY_SAMV71,
};

export class DeviceUnsupportedError extends Error {

  constructor(msg: string | undefined = undefined ) {
    super(msg);
  }
}

export class Device {

  private _samba: SamBA;

  private _flash: Flash | undefined;
  private _family: Family;
  private _uniqueId: string | undefined;

  constructor(samba: SamBA) {
    this._samba = samba;
    this._flash = undefined;
    this._uniqueId = undefined;
    this._family = Family.FAMILY_NONE;
  }

  async create() : Promise<void> {

    var chipId = 0;
    var cpuId = 0;
    var extChipId = 0;
    var deviceId = 0;

    var flashPtr: Flash | null = null;

    // Device identification must be performed carefully to avoid reading from
    // addresses that devices do not support which will lock up the CPU

    // All devices support addresss 0 as the ARM reset vector so if the vector is
    // a ARM7TDMI branch, then assume we have an Atmel SAM7/9 CHIPID register
    if (((await this._samba.readWord(0x0)) & 0xff000000) == 0xea000000)
    {
        chipId = await this._samba.readWord(0xfffff240);
    }
    else
    {
        // Next try the ARM CPUID register since all Cortex-M devices support it
        cpuId = await this._samba.readWord(0xe000ed00) & 0x0000fff0;

        // Cortex-M0+
        if (cpuId == 0xC600)
        {
            // These should support the ARM device ID register
            deviceId = await this._samba.readWord(0x41002018);
        }
        // Cortex-M4
        else if (cpuId == 0xC240)
        {
            // SAM4 processors have a reset vector to the SAM-BA ROM
            if (((await this._samba.readWord(0x4)) & 0xfff00000) == 0x800000)
            {
              let id = await this.readChipId();
              chipId = id.chipId;
              extChipId = id.extChipId;
            }
            // Else we should have a device that supports the ARM device ID register
            else
            {
                deviceId = await this._samba.readWord(0x41002018);
            }
        }
        // For all other Cortex versions try the Atmel chip ID registers
        else
        {
          let id = await this.readChipId();
          chipId = id.chipId;
          extChipId = id.extChipId;
        }
    }

    // Instantiate the proper flash for the device
    switch (chipId & 0x7fffffe0)
    {
    //
    // SAM7SE
    //
    case 0x272a0a40:
        this._family = Family.FAMILY_SAM7SE;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7SE512", 0x100000, 2048, 256, 2, 32, 0x202000, 0x208000, true);
        break;
    case 0x272a0940:
        this._family = Family.FAMILY_SAM7SE;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7SE256", 0x100000, 1024, 256, 1, 16, 0x202000, 0x208000, true);
        break;
    case 0x272a0340:
        this._family = Family.FAMILY_SAM7SE;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7SE32", 0x100000, 256, 128, 1, 8, 0x201400, 0x201C00, true);
        break;
    //
    // SAM7S
    //
    case 0x270b0a40:
        this._family = Family.FAMILY_SAM7S;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7S512", 0x100000, 2048, 256, 2, 32, 0x202000, 0x210000, false);
        break;
    case 0x270d0940: // A
    case 0x270b0940: // B/C
        this._family = Family.FAMILY_SAM7S;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7S256", 0x100000, 1024, 256, 1, 16, 0x202000, 0x210000, false);
        break;
    case 0x270c0740: // A
    case 0x270a0740: // B/C
        this._family = Family.FAMILY_SAM7S;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7S128", 0x100000, 512, 256, 1, 8, 0x202000, 0x208000, false);
        break;
    case 0x27090540:
        this._family = Family.FAMILY_SAM7S;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7S64", 0x100000, 512, 128, 1, 16, 0x202000, 0x204000, false);
        break;
    case 0x27080340:
        this._family = Family.FAMILY_SAM7S;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7S32", 0x100000, 256, 128, 1, 8, 0x201400, 0x202000, false);
        break;
    case 0x27050240:
        this._family = Family.FAMILY_SAM7S;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAM7S16", 0x100000, 256, 64, 1, 8, 0x200000, 0x200e00, false);
        break;
    //
    // SAM7XC
    //
    case 0x271c0a40:
        this._family = Family.FAMILY_SAM7XC;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAMXC512", 0x100000, 2048, 256, 2, 32, 0x202000, 0x220000, true);
        break;
    case 0x271b0940:
        this._family = Family.FAMILY_SAM7XC;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAMXC256", 0x100000, 1024, 256, 1, 16, 0x202000, 0x210000, true);
        break;
    case 0x271a0740:
        this._family = Family.FAMILY_SAM7XC;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAMXC128", 0x100000, 512, 256, 1, 8, 0x202000, 0x208000, true);
        break;
    //
    // SAM7X
    //
    case 0x275c0a40:
        this._family = Family.FAMILY_SAM7X;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAMX512", 0x100000, 2048, 256, 2, 32, 0x202000, 0x220000, true);
        break;
    case 0x275b0940:
        this._family = Family.FAMILY_SAM7X;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAMX256", 0x100000, 1024, 256, 1, 16, 0x202000, 0x210000, true);
        break;
    case 0x275a0740:
        this._family = Family.FAMILY_SAM7X;
        flashPtr = null; // new EfcFlash(this._samba, "AT91SAMX128", 0x100000, 512, 256, 1, 8, 0x202000, 0x208000, true);
        break;
    //
    // SAM4S
    //
    case 0x29870ee0: // A
    case 0x29970ee0: // B
    case 0x29A70ee0: // C
        this._family = Family.FAMILY_SAM4S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM4SD32", 0x400000, 4096, 512, 2, 256, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    case 0x29870c30: // A
    case 0x29970c30: // B
    case 0x29a70c30: // C
        this._family = Family.FAMILY_SAM4S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM4SD16", 0x400000, 2048, 512, 2, 256, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    case 0x28870ce0: // A
    case 0x28970ce0: // B
    case 0x28A70ce0: // C
        this._family = Family.FAMILY_SAM4S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM4SA16", 0x400000, 2048, 512, 1, 256, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    case 0x288c0ce0 : // A
    case 0x289c0ce0 : // B
    case 0x28ac0ce0 : // C
        this._family = Family.FAMILY_SAM4S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM4S16", 0x400000, 2048, 512, 1, 128, 0x20001000, 0x20020000, 0x400e0a00, false);
        break;
    case 0x288c0ae0 : // A
    case 0x289c0ae0 : // B
    case 0x28ac0ae0 : // C
        this._family = Family.FAMILY_SAM4S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM4S8", 0x400000, 1024, 512, 1, 64, 0x20001000, 0x20020000, 0x400e0a00, false);
        break;
    case 0x288b09e0 : // A
    case 0x289b09e0 : // B
    case 0x28ab09e0 : // C
        this._family = Family.FAMILY_SAM4S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM4S4", 0x400000, 512, 512, 1, 16, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    case 0x288b07e0 : // A
    case 0x289b07e0 : // B
    case 0x28ab07e0 : // C
        this._family = Family.FAMILY_SAM4S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM4S2", 0x400000, 256, 512, 1, 16, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    //
    // SAM3N
    //
    case 0x29340960 : // A
    case 0x29440960 : // B
    case 0x29540960 : // C
        this._family = Family.FAMILY_SAM3N;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3N4", 0x400000, 1024, 256, 1, 16, 0x20001000, 0x20006000, 0x400e0a00, false);
        break;
    case 0x29390760 : // A
    case 0x29490760 : // B
    case 0x29590760 : // C
        this._family = Family.FAMILY_SAM3N;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3N2", 0x400000, 512, 256, 1, 8, 0x20001000, 0x20004000, 0x400e0a00, false);
        break;
    case 0x29380560 : // A
    case 0x29480560 : // B
    case 0x29580560 : // C
        this._family = Family.FAMILY_SAM3N;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3N1", 0x400000, 256, 256, 1, 4, 0x20000800, 0x20002000, 0x400e0a00, false);
        break;
    case 0x29380360 : // A
    case 0x29480360 : // B
    case 0x29580360 : // C
        this._family = Family.FAMILY_SAM3N;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3N0", 0x400000, 128, 256, 1, 1, 0x20000800, 0x20002000, 0x400e0a00, false);
        break;
    //
    // SAM3S
    //
    case 0x299b0a60 : // B
    case 0x29ab0a60 : // C
        this._family = Family.FAMILY_SAM3S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3SD8", 0x400000, 2048, 256, 1, 16, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    case 0x289b0a60 : // B
    case 0x28ab0a60 : // C
        this._family = Family.FAMILY_SAM3S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3S8", 0x400000, 2048, 256, 1, 16, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    case 0x28800960 : // A
    case 0x28900960 : // B
    case 0x28a00960 : // C
        this._family = Family.FAMILY_SAM3S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3S4", 0x400000, 1024, 256, 1, 16, 0x20001000, 0x2000c000, 0x400e0a00, false);
        break;
    case 0x288a0760 : // A
    case 0x289a0760 : // B
    case 0x28aa0760 : // C
        this._family = Family.FAMILY_SAM3S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3S2", 0x400000, 512, 256, 1, 8, 0x20000800, 0x20008000, 0x400e0a00, false);
        break;
    case 0x28890560 : // A
    case 0x28990560 : // B
    case 0x28a90560 : // C
        this._family = Family.FAMILY_SAM3S;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3S1", 0x400000, 256, 256, 1, 4, 0x20000800, 0x20004000, 0x400e0a00, false);
        break;
    //
    // SAM3U
    //
    case 0x28000960 : // C
    case 0x28100960 : // E
        this._family = Family.FAMILY_SAM3U;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3U4", 0xE0000, 1024, 256, 2, 32, 0x20001000, 0x20008000, 0x400e0800, false);
        break;
    case 0x280a0760 : // C
    case 0x281a0760 : // E
        this._family = Family.FAMILY_SAM3U;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3U2", 0x80000, 512, 256, 1, 16, 0x20001000, 0x20004000, 0x400e0800, false);
        break;
    case 0x28090560 : // C
    case 0x28190560 : // E
        this._family = Family.FAMILY_SAM3U;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3U1", 0x80000, 256, 256, 1, 8, 0x20001000, 0x20002000, 0x400e0800, false);
        break;
    //
    // SAM3X
    //
    case 0x286e0a60 : // 8H
    case 0x285e0a60 : // 8E
    case 0x284e0a60 : // 8C
        this._family = Family.FAMILY_SAM3X;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3X8", 0x80000, 2048, 256, 2, 32, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    case 0x285b0960 : // 4E
    case 0x284b0960 : // 4C
        this._family = Family.FAMILY_SAM3X;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3X4", 0x80000, 1024, 256, 2, 16, 0x20001000, 0x20008000, 0x400e0a00, false);
        break;
    //
    // SAM3A
    //
    case 0x283e0A60 : // 8C
        this._family = Family.FAMILY_SAM3A;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3A8", 0x80000, 2048, 256, 2, 32, 0x20001000, 0x20010000, 0x400e0a00, false);
        break;
    case 0x283b0960 : // 4C
        this._family = Family.FAMILY_SAM3A;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM3A4", 0x80000, 1024, 256, 2, 16, 0x20001000, 0x20008000, 0x400e0a00, false);
        break;
    //
    // SAM7L
    //
    case 0x27330740 :
        this._family = Family.FAMILY_SAM7L;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM7L128", 0x100000, 512, 256, 1, 16, 0x2ffb40, 0x300700, 0xffffff60, false);
        break;
    case 0x27330540 :
        this._family = Family.FAMILY_SAM7L;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM7L64", 0x100000, 256, 256, 1, 8, 0x2ffb40, 0x300700, 0xffffff60, false);
        break;
    //
    // SAM9XE
    //
    case 0x329aa3a0 :
        this._family = Family.FAMILY_SAM9XE;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM9XE512", 0x200000, 1024, 512, 1, 32, 0x300000, 0x307000, 0xfffffa00, true);
        break;
    case 0x329a93a0 :
        this._family = Family.FAMILY_SAM9XE;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM9XE256", 0x200000, 512, 512, 1, 16, 0x300000, 0x307000, 0xfffffa00, true);
        break;
    case 0x329973a0 :
        this._family = Family.FAMILY_SAM9XE;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAM9XE128", 0x200000, 256, 512, 1, 8, 0x300000, 0x303000, 0xfffffa00, true);
        break;
    //
    // SAM4E
    //
    case 0x23cc0ce0:
        switch (extChipId)
        {
        case 0x00120200: // E
        case 0x00120201: // C
            this._family = Family.FAMILY_SAM4E;
            flashPtr = null; // new EefcFlash(this._samba, "ATSAM4E16", 0x400000, 2048, 512, 1, 128, 0x20001000, 0x20020000, 0x400e0a00, false);
            break;
        case 0x00120208: // E
        case 0x00120209: // C
            this._family = Family.FAMILY_SAM4E;
            flashPtr = null; // new EefcFlash(this._samba, "ATSAM4E8", 0x400000, 1024, 512, 1, 64, 0x20001000, 0x20020000, 0x400e0a00, false);
            break;
        }
        break;
    //
    // SAME70
    //
    case 0x210d0a00:
        this._family = Family.FAMILY_SAME70;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAME70x19", 0x400000, 1024, 512, 1, 32, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    case 0x21020c00:
        this._family = Family.FAMILY_SAME70;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAME70x20", 0x400000, 2048, 512, 1, 64, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    case 0x21020e00:
        this._family = Family.FAMILY_SAME70;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAME70x21", 0x400000, 4096, 512, 1, 128, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    //
    // SAMS70
    //
    case 0x211d0a00:
        this._family = Family.FAMILY_SAMS70;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAMS70x19", 0x400000, 1024, 512, 1, 32, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    case 0x21120c00:
        this._family = Family.FAMILY_SAMS70;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAMS70x20", 0x400000, 2048, 512, 1, 64, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    case 0x21120e00:
        this._family = Family.FAMILY_SAMS70;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAMS70x21", 0x400000, 4096, 512, 1, 128, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    //
    // SAMV70
    //
    case 0x213d0a00:
        this._family = Family.FAMILY_SAMV70;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAMV70x19", 0x400000, 1024, 512, 1, 32, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    case 0x21320c00:
        this._family = Family.FAMILY_SAMV70;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAMV70x20", 0x400000, 2048, 512, 1, 64, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    //
    // SAMV71
    //
    case 0x212d0a00:
        this._family = Family.FAMILY_SAMV71;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAMV71x19", 0x400000, 1024, 512, 1, 32, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    case 0x21220c00:
        this._family = Family.FAMILY_SAMV71;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAMV71x20", 0x400000, 2048, 512, 1, 64, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    case 0x21220e00:
        this._family = Family.FAMILY_SAMV71;
        flashPtr = null; // new EefcFlash(this._samba, "ATSAMV71x21", 0x400000, 4096, 512, 1, 128, 0x20401000, 0x20404000, 0x400e0c00, false);
        break;
    //
    // No CHIPID devices
    //
    case 0:
        switch (deviceId & 0xffff00ff)
        {
        //
        // SAMD21
        //
        case 0x10010003: // J15A
        case 0x10010008: // G15A
        case 0x1001000d: // E15A
        case 0x10010021: // J15B
        case 0x10010024: // G15B
        case 0x10010027: // E15B
        case 0x10010056: // E15B WLCSP
        case 0x10010063: // E15C WLCSP
            this._family = Family.FAMILY_SAMD21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAMD21x15", 512, 64, 0x20000800, 0x20001000) ;
            break;

        case 0x10010002: // J16A
        case 0x10010007: // G16A
        case 0x1001000c: // E16A
        case 0x10010020: // J16B
        case 0x10010023: // G16B
        case 0x10010026: // E16B
        case 0x10010055: // E16B WLCSP
        case 0x10010062: // E16C WLCSP
            this._family = Family.FAMILY_SAMD21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAMD21x16", 1024, 64, 0x20001000, 0x20002000) ;
            break;

        case 0x10010001: // J17A
        case 0x10010006: // G17A
        case 0x1001000b: // E17A
        case 0x10010010: // G17A WLCSP
            this._family = Family.FAMILY_SAMD21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAMD21x17", 2048, 64, 0x20002000, 0x20004000) ;
            break;

        case 0x10010000: // J18A
            this._uniqueId = await this.readChipUniqueId();
        case 0x10010005: // G18A
        case 0x1001000a: // E18A
        case 0x1001000f: // G18A WLCSP
            this._family = Family.FAMILY_SAMD21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAMD21x18", 4096, 64, 0x20004000, 0x20008000) ;
            break;

        //
        // SAMR21
        //
        case 0x1001001e: // E16A
        case 0x1001001b: // G16A
            this._family = Family.FAMILY_SAMR21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAMR21x16", 1024, 64, 0x20001000, 0x20002000) ;
            break;

        case 0x1001001d: // E17A
            this._uniqueId = await this.readChipUniqueId();
        case 0x1001001a: // G17A
            this._family = Family.FAMILY_SAMR21;
            
            flashPtr = new D2xNvmFlash(this._samba, "ATSAMR21x17", 2048, 64, 0x20002000, 0x20004000) ;
            break;

        case 0x1001001c: // E18A
        case 0x10010019: // G18A
            this._family = Family.FAMILY_SAMR21;
            this._uniqueId = await this.readChipUniqueId();
            flashPtr = new D2xNvmFlash(this._samba, "ATSAMR21x18", 4096, 64, 0x20004000, 0x20008000) ;
            break;

        case 0x10010018: // E19A
            this._family = Family.FAMILY_SAMR21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAMR21x19", 4096, 64, 0x20004000, 0x20008000) ;
            break;

        //
        // SAML21
        //
        case 0x1081000d: // E15A
        case 0x1081001c: // E15B
            this._family = Family.FAMILY_SAMD21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAML21x15", 512, 64, 0x20000800, 0x20001000) ;
            break;

        case 0x10810002: // J16A
        case 0x10810007: // G16A
        case 0x1081000c: // E16A
        case 0x10810011: // J16B
        case 0x10810016: // G16B
        case 0x1081001b: // E16B
            this._family = Family.FAMILY_SAML21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAML21x16", 1024, 64, 0x20001000, 0x20002000) ;
            break;

        case 0x10810001: // J17A
        case 0x10810006: // G17A
        case 0x1081000b: // E17A
        case 0x10810010: // J17B
        case 0x10810015: // G17B
        case 0x1081001a: // E17B
            this._family = Family.FAMILY_SAML21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAML21x17", 2048, 64, 0x20002000, 0x20004000) ;
            break;

        case 0x10810000: // J18A
        case 0x10810005: // G18A
        case 0x1081000a: // E18A
        case 0x1081000f: // J18B
        case 0x10810014: // G18B
        case 0x10810019: // E18B
            this._family = Family.FAMILY_SAML21;
            flashPtr = new D2xNvmFlash(this._samba, "ATSAML21x18", 4096, 64, 0x20004000, 0x20008000) ;
            break;

        //
        // SAMD51
        //
        case 0x60060006: // J18A
        case 0x60060008: // G18A
            this._family = Family.FAMILY_SAMD51;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAMD51x18", 512, 512, 0x20004000, 0x20008000) ;
            break;

        case 0x60060001: // P19A
        case 0x60060003: // N19A
        case 0x60060005: // J19A
        case 0x60060007: // G19A
            this._family = Family.FAMILY_SAMD51;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAMD51x19", 1024, 512, 0x20004000, 0x20008000) ;
            break;

        case 0x60060000: // P20A
        case 0x60060002: // N20A
        case 0x60060004: // J20A
            this._family = Family.FAMILY_SAMD51;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAMD51x20", 2048, 512, 0x20004000, 0x20008000) ;
            break;

        //
        // SAME51
        //
        case 0x61810003: // J18A
            this._family = Family.FAMILY_SAME51;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAME51x18", 512, 512, 0x20004000, 0x20008000) ;
            break;

        case 0x61810002: // J19A
        case 0x61810001: // N19A
            this._family = Family.FAMILY_SAME51;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAME51x19", 1024, 512, 0x20004000, 0x20008000) ;
            break;

        case 0x61810004: // J20A
        case 0x61810000: // N20A
            this._family = Family.FAMILY_SAME51;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAME51x20", 2048, 512, 0x20004000, 0x20008000) ;
            break;

        //
        // SAME53
        //
        case 0x61830006: // J18A
            this._family = Family.FAMILY_SAME53;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAME53x18", 512, 512, 0x20004000, 0x20008000) ;
            break;

        case 0x61830005: // J19A
        case 0x61830003: // N19A
            this._family = Family.FAMILY_SAME53;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAME53x19", 1024, 512, 0x20004000, 0x20008000) ;
            break;

        case 0x61830004: // J20A
        case 0x61830002: // N20A
            this._family = Family.FAMILY_SAME53;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAME53x20", 2048, 512, 0x20004000, 0x20008000) ;
            break;

        //
        // SAME54
        //
        case 0x61840001: // P19A
        case 0x61840003: // N19A
            this._family = Family.FAMILY_SAME54;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAME54x19", 1024, 512, 0x20004000, 0x20008000) ;
            break;

        case 0x61840000: // P20A
        case 0x61840002: // N20A
            this._family = Family.FAMILY_SAME54;
            flashPtr = null; new D5xNvmFlash(this._samba, "ATSAME54x20", 2048, 512, 0x20004000, 0x20008000) ;
            break;

        //
        // Unknown
        //
        default:
            throw new DeviceUnsupportedError();
            break;
        }
        break;

    //
    // Unsupported device
    //
    default:
      throw new DeviceUnsupportedError();
      break;
    }

    if (flashPtr == null) {
      throw new DeviceUnsupportedError();
    }

    this._flash = flashPtr;
  }

  async reset() : Promise<void> {
    try
    {
        switch (this._family)
        {
        case Family.FAMILY_SAMD21:
        case Family.FAMILY_SAMR21:
        case Family.FAMILY_SAML21:
        case Family.FAMILY_SAMD51:
        case Family.FAMILY_SAME51:
        case Family.FAMILY_SAME53:
        case Family.FAMILY_SAME54:
        case Family.FAMILY_SAME70:
        case Family.FAMILY_SAMS70:
        case Family.FAMILY_SAMV70:
        case Family.FAMILY_SAMV71:
            await this._samba.writeWord(0xE000ED0C, 0x05FA0004);
            break;

        case Family.FAMILY_SAM3X:
        case Family.FAMILY_SAM3S:
        case Family.FAMILY_SAM3A:
            await this._samba.writeWord(0x400E1A00, 0xA500000D);
            break;

        case Family.FAMILY_SAM3U:
            await this._samba.writeWord(0x400E1200, 0xA500000D);
            break;

        case Family.FAMILY_SAM3N:
        case Family.FAMILY_SAM4S:
            await this._samba.writeWord(0x400E1400, 0xA500000D);
            break;

        case Family.FAMILY_SAM4E:
            await this._samba.writeWord(0x400E1800, 0xA500000D);
            break;

        case Family.FAMILY_SAM7S:
        case Family.FAMILY_SAM7SE:
        case Family.FAMILY_SAM7X:
        case Family.FAMILY_SAM7XC:
        case Family.FAMILY_SAM7L:
        case Family.FAMILY_SAM9XE:
            await this._samba.writeWord(0xFFFFFD00, 0xA500000D);
            break;

        default:
            break;
        }
    }
    catch (expected)
    {   // writeWord will most likely throw an exception when the CPU is reset
    }
  }

  get family() {
    return this._family;
  }

  get flash() {
    return this._flash;
  }


  private async readChipUniqueId() : Promise<string> {

    let result = '';

    let word = await this._samba.readWord(0x0080A00C);
    result += word.toString(16).toUpperCase().padStart(8, "0");

    word = await this._samba.readWord(0x0080A040);
    result += word.toString(16).toUpperCase().padStart(8, "0");

    word = await this._samba.readWord(0x0080A044);
    result += word.toString(16).toUpperCase().padStart(8, "0");

    word = await this._samba.readWord(0x0080A048);
    result += word.toString(16).toUpperCase().padStart(8, "0");

    return result;
  }

  private async readChipId() : Promise<ChipId> {

    let chipId = await this._samba.readWord(0x400e0740);
    let extChipId = 0;

    if (chipId != 0) {
        let extChipId = await this._samba.readWord(0x400e0744);
    }
    else {
      chipId = await this._samba.readWord(0x400e0940);

      if (chipId != 0) {
        extChipId = await this._samba.readWord(0x400e0944);
      }
    }

    return <ChipId>{
      chipId: chipId,
      extChipId: extChipId
    }
  }

}
