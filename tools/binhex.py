"""BinHex 4.0 (.hqx) decoder.

A BinHex file is a Mac file — name, type, creator, Finder flags, data fork and
resource fork — wrapped as 7-bit text so it could survive 1990s email:

  text      ':' + six bits per character, from a 64-character alphabet + ':'
  RLE90     0x90 n repeats the previous byte (n = 0 means a literal 0x90)
  header    name, version, type, creator, flags, data length, rsrc length, CRC
  forks     data fork + CRC, then resource fork + CRC

Every CRC is CRC-16/XMODEM, and every one is checked.
"""
import struct
from dataclasses import dataclass

ALPHABET = b"!\"#$%&'()*+,-012345689@ABCDEFGHIJKLMNPQRSTUVXYZ[`abcdefhijklmpqr"
DECODE = {c: i for i, c in enumerate(ALPHABET)}


@dataclass
class MacFile:
    name: str
    type: bytes
    creator: bytes
    flags: int
    data: bytes
    rsrc: bytes


def _crc_table():
    table = []
    for n in range(256):
        crc = n << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else crc << 1
        table.append(crc & 0xFFFF)
    return table


CRC_TABLE = _crc_table()


def crc16(data: bytes, crc: int = 0) -> int:
    """CRC-16/XMODEM: polynomial 0x1021, initial value 0, no reflection."""
    for byte in data:
        crc = ((crc << 8) & 0xFFFF) ^ CRC_TABLE[(crc >> 8) ^ byte]
    return crc


def _sixbit(text: bytes) -> bytes:
    start = text.index(b"(This file must be converted with BinHex")
    body = text[text.index(b":", start) + 1:]
    body = body[:body.index(b":")]
    out, acc, bits = bytearray(), 0, 0
    for c in body:
        if c in b"\r\n\t ":
            continue
        acc = ((acc << 6) | DECODE[c]) & 0xFFF  # never more than 12 bits pending
        bits += 6
        if bits >= 8:
            bits -= 8
            out.append((acc >> bits) & 0xFF)
    return bytes(out)


def _unrle90(data: bytes) -> bytes:
    out, i = bytearray(), 0
    while i < len(data):
        b = data[i]
        if b == 0x90:
            n = data[i + 1]
            i += 2
            if n == 0:
                out.append(0x90)
            else:
                out += bytes([out[-1]]) * (n - 1)
        else:
            out.append(b)
            i += 1
    return bytes(out)


def decode(text: bytes) -> MacFile:
    raw = _unrle90(_sixbit(text))
    n = raw[0]
    name = raw[1:1 + n].decode("mac_roman")
    pos = 1 + n + 1  # skip the version byte
    ftype, creator, flags, dlen, rlen = struct.unpack_from(">4s4sHII", raw, pos)
    pos += 18

    def checked(start, end, what):
        (stored,) = struct.unpack_from(">H", raw, end)
        if crc16(raw[start:end]) != stored:
            raise ValueError(f"BinHex {what} CRC mismatch")
        return raw[start:end]

    checked(0, pos, "header")
    pos += 2
    data = checked(pos, pos + dlen, "data fork")
    pos += dlen + 2
    rsrc = checked(pos, pos + rlen, "resource fork")
    return MacFile(name, ftype, creator, flags, data, rsrc)
