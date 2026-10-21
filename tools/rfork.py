"""Read and write classic Macintosh resource forks, byte-identically.

The Resource Manager wrote more to disk than the documented structure:
the 240-byte "system reserved" gap after the header, the map's in-memory
header copy / next-handle / file-ref fields, per-resource attribute bytes,
and the 4 reserved handle bytes in each reference all carry live garbage
from the machine that saved the file. Data blocks and names are also
stored in the order resources were added, not ref-list order. All of it
is captured in the model so serialize(parse(fork)) == fork.
"""
import struct
from dataclasses import dataclass, field
from typing import Optional

APPLEDOUBLE_MAGICS = (0x00051600, 0x00051607)


@dataclass
class Resource:
    rtype: str            # 4 chars, MacRoman
    rid: int
    name: Optional[str]   # MacRoman, None if unnamed
    attrs: int            # resource attribute byte
    handle: bytes         # 4 reserved bytes from the reference entry
    data: bytes
    data_order: int = 0   # position of this block in the data area
    name_order: int = 0   # position of this name in the name list


@dataclass
class Fork:
    reserved: bytes = b"\x00" * 240   # bytes between header and data area
    map_header: bytes = b"\x00" * 24  # header copy + next handle + fileRef + attrs
    type_order: list = field(default_factory=list)  # 4-char type strings
    resources: list = field(default_factory=list)   # Resource, ref-list order

    def by_type(self):
        groups = {t: [] for t in self.type_order}
        for res in self.resources:
            groups[res.rtype].append(res)
        return groups


def unwrap_appledouble(raw: bytes) -> bytes:
    """Return the resource fork, unwrapping an AppleSingle/AppleDouble
    container (as written by `unar -k visible`) if present."""
    if len(raw) < 4 or struct.unpack_from(">I", raw, 0)[0] not in APPLEDOUBLE_MAGICS:
        return raw
    (num_entries,) = struct.unpack_from(">H", raw, 24)
    for i in range(num_entries):
        eid, off, length = struct.unpack_from(">III", raw, 26 + i * 12)
        if eid == 2:
            return raw[off : off + length]
    raise ValueError("AppleDouble container has no resource-fork entry")


def parse(fork: bytes) -> Fork:
    data_off, map_off, data_len, map_len = struct.unpack_from(">IIII", fork, 0)
    out = Fork(reserved=fork[16:data_off], map_header=fork[map_off : map_off + 24])
    type_list_off, name_list_off = struct.unpack_from(">HH", fork, map_off + 24)
    tl = map_off + type_list_off
    (num_types_m1,) = struct.unpack_from(">H", fork, tl)

    data_offsets, name_offsets = [], []
    for t in range(num_types_m1 + 1):
        rtype_b, count_m1, ref_off = struct.unpack_from(">4sHH", fork, tl + 2 + t * 8)
        rtype = rtype_b.decode("mac_roman")
        out.type_order.append(rtype)
        for r in range(count_m1 + 1):
            ref = tl + ref_off + r * 12
            rid, name_off = struct.unpack_from(">hH", fork, ref)
            (packed,) = struct.unpack_from(">I", fork, ref + 4)
            attrs, res_data_off = packed >> 24, packed & 0xFFFFFF
            name = None
            if name_off != 0xFFFF:
                noff = map_off + name_list_off + name_off
                name = fork[noff + 1 : noff + 1 + fork[noff]].decode("mac_roman")
            (rlen,) = struct.unpack_from(">I", fork, data_off + res_data_off)
            payload = fork[data_off + res_data_off + 4 : data_off + res_data_off + 4 + rlen]
            out.resources.append(
                Resource(rtype, rid, name, attrs, fork[ref + 8 : ref + 12], payload)
            )
            data_offsets.append(res_data_off)
            name_offsets.append(name_off)

    for order, i in enumerate(sorted(range(len(out.resources)), key=lambda i: data_offsets[i])):
        out.resources[i].data_order = order
    named = [i for i in range(len(out.resources)) if name_offsets[i] != 0xFFFF]
    for order, i in enumerate(sorted(named, key=lambda i: name_offsets[i])):
        out.resources[i].name_order = order
    return out


def serialize(fork: Fork) -> bytes:
    groups = fork.by_type()
    resources = fork.resources

    data = bytearray()
    data_offsets = {}
    for res in sorted(resources, key=lambda r: r.data_order):
        data_offsets[id(res)] = len(data)
        data += struct.pack(">I", len(res.data)) + res.data

    names = bytearray()
    name_offsets = {}
    for res in sorted((r for r in resources if r.name is not None), key=lambda r: r.name_order):
        name_offsets[id(res)] = len(names)
        encoded = res.name.encode("mac_roman")
        names += bytes([len(encoded)]) + encoded

    # Type list and ref lists, both in stored order; refs tile contiguously
    # after the type list, offsets relative to the type-list start.
    type_list = bytearray(struct.pack(">H", len(fork.type_order) - 1))
    ref_lists = bytearray()
    ref_base = 2 + len(fork.type_order) * 8
    for rtype in fork.type_order:
        group = groups[rtype]
        type_list += struct.pack(
            ">4sHH", rtype.encode("mac_roman"), len(group) - 1, ref_base + len(ref_lists)
        )
        for res in group:
            noff = name_offsets.get(id(res), 0xFFFF)
            packed = (res.attrs << 24) | data_offsets[id(res)]
            ref_lists += struct.pack(">hHI", res.rid, noff, packed) + res.handle

    type_list_off = 28  # 16-byte header copy + 4 + 2 + 2 + tlo/nlo words
    name_list_off = type_list_off + len(type_list) + len(ref_lists)
    rmap = (
        fork.map_header
        + struct.pack(">HH", type_list_off, name_list_off)
        + type_list
        + ref_lists
        + names
    )

    data_off = 16 + len(fork.reserved)
    header = struct.pack(">IIII", data_off, data_off + len(data), len(data), len(rmap))
    return header + fork.reserved + bytes(data) + bytes(rmap)
