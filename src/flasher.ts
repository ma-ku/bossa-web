
import { SamBA } from './samba';
import { Flash } from './flash';
import { Uint8Buffer } from './util';

export class FlashOffsetError extends Error {

  constructor(msg: string | undefined = undefined ) {
    super(msg);
  }
}

export class FileSizeError extends Error {

  constructor(msg: string | undefined = undefined ) {
    super(msg);
  }
}

export interface FlasherObserver {
  onStatus(message : string) : void;
  onProgress(num: number, div: number) : void;
}

export class Flasher {

  constructor(samba: SamBA, flash: Flash, observer: FlasherObserver) {
    this._flash = flash;
    this._samba = samba;
    this._observer = observer;
  }

  protected _samba : SamBA;
  protected _flash : Flash;

  protected _observer: FlasherObserver;

  async erase(foffset: number) : Promise<void> {
    this._observer.onStatus('Erase flash\n');
    await this._flash.eraseAll(foffset);
    this._flash.eraseAuto = false;
  }

  async write(data: Uint8Array, foffset: number) : Promise<void> {

    let pageSize = this._flash.pageSize;
    var pageNum = 0;
    var numPages = 0;
    var fsize = data.byteLength;
    let fbytes = 0;
    let remaining = data.byteLength;
    var dataOffset = 0;

    // target address must align with pages
    if (foffset % pageSize != 0 || foffset >= this._flash.totalSize)
        throw new FlashOffsetError();

    numPages = Math.trunc((fsize + pageSize - 1) / pageSize);
    if (numPages > this._flash.numPages)
        throw new FileSizeError();

    this._observer.onStatus('Write ' + fsize + ' bytes to flash (' + numPages + ' pages)\n');

    if (this._samba.canWriteBuffer)
    {
        var offset = 0;
        let bufferSize = this._samba.writeBufferSize;
        let buffer = new Uint8Buffer(bufferSize);

        while (remaining > 0) {
          let fbytes = (remaining < bufferSize ? remaining : bufferSize);

          buffer.reset();
          buffer.copy(new Uint8Array(data.slice(dataOffset, dataOffset + fbytes)));

          this._observer.onProgress(offset / pageSize, numPages);

          remaining -= fbytes;
          dataOffset += fbytes;

          if (fbytes < bufferSize)
          {
            buffer.fill(0, bufferSize - fbytes);
            fbytes = Math.trunc((fbytes + pageSize - 1) / pageSize) * pageSize;
          }

          await this._flash.loadBuffer(buffer.view(), 0, fbytes);
          await this._flash.writeBuffer(foffset + offset, fbytes);

          offset += fbytes;
        }
    }
    else
    {
      let buffer = new Uint8Buffer(pageSize);
      let pageOffset = foffset / pageSize;

      while (remaining > 0) {

        let fbytes = (remaining < pageSize ? remaining : pageSize);

        buffer.reset();
        buffer.copy(new Uint8Array(data.slice(dataOffset, dataOffset + fbytes)));

        this._observer.onProgress(pageNum, numPages);

        remaining -= fbytes;
        dataOffset += fbytes;

        if (fbytes < pageSize)
        {
          buffer.fill(0, pageSize - fbytes);
          fbytes = Math.trunc((fbytes + pageSize - 1) / pageSize) * pageSize;
        }

        await this._flash.loadBuffer(buffer.view(), 0, fbytes);
        await this._flash.writePage(pageOffset + pageNum);

        pageNum++;

        if (pageNum == numPages || fbytes != pageSize)
          break;
      }

    }

    this._observer.onProgress(numPages, numPages);
  }

