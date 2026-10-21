"""StuffIt archive reader: the classic format (StuffIt 1.5-4, "SIT!") and
StuffIt 5, for the compression methods the ConEx releases use.

  ConEx 1.2 (1997)            StuffIt 5, forks in method 15 (Arsenic)
  ConEx Override 1.0 (1998)   classic StuffIt, forks in method 13

Each member comes back with its Finder type and creator, dates, and both forks.
Classic forks are checked against their CRC-16; Arsenic checks its own CRC-32.
"""
import struct
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import arsenic
import sit13

MAC_EPOCH = datetime(1904, 1, 1)


@dataclass
class Member:
    path: str
    type: bytes
    creator: bytes
    created: datetime
    modified: datetime
    data: bytes = b""
    rsrc: bytes = b""
    methods: dict = field(default_factory=dict)


def mac_date(seconds: int) -> datetime:
    return MAC_EPOCH + timedelta(seconds=seconds)


def _crc16_arc_table():
    table = []
    for n in range(256):
        c = n
        for _ in range(8):
            c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
        table.append(c)
    return table


ARC = _crc16_arc_table()


def crc16_arc(data: bytes) -> int:
    crc = 0
    for b in data:
        crc = (crc >> 8) ^ ARC[(crc ^ b) & 0xFF]
    return crc


def unpack(method: int, data: bytes, size: int) -> bytes:
    method &= 0x0F  # the high bits flag encryption and folders
    if method == 0:
        return data[:size]
    if method == 13:
        return sit13.decompress(data, size)
    if method == 15:
        return arsenic.decompress(data, size)
    raise NotImplementedError(f"StuffIt compression method {method}")


def read(archive: bytes) -> list:
    if archive.startswith(b"SIT!"):
        return _classic(archive)
    if archive.startswith(b"StuffIt (c)1997"):
        return _sit5(archive)
    raise ValueError("not a StuffIt archive this reader knows")


def _classic(buf: bytes) -> list:
    members, folders, pos = [], [], 22
    (total,) = struct.unpack_from(">I", buf, 6)
    while pos + 112 <= min(total, len(buf)):
        h = buf[pos:pos + 112]
        rmethod, dmethod, namelen = h[0], h[1], h[2]
        name = h[3:3 + namelen].decode("mac_roman")
        (ftype, creator, _flags, cdate, mdate, rlen, dlen, crlen, cdlen,
         rcrc, dcrc) = struct.unpack_from(">4s4sHIIIIIIHH", h, 66)
        pos += 112
        if rmethod == 32 or dmethod == 32:  # folder start
            folders.append(name)
            continue
        if rmethod == 33 or dmethod == 33:  # folder end
            folders.pop()
            continue
        rsrc = unpack(rmethod, buf[pos:pos + crlen], rlen)
        data = unpack(dmethod, buf[pos + crlen:pos + crlen + cdlen], dlen)
        for fork, crc, what in ((rsrc, rcrc, "resource"), (data, dcrc, "data")):
            if fork and crc16_arc(fork) != crc:
                raise ValueError(f"{name}: {what} fork CRC mismatch")
        pos += crlen + cdlen
        members.append(Member("/".join(folders + [name]), ftype, creator,
                              mac_date(cdate), mac_date(mdate), data, rsrc,
                              {"rsrc": rmethod & 0x0F, "data": dmethod & 0x0F}))
    return members


def _sit5(buf: bytes) -> list:
    """Entries follow one another: a header of `headersize` bytes, a second
    header with the Finder info and the resource fork's sizes, then the
    compressed resource fork and the compressed data fork."""
    members, paths = [], {}
    pos = struct.unpack_from(">I", buf, 94)[0]  # first top-level entry
    while pos + 4 <= len(buf) and buf[pos:pos + 4] == b"\xA5\xA5\xA5\xA5":
        version = buf[pos + 4]
        headersize = struct.unpack_from(">H", buf, pos + 6)[0]
        flags = buf[pos + 9]
        cdate, mdate, _prev, _next, parent, namelen = struct.unpack_from(">IIIIIH", buf, pos + 10)
        dlen, cdlen = struct.unpack_from(">II", buf, pos + 34)
        name = buf[pos + 48:pos + 48 + namelen].decode("mac_roman")
        path = "/".join(p for p in (paths.get(parent, ""), name) if p)
        if flags & 0x40 and dlen == 0xFFFFFFFF:  # folder-end marker: header only
            pos += headersize
            continue

        p2 = pos + headersize
        flags2 = struct.unpack_from(">H", buf, p2)[0]
        ftype, creator = buf[p2 + 4:p2 + 8], buf[p2 + 8:p2 + 12]
        p2 += 14 + (22 if version == 1 else 18)
        if flags & 0x40:  # folder
            paths[pos] = path
            pos = p2
            continue
        dmethod = buf[pos + 46]
        rlen = crlen = rmethod = 0
        if flags2 & 0x01:  # has a resource fork
            rlen, crlen = struct.unpack_from(">II", buf, p2)
            rmethod = buf[p2 + 12]
            p2 += 14 + buf[p2 + 13]
        rsrc = unpack(rmethod, buf[p2:p2 + crlen], rlen)
        data = unpack(dmethod, buf[p2 + crlen:p2 + crlen + cdlen], dlen)
        members.append(Member(path, ftype, creator, mac_date(cdate), mac_date(mdate),
                              data, rsrc, {"rsrc": rmethod, "data": dmethod}))
        pos = p2 + crlen + cdlen
    return members
