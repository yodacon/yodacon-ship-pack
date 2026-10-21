"""Decode and re-encode resources using ResEdit TMPL templates.

ConEx carries a TMPL for every EV game type it uses; each TMPL resource is
named after the type it describes (TMPL 130 "shïp", TMPL 136 "mïsn", ...),
so the plugin documents its own binary formats. Decoding is only trusted
when re-encoding the decoded fields reproduces the original bytes; callers
fall back to raw storage otherwise.

Field types observed in ConEx's templates: DWRD, DLNG, HWRD, HLNG, RECT,
PSTR, CSTR.
"""
import struct


def parse_tmpl(buf: bytes):
    """TMPL payload -> list of (label, field-type) pairs."""
    fields, pos = [], 0
    while pos < len(buf):
        n = buf[pos]
        label = buf[pos + 1 : pos + 1 + n].decode("mac_roman")
        ftype = buf[pos + 1 + n : pos + 5 + n].decode("mac_roman")
        fields.append((label, ftype))
        pos += 5 + n
    return fields


def decode(fields, data: bytes):
    """Apply a template to a resource payload.

    Returns a list of [label, value] pairs (a list, not a dict: TMPL labels
    repeat). Trailing bytes beyond the template land under "_tail" as hex.
    Raises ValueError on any field the template runs past the data.
    """
    out, pos = [], 0
    for label, ftype in fields:
        if ftype == "DWRD":
            (v,) = struct.unpack_from(">h", data, pos)
            pos += 2
        elif ftype == "DLNG":
            (v,) = struct.unpack_from(">i", data, pos)
            pos += 4
        elif ftype == "HWRD":
            v = "0x%04X" % struct.unpack_from(">H", data, pos)[0]
            pos += 2
        elif ftype == "HLNG":
            v = "0x%08X" % struct.unpack_from(">I", data, pos)[0]
            pos += 4
        elif ftype == "RECT":
            v = list(struct.unpack_from(">hhhh", data, pos))
            pos += 8
        elif ftype == "PSTR":
            n = data[pos]
            v = data[pos + 1 : pos + 1 + n].decode("mac_roman")
            if len(v) != n:
                raise ValueError("PSTR runs past end of data")
            pos += 1 + n
        elif ftype == "CSTR":
            end = data.index(b"\x00", pos)
            v = data[pos:end].decode("mac_roman")
            pos = end + 1
        else:
            raise ValueError(f"unsupported TMPL field type {ftype!r}")
        out.append([label, v])
    if pos < len(data):
        out.append(["_tail", data[pos:].hex()])
    return out


def encode(fields, decoded) -> bytes:
    """Inverse of decode(); decoded is the [label, value] pair list."""
    out = bytearray()
    values = list(decoded)
    for label, ftype in fields:
        dlabel, v = values.pop(0)
        if dlabel != label:
            raise ValueError(f"field order mismatch: {dlabel!r} vs {label!r}")
        if ftype == "DWRD":
            out += struct.pack(">h", v)
        elif ftype == "DLNG":
            out += struct.pack(">i", v)
        elif ftype == "HWRD":
            out += struct.pack(">H", int(v, 16))
        elif ftype == "HLNG":
            out += struct.pack(">I", int(v, 16))
        elif ftype == "RECT":
            out += struct.pack(">hhhh", *v)
        elif ftype == "PSTR":
            encoded = v.encode("mac_roman")
            out += bytes([len(encoded)]) + encoded
        elif ftype == "CSTR":
            out += v.encode("mac_roman") + b"\x00"
        else:
            raise ValueError(f"unsupported TMPL field type {ftype!r}")
    if values:
        dlabel, v = values.pop(0)
        if dlabel != "_tail" or values:
            raise ValueError("unexpected trailing fields in decoded resource")
        out += bytes.fromhex(v)
    return bytes(out)


def templates_in(fork) -> dict:
    """Map resource type -> parsed TMPL fields, from the fork's own TMPLs."""
    return {
        res.name: parse_tmpl(res.data)
        for res in fork.resources
        if res.rtype == "TMPL" and res.name
    }
