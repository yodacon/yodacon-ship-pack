"""StuffIt 5 "Arsenic" (method 15): block sorting under an arithmetic coder.

The stages, decoded in this order:

  arithmetic   26-bit range decoder over adaptive frequency models, bits read
               most-significant first
  header       'A', 's', then log2(block size) - 9, coded as model bits
  per block    end-of-stream flag, randomised flag, BWT primary index, then
               move-to-front symbols with bzip2-style zero runs (RUNA/RUNB)
  inverse      Burrows-Wheeler inverse, then the 0.9.0 bzip2 randomisation
               (the same 512-entry table), then the 4-byte run-length stage
  trailer      CRC-32 of the output
"""
import zlib

ONE = 1 << 25   # the range starts at 2^(26-1)
HALF = 1 << 24


class Model:
    def __init__(self, first, last, increment, limit):
        self.first, self.n = first, last - first + 1
        self.increment, self.limit = increment, limit
        self.reset()

    def reset(self):
        self.freq = [self.increment] * self.n
        self.total = self.increment * self.n

    def update(self, i):
        self.freq[i] += self.increment
        self.total += self.increment
        if self.total > self.limit:
            self.freq = [(f + 1) >> 1 for f in self.freq]
            self.total = sum(self.freq)


class Decoder:
    def __init__(self, data: bytes):
        self.data, self.bitpos = data, 0
        self.range = ONE
        self.code = self._bits(26)

    def _bit(self):
        i = self.bitpos >> 3
        byte = self.data[i] if i < len(self.data) else 0
        bit = (byte >> (7 - (self.bitpos & 7))) & 1
        self.bitpos += 1
        return bit

    def _bits(self, n):
        v = 0
        for _ in range(n):
            v = (v << 1) | self._bit()
        return v

    def symbol(self, m: Model) -> int:
        scale = self.range // m.total
        target = self.code // scale
        cum, i, freq = 0, 0, m.freq
        last = m.n - 1
        while i < last and cum + freq[i] <= target:
            cum += freq[i]
            i += 1
        low = scale * cum
        self.code -= low
        if cum + freq[i] == m.total:
            self.range -= low
        else:
            self.range = freq[i] * scale
        while self.range <= HALF:
            self.range <<= 1
            self.code = (self.code << 1) | self._bit()
        m.update(i)
        return m.first + i

    def bits(self, m: Model, n: int) -> int:
        v = 0
        for i in range(n):
            if self.symbol(m):
                v |= 1 << i
        return v


def decompress(data: bytes, size: int) -> bytes:
    d = Decoder(data)
    initial = Model(0, 1, 1, 256)
    selector = Model(0, 10, 8, 1024)
    mtf_models = [Model(2, 3, 8, 1024), Model(4, 7, 4, 1024), Model(8, 15, 4, 1024),
                  Model(16, 31, 4, 1024), Model(32, 63, 2, 1024), Model(64, 127, 2, 1024),
                  Model(128, 255, 1, 1024)]

    if d.bits(initial, 8) != ord("A") or d.bits(initial, 8) != ord("s"):
        raise ValueError("not an Arsenic stream")
    block_bits = d.bits(initial, 4) + 9
    block_size = 1 << block_bits

    out = bytearray()
    while True:
        if d.symbol(initial):  # end of stream
            crc = d.bits(initial, 32)
            break
        randomised = d.symbol(initial)
        primary = d.bits(initial, block_bits)

        block = bytearray()
        order = list(range(256))
        while True:
            sel = d.symbol(selector)
            if sel < 2:  # a run of zeros, RUNA/RUNB in bijective base 2
                run, weight = 0, 1
                while sel < 2:
                    run += weight << sel
                    weight <<= 1
                    sel = d.symbol(selector)
                block += bytes([order[0]]) * run
            if sel == 10:
                break
            index = 1 if sel == 2 else d.symbol(mtf_models[sel - 3])
            value = order.pop(index)
            order.insert(0, value)
            block.append(value)
            if len(block) > block_size:
                raise ValueError("Arsenic block overflows its size")
        selector.reset()
        for m in mtf_models:
            m.reset()
        if primary >= len(block):
            raise ValueError("Arsenic BWT index out of range")

        # inverse BWT: transform[] links each byte to its successor
        counts = [0] * 256
        for b in block:
            counts[b] += 1
        starts, total = [0] * 256, 0
        for b in range(256):
            starts[b], total = total, total + counts[b]
        transform = [0] * len(block)
        for i, b in enumerate(block):
            transform[starts[b]] = i
            starts[b] += 1

        idx = primary
        rand_i, rand_next = 0, RNUMS[0] - 1
        last, run = -1, 0
        for n in range(len(block)):
            idx = transform[idx]
            byte = block[idx]
            if randomised:
                if n == rand_next:
                    byte ^= 1
                    rand_i = (rand_i + 1) & 511
                    rand_next += RNUMS[rand_i]
            if run == 4:
                out += bytes([last]) * byte
                run = 0
                continue
            if byte == last:
                run += 1
            else:
                last, run = byte, 1
            out.append(byte)

    if len(out) != size:
        raise ValueError(f"Arsenic stream gave {len(out)} bytes, expected {size}")
    if zlib.crc32(out) != crc:
        raise ValueError("Arsenic CRC-32 mismatch")
    return bytes(out)


RNUMS = [
    619, 720, 127, 481, 931, 816, 813, 233, 566, 247, 985, 724, 205, 454, 863, 491,
    741, 242, 949, 214, 733, 859, 335, 708, 621, 574, 73, 654, 730, 472, 419, 436,
    278, 496, 867, 210, 399, 680, 480, 51, 878, 465, 811, 169, 869, 675, 611, 697,
    867, 561, 862, 687, 507, 283, 482, 129, 807, 591, 733, 623, 150, 238, 59, 379,
    684, 877, 625, 169, 643, 105, 170, 607, 520, 932, 727, 476, 693, 425, 174, 647,
    73, 122, 335, 530, 442, 853, 695, 249, 445, 515, 909, 545, 703, 919, 874, 474,
    882, 500, 594, 612, 641, 801, 220, 162, 819, 984, 589, 513, 495, 799, 161, 604,
    958, 533, 221, 400, 386, 867, 600, 782, 382, 596, 414, 171, 516, 375, 682, 485,
    911, 276, 98, 553, 163, 354, 666, 933, 424, 341, 533, 870, 227, 730, 475, 186,
    263, 647, 537, 686, 600, 224, 469, 68, 770, 919, 190, 373, 294, 822, 808, 206,
    184, 943, 795, 384, 383, 461, 404, 758, 839, 887, 715, 67, 618, 276, 204, 918,
    873, 777, 604, 560, 951, 160, 578, 722, 79, 804, 96, 409, 713, 940, 652, 934,
    970, 447, 318, 353, 859, 672, 112, 785, 645, 863, 803, 350, 139, 93, 354, 99,
    820, 908, 609, 772, 154, 274, 580, 184, 79, 626, 630, 742, 653, 282, 762, 623,
    680, 81, 927, 626, 789, 125, 411, 521, 938, 300, 821, 78, 343, 175, 128, 250,
    170, 774, 972, 275, 999, 639, 495, 78, 352, 126, 857, 956, 358, 619, 580, 124,
    737, 594, 701, 612, 669, 112, 134, 694, 363, 992, 809, 743, 168, 974, 944, 375,
    748, 52, 600, 747, 642, 182, 862, 81, 344, 805, 988, 739, 511, 655, 814, 334,
    249, 515, 897, 955, 664, 981, 649, 113, 974, 459, 893, 228, 433, 837, 553, 268,
    926, 240, 102, 654, 459, 51, 686, 754, 806, 760, 493, 403, 415, 394, 687, 700,
    946, 670, 656, 610, 738, 392, 760, 799, 887, 653, 978, 321, 576, 617, 626, 502,
    894, 679, 243, 440, 680, 879, 194, 572, 640, 724, 926, 56, 204, 700, 707, 151,
    457, 449, 797, 195, 791, 558, 945, 679, 297, 59, 87, 824, 713, 663, 412, 693,
    342, 606, 134, 108, 571, 364, 631, 212, 174, 643, 304, 329, 343, 97, 430, 751,
    497, 314, 983, 374, 822, 928, 140, 206, 73, 263, 980, 736, 876, 478, 430, 305,
    170, 514, 364, 692, 829, 82, 855, 953, 676, 246, 369, 970, 294, 750, 807, 827,
    150, 790, 288, 923, 804, 378, 215, 828, 592, 281, 565, 555, 710, 82, 896, 831,
    547, 261, 524, 462, 293, 465, 502, 56, 661, 821, 976, 991, 658, 869, 905, 758,
    745, 193, 768, 550, 608, 933, 378, 286, 215, 979, 792, 961, 61, 688, 793, 644,
    986, 403, 106, 366, 905, 644, 372, 567, 466, 434, 645, 210, 389, 550, 919, 135,
    780, 773, 635, 389, 707, 100, 626, 958, 165, 504, 920, 176, 193, 713, 857, 265,
    203, 50, 668, 108, 645, 990, 626, 197, 510, 357, 358, 850, 858, 364, 936, 638,
]
