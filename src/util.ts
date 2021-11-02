// Copyright (C) 2021 Toitware ApS. All rights reserved.
// Use of this source code is governed by an MIT-style license that can be
// found in the LICENSE file.

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Uint8Buffer {
  private readOffset = 0;
  private writeOffset = 0;
  private size: number;

  private _buffer: ArrayBuffer;
  private _view: Uint8Array;

  constructor(size = 64) {
    this.size = size;
    this._buffer = new ArrayBuffer(this.size);
    this._view = new Uint8Array(this._buffer);
  }

  get length(): number {
    return this.writeOffset - this.readOffset;
  }

  shift(): number | undefined {
    if (this.length <= 0) {
      return undefined;
    }
    return this._view[this.readOffset++];
  }

  private grow(newSize: number) {
    const newBuffer = new ArrayBuffer(newSize);
    const newView = new Uint8Array(newBuffer);
    this._view.forEach((v, i) => (newView[i] = v));
    this.size = newSize;
    this._buffer = newBuffer;
    this._view = newView;
  }

  fill(element: number, length = 1): void {
    this.ensure(length);
    this._view.fill(element, this.writeOffset, this.writeOffset + length);
    this.writeOffset += length;
  }

  private ensure(length: number) {
    if (this.size - this.writeOffset < length) {
      const newSize = this.size + Math.max(length, this.size);
      this.grow(newSize);
    }
  }

  private pushBytes(value: number, byteCount: number, littleEndian: boolean) {
    for (let i = 0; i < byteCount; i++) {
      if (littleEndian) {
        this.push((value >> (i * 8)) & 0xff);
      } else {
        this.push((value >> ((byteCount - i) * 8)) & 0xff);
      }
    }
  }

  reset(): void {
    this.writeOffset = 0;
    this.readOffset = 0;
  }

  push(...bytes: number[]): void {
    this.ensure(bytes.length);
    this._view.set(bytes, this.writeOffset);
    this.writeOffset += bytes.length;
  }

  copy(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this._view.set(bytes, this.writeOffset);
    this.writeOffset += bytes.length;
  }

  view(): Uint8Array {
    return new Uint8Array(this._buffer, this.readOffset, this.writeOffset);
  }
}

export function toByteArray(str: string): Uint8Array {
  const byteArray = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const charcode = str.charCodeAt(i);
    byteArray[i] = charcode & 0xff;
  }
  return byteArray;
}

export function toHex(value: number, size = 2): string {
  return "0x" + value.toString(16).toUpperCase().padStart(size, "0");
}