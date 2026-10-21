#!/usr/bin/env python3
"""Decode QuickDraw PICT v2 resources (the subset Escape Velocity plugins use)
to PNG.

Handles:
  0x0090 BitsRect            uncompressed 1-bit bitmap
  0x0098/0x0099 PackBitsRect/Rgn   1-bit bitmap or 1/2/4/8-bit indexed pixmap
  0x009A/0x009B DirectBitsRect/Rgn 16-bit RGB555, packType 3

Usage: pict_decode.py <resource.bin> <out.png>   (or import decode_pict)
"""
import struct
import sys

from PIL import Image


class Reader:
    def __init__(self, buf, pos=0):
        self.buf = buf
        self.pos = pos

    def u8(self):
        v = self.buf[self.pos]
        self.pos += 1
        return v

    def u16(self):
        (v,) = struct.unpack_from(">H", self.buf, self.pos)
        self.pos += 2
        return v

    def s16(self):
        (v,) = struct.unpack_from(">h", self.buf, self.pos)
        self.pos += 2
        return v

    def u32(self):
        (v,) = struct.unpack_from(">I", self.buf, self.pos)
        self.pos += 4
        return v

    def rect(self):
        return struct.unpack_from(">hhhh", self.buf, self.pos), self.skip(8)

    def skip(self, n):
        self.pos += n

    def take(self, n):
        v = self.buf[self.pos : self.pos + n]
        self.pos += n
        return v

    def align(self):
        if self.pos & 1:
            self.pos += 1


def unpackbits_bytes(r: Reader, rowbytes: int) -> bytes:
    """One scanline of byte-oriented PackBits."""
    if rowbytes < 8:
        return r.take(rowbytes)
    count = r.u16() if rowbytes > 250 else r.u8()
    end = r.pos + count
    out = bytearray()
    while r.pos < end:
        flag = r.u8()
        if flag >= 128:
            out += bytes([r.u8()]) * (257 - flag)
        else:
            out += r.take(flag + 1)
    return bytes(out)


def unpackbits_words(r: Reader, rowbytes: int) -> bytes:
    """One scanline of word-oriented PackBits (packType 3, 16-bit pixels)."""
    count = r.u16() if rowbytes > 250 else r.u8()
    end = r.pos + count
    out = bytearray()
    while r.pos < end:
        flag = r.u8()
        if flag >= 128:
            out += r.take(2) * (257 - flag)
        else:
            out += r.take((flag + 1) * 2)
    return bytes(out)


def read_color_table(r: Reader):
    r.u32()  # ctSeed
    ct_flags = r.u16()
    ct_size = r.u16()
    table = {}
    for i in range(ct_size + 1):
        value = r.u16()
        red, green, blue = r.u16() >> 8, r.u16() >> 8, r.u16() >> 8
        # A device colour table (high bit of ctFlags) leaves every value field
        # zero and is indexed by position; keying on value collapsed all 256
        # entries onto index 0 and decoded the picture solid black.
        table[i if ct_flags & 0x8000 else value] = (red, green, blue)
    return [table.get(i, (0, 0, 0)) for i in range(256)]


# Fixed-size opcodes that only set drawing state, mapped to their data length.
STATE_OPS = {
    0x0002: 8, 0x0003: 2, 0x0004: 1, 0x0005: 2, 0x0006: 4, 0x0007: 4, 0x0008: 2,
    0x0009: 8, 0x000A: 8, 0x000B: 4, 0x000C: 4, 0x000D: 2, 0x000E: 4, 0x000F: 4,
    0x0010: 8, 0x0011: 1, 0x0015: 2, 0x0016: 2, 0x001A: 6, 0x001B: 6, 0x001C: 0,
    0x001D: 6, 0x001F: 6,
}


def skip_vector(r: "Reader", op: int) -> bool:
    """Step over one QuickDraw line, shape or text opcode. True if it was one.

    Pictures here are raster art; where a readme picture also draws a caption
    or a frame, the raster survives and the vector part is left out."""
    if op in (0x0020, 0x0030, 0x0031, 0x0032, 0x0033, 0x0034,   # Line, rects
              0x0040, 0x0041, 0x0042, 0x0043, 0x0044,           # round rects
              0x0050, 0x0051, 0x0052, 0x0053, 0x0054):          # ovals
        r.skip(8)
    elif op in (0x0021, 0x0068, 0x0069, 0x006A, 0x006B, 0x006C):  # LineFrom, same-arcs
        r.skip(4)
    elif op == 0x0022:  # ShortLine
        r.skip(6)
    elif op == 0x0023:  # ShortLineFrom
        r.skip(2)
    elif 0x0060 <= op <= 0x0064:  # arcs
        r.skip(12)
    elif op in (0x0038, 0x0039, 0x003A, 0x003B, 0x003C, 0x0048, 0x0049, 0x004A,
                0x004B, 0x004C, 0x0058, 0x0059, 0x005A, 0x005B, 0x005C):  # same-shape
        pass
    elif op == 0x0028:  # LongText: point, then a Pascal string
        r.skip(4)
        r.skip(r.u8())
    elif op in (0x0029, 0x002A):  # DHText / DVText
        r.skip(1)
        r.skip(r.u8())
    elif op == 0x002B:  # DHDVText
        r.skip(2)
        r.skip(r.u8())
    elif op in (0x002C, 0x002E) or 0x0070 <= op <= 0x0074 or 0x0080 <= op <= 0x0084:
        r.skip(r.u16() - (0 if op in (0x002C, 0x002E) else 2))  # sized records
    else:
        return False
    return True