  async verify(data: Uint8Array, foffset: number) : Promise<void> {

//     uint32_t pageSize = _flash->pageSize();
//     uint8_t bufferA[pageSize];
//     uint8_t bufferB[pageSize];
//     uint32_t pageNum = 0;
//     uint32_t numPages;
//     uint32_t pageOffset;
//     uint32_t byteErrors = 0;
//     uint16_t flashCrc;
//     long fsize;
//     size_t fbytes;

//     pageErrors = 0;
//     totalErrors = 0;

//     if (foffset % pageSize != 0 || foffset >= _flash->totalSize())
//         throw FlashOffsetError();

//     pageOffset = foffset / pageSize;

//     infile = fopen(filename, "rb");
//     if (!infile)
//         throw FileOpenError(errno);

//     try
//     {
//         if (fseek(infile, 0, SEEK_END) != 0 || (fsize = ftell(infile)) < 0)
//             throw FileIoError(errno);

//         rewind(infile);

//         numPages = (fsize + pageSize - 1) / pageSize;
//         if (numPages > _flash->numPages())
//             throw FileSizeError();

//         _observer.onStatus("Verify %ld bytes of flash\n", fsize);

//         while ((fbytes = fread(bufferA, 1, pageSize, infile)) > 0)
//         {
//             byteErrors = 0;

//             _observer.onProgress(pageNum, numPages);

//             if (_samba.canChecksumBuffer())
//             {
//                 uint16_t calcCrc = 0;
//                 for (uint32_t i = 0; i < fbytes; i++)
//                     calcCrc = _samba.checksumCalc(bufferA[i], calcCrc);

//                 flashCrc = _samba.checksumBuffer((pageOffset + pageNum) * pageSize, fbytes);

//                 if (flashCrc != calcCrc)
//                 {
//                     _flash->readPage(pageOffset + pageNum, bufferB);

//                     for (uint32_t i = 0; i < fbytes; i++)
//                     {
//                         if (bufferA[i] != bufferB[i])
//                             byteErrors++;
//                     }
//                 }
//             }
//             else
//             {
//                 _flash->readPage(pageOffset + pageNum, bufferB);

//                 for (uint32_t i = 0; i < fbytes; i++)
//                 {
//                     if (bufferA[i] != bufferB[i])
//                         byteErrors++;
//                 }
//             }

//             if (byteErrors != 0)
//             {
//                 pageErrors++;
//                 totalErrors += byteErrors;
//             }

//             pageNum++;
//             if (pageNum == numPages || fbytes != pageSize)
//                 break;
//         }
//     }
//     catch(...)
//     {
//         fclose(infile);
//         throw;
//     }

//     fclose(infile);

//      _observer.onProgress(numPages, numPages);

//     if (pageErrors != 0)
//         return false;

//     return true;
// }
  }

// read(const char* filename, uint32_t fsize, uint32_t foffset)
// {
//     FILE* outfile;
//     uint32_t pageSize = _flash->pageSize();
//     uint8_t buffer[pageSize];
//     uint32_t pageNum = 0;
//     uint32_t pageOffset;
//     uint32_t numPages;
//     size_t fbytes;

//     if (foffset % pageSize != 0 || foffset >= _flash->totalSize())
//         throw FlashOffsetError();

//     pageOffset = foffset / pageSize;

//     if (fsize == 0)
//         fsize = pageSize * (_flash->numPages() - pageOffset);

//     numPages = (fsize + pageSize - 1) / pageSize;
//     if (pageOffset + numPages > _flash->numPages())
//         throw FileSizeError();

//     outfile = fopen(filename, "wb");
//     if (!outfile)
//         throw FileOpenError(errno);

//     _observer.onStatus("Read %d bytes from flash\n", fsize);

//     try
//     {
//         for (pageNum = 0; pageNum < numPages; pageNum++)
//         {
//             _observer.onProgress(pageNum, numPages);

//             _flash->readPage(pageOffset + pageNum, buffer);

//             if (pageNum == numPages - 1 && fsize % pageSize > 0)
//                 pageSize = fsize % pageSize;
//             fbytes = fwrite(buffer, 1, pageSize, outfile);
//             if (fbytes != pageSize)
//                 throw FileShortError();
//         }
//     }
//     catch(...)
//     {
//         fclose(outfile);
//         throw;
//     }

//     _observer.onProgress(numPages, numPages);

//     fclose(outfile);
// }

// void
// Flasher::lock(string& regionArg, bool enable)
// {
//     if (regionArg.empty())
//     {
//         _observer.onStatus("%s all regions\n", enable ? "Lock" : "Unlock");
//         std::vector<bool> regions(_flash->lockRegions(), enable);
//         _flash->setLockRegions(regions);
//     }
//     else
//     {
//         size_t pos = 0;
//         size_t delim;
//         uint32_t region;
//         string sub;
//         std::vector<bool> regions = _flash->getLockRegions();

//         do
//         {
//             delim = regionArg.find(',', pos);
//             sub = regionArg.substr(pos, delim - pos);
//             region = strtol(sub.c_str(), NULL, 0);
//             _observer.onStatus("%s region %d\n", enable ? "Lock" : "Unlock", region);
//             regions[region] = enable;
//             pos = delim + 1;
//         } while (delim != string::npos);

//         _flash->setLockRegions(regions);
//     }
// }


}
