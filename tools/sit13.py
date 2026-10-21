"""StuffIt method 13: LZ77 over a 64 KB window, with Huffman-coded symbols.

The method StuffIt Deluxe 4 used for most forks, ConEx Override's included.

  first byte   high nibble 0: the three Huffman codes follow, themselves
               coded with a fixed 37-symbol meta-code; 1-5: built-in tables
  symbols      0-255 literal; 256-317 match of length 3-64; 318 and 319 match
               of length 65 + 10 or 15 extra bits; 320 end of stream
  offsets      a code of bit-lengths, then that many bits less one

Two codes alternate: the first after a literal, the second after a match.
Bits are read least-significant first; Huffman codes are canonical.
"""

# The meta-code, as (bit-reversed) code values and their lengths. It is a
# complete prefix code: the lengths' Kraft sum is exactly 1.
META_CODES = [0x5D8, 0x058, 0x040, 0x0C0, 0x000, 0x078, 0x02B, 0x014, 0x00C, 0x01C,
              0x01B, 0x00B, 0x010, 0x020, 0x038, 0x018, 0x0D8, 0xBD8, 0x180, 0x680,
              0x380, 0xF80, 0x780, 0x480, 0x080, 0x280, 0x3D8, 0xFD8, 0x7D8, 0x9D8,
              0x1D8, 0x004, 0x001, 0x002, 0x007, 0x003, 0x008]
META_LENGTHS = [11, 8, 8, 8, 8, 7, 6, 5, 5, 5, 5, 6, 5, 6, 7, 7, 9, 12, 10, 11, 11, 12,
                12, 11, 11, 11, 12, 12, 12, 12, 12, 5, 2, 2, 3, 4, 5]


class Bits:
    """Least-significant-bit-first reader."""

    def __init__(self, data: bytes, pos: int = 0):
        self.data, self.pos, self.buf, self.count = data, pos, 0, 0

    def peek(self, n: int) -> int:
        while self.count < n:
            byte = self.data[self.pos] if self.pos < len(self.data) else 0
            self.pos += 1
            self.buf |= byte << self.count
            self.count += 8
        return self.buf & ((1 << n) - 1)

    def skip(self, n: int):
        self.buf >>= n
        self.count -= n

    def read(self, n: int) -> int:
        if n == 0:
            return 0
        v = self.peek(n)
        self.skip(n)
        return v


class Code:
    """A prefix code decoded with one table lookup per symbol."""

    def __init__(self, reversed_codes, lengths):
        live = [(c, l, s) for s, (c, l) in enumerate(zip(reversed_codes, lengths)) if l > 0]
        self.bits = max(l for _, l, _ in live)
        size = 1 << self.bits
        self.table = [None] * size
        for code, length, symbol in live:
            for high in range(0, size, 1 << length):
                self.table[high | code] = (symbol, length)

    @classmethod
    def canonical(cls, lengths):
        """Canonical code, shortest all-zeros, symbols in order within a length."""
        codes, code = [0] * len(lengths), 0
        for length in range(1, max(lengths) + 1):
            for s, l in enumerate(lengths):
                if l == length:
                    codes[s] = int(f"{code:0{length}b}"[::-1], 2)  # reversed: LSB-first
                    code += 1
            code <<= 1
        return cls(codes, lengths)

    def decode(self, bits: Bits) -> int:
        entry = self.table[bits.peek(self.bits)]
        if entry is None:
            raise ValueError("invalid Huffman code")
        symbol, length = entry
        bits.skip(length)
        return symbol


META = Code(META_CODES, META_LENGTHS)


def _read_code(bits: Bits, count: int) -> Code:
    lengths, length, i = [0] * count, 0, 0
    while i < count:
        val = META.decode(bits)
        if val == 31:
            length = -1
        elif val == 32:
            length += 1
        elif val == 33:
            length -= 1
        elif val == 34:
            if bits.read(1):
                lengths[i] = length
                i += 1
        elif val == 35:
            for _ in range(bits.read(3) + 2):
                lengths[i] = length
                i += 1
        elif val == 36:
            for _ in range(bits.read(6) + 10):
                lengths[i] = length
                i += 1
        else:
            length = val + 1
        lengths[i] = length
        i += 1
    return Code.canonical(lengths)


def decompress(data: bytes, size: int) -> bytes:
    head = data[0]
    if head >> 4 != 0:
        raise NotImplementedError(f"StuffIt 13 built-in table set {head >> 4}")
    bits = Bits(data, 1)
    first = _read_code(bits, 321)
    second = first if head & 0x08 else _read_code(bits, 321)
    offsets = _read_code(bits, (head & 7) + 10)

    out = bytearray()
    code = first
    while len(out) < size:
        val = code.decode(bits)
        if val < 0x100:
            out.append(val)
            code = first
            continue
        code = second
        if val < 0x13E:
            length = val - 0x100 + 3
        elif val == 0x13E:
            length = bits.read(10) + 65
        elif val == 0x13F:
            length = bits.read(15) + 65
        else:
            break  # 0x140: end of stream
        nbits = offsets.decode(bits)
        offset = nbits + 1 if nbits < 2 else (1 << (nbits - 1)) + bits.read(nbits - 1) + 1
        start = len(out) - offset
        if start < 0:
            raise ValueError("match reaches before the start of the stream")
        if offset >= length:
            out += out[start:start + length]
        else:
            for k in range(length):
                out.append(out[start + k])
    if len(out) != size:
        raise ValueError(f"StuffIt 13 stream gave {len(out)} bytes, expected {size}")
    return bytes(out)