def quicktime_jpeg(block: bytes) -> Image.Image:
    """A QuickTime-compressed picture: matrix, matte and image description,
    then the codec's data. The only codec seen here is Photo-JPEG, so the
    picture is the JPEG stream that starts at its SOI marker."""
    import io
    start = block.find(b"\xFF\xD8\xFF")
    if start < 0:
        raise ValueError("QuickTime picture with a codec other than JPEG")
    return Image.open(io.BytesIO(block[start:])).convert("RGB")


def decode_pict(data: bytes) -> Image.Image:
    r = Reader(data)
    r.skip(2)  # picSize (meaningless for >32KB pictures)
    (top, left, bottom, right), _ = r.rect()
    width, height = right - left, bottom - top
    if r.u16() != 0x0011 or r.u16() != 0x02FF:
        raise ValueError("not a version 2 PICT")

    image, vector = None, False
    while r.pos < len(data) - 1:
        r.align()
        op = r.u16()
        if op == 0x0000 or op == 0x001E:  # NOP / DefHilite
            continue
        elif op == 0x0C00:  # HeaderOp
            r.skip(24)
        elif op == 0x0001:  # Clip region
            r.skip(r.u16() - 2)
        elif op in STATE_OPS:  # pen, pattern, font and colour state: no pixels
            r.skip(STATE_OPS[op])
        elif skip_vector(r, op):  # lines, shapes and text: stepped over, not drawn
            vector = True
        elif op in (0x8200, 0x8201):  # CompressedQuickTime / UncompressedQuickTime
            image = quicktime_jpeg(r.take(r.u32()))
        elif op == 0x00A0:  # ShortComment
            r.skip(2)
        elif op == 0x00A1:  # LongComment
            r.u16()
            r.skip(r.u16())
        elif op == 0x00FF:  # OpEndPic
            break
        elif op in (0x0090, 0x0098, 0x0099, 0x009A, 0x009B):
            image = decode_bits(r, op)
        else:
            raise ValueError(f"unhandled PICT opcode 0x{op:04X} at {r.pos - 2}")

    if image is None:
        raise ValueError("vector-only PICT: this decoder draws pixels, not shapes or text"
                         if vector else "PICT contained no raster data")
    if image.size != (width, height):
        image = image.crop((0, 0, width, height))
    return image


def decode_bits(r: Reader, op: int) -> Image.Image:
    packed_op = op in (0x0098, 0x0099)
    has_region = op in (0x0099, 0x009B)
    if op in (0x009A, 0x009B):
        r.u32()  # baseAddr
    rowbytes_raw = r.u16()
    is_pixmap = bool(rowbytes_raw & 0x8000)
    rowbytes = rowbytes_raw & 0x7FFF
    (top, left, bottom, right), _ = r.rect()
    width, height = right - left, bottom - top

    def skip_rects_mode():
        r.skip(8 + 8 + 2)  # srcRect, dstRect, mode
        if has_region:
            r.skip(r.u16() - 2)  # maskRgn (size word includes itself)

    if not is_pixmap:  # 1-bit BitMap
        skip_rects_mode()
        rows = []
        for _ in range(height):
            row = unpackbits_bytes(r, rowbytes) if packed_op else r.take(rowbytes)
            rows.append(row)
        image = Image.new("1", (width, height))
        px = image.load()
        for y, row in enumerate(rows):
            for x in range(width):
                # QuickDraw paints a set bit black; PIL's "1" mode calls 1 white
                px[x, y] = 0 if row[x // 8] & (0x80 >> (x % 8)) else 1
        return image

    r.u16()  # pmVersion
    pack_type = r.u16()
    r.skip(4 + 4 + 4 + 2)  # packSize, hRes, vRes, pixelType
    pixel_size = r.u16()
    r.skip(2 + 2 + 4 + 4 + 4)  # cmpCount, cmpSize, planeBytes, pmTable, reserved

    palette = read_color_table(r) if packed_op else None
    skip_rects_mode()

    if pixel_size in (1, 2, 4, 8):
        pixels_per_byte = 8 // pixel_size
        shift, mask = 8 - pixel_size, (1 << pixel_size) - 1
        image = Image.new("RGB", (width, height))
        px = image.load()
        for y in range(height):
            row = unpackbits_bytes(r, rowbytes)
            for x in range(width):
                b = row[x // pixels_per_byte]
                v = (b >> (shift - (x % pixels_per_byte) * pixel_size)) & mask
                px[x, y] = palette[v]
        return image
    if pixel_size == 16 and pack_type == 3:
        image = Image.new("RGB", (width, height))
        px = image.load()
        for y in range(height):
            row = unpackbits_words(r, rowbytes)
            for x in range(width):
                (v,) = struct.unpack_from(">H", row, x * 2)
                red = (v >> 10) & 0x1F
                green = (v >> 5) & 0x1F
                blue = v & 0x1F
                px[x, y] = (red << 3 | red >> 2, green << 3 | green >> 2, blue << 3 | blue >> 2)
        return image
    if pixel_size == 32 and pack_type == 4:  # planar byte-RLE, components per row
        image = Image.new("RGB", (width, height))
        px = image.load()
        for y in range(height):
            row = unpackbits_bytes(r, rowbytes)
            planes = len(row) // width  # 3 = RGB, 4 = ARGB (alpha plane first)
            base = width * (planes - 3)
            for x in range(width):
                px[x, y] = (row[base + x], row[base + width + x], row[base + 2 * width + x])
        return image
    raise ValueError(f"unhandled pixel format: {pixel_size}-bit packType {pack_type}")


if __name__ == "__main__":
    decode_pict(open(sys.argv[1], "rb").read()).save(sys.argv[2])
    print(f"wrote {sys.argv[2]}")
