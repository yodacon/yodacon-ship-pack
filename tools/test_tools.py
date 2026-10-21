"""Tests for the extractor: every layer must reproduce the 1990s bytes.

Run: python3 -m unittest discover -s tools      (from the pack root)
"""
import hashlib
import sys
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import binhex  # noqa: E402
import extract  # noqa: E402
import rfork  # noqa: E402

PACK = TOOLS.parent


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# (archive, member, resource-fork bytes): the forks as the 1990s Mac had them.
# ConEx 1.2's were first checked resource by resource against an extraction
# made with The Unarchiver; all 758 resources matched.
FORKS = [
    ("sources/ev/792_ConEx12.sit.hqx", "ConEx 1.2/ConEx1.2", 1_522_938),
    ("sources/ev/792_ConEx12.sit.hqx", "ConEx 1.2/ConEx Readme 1.2", 398_146),
    ("sources/evo/2437_ConExOverride.sit.hqx", "ConEx Override1.0.0/ConEx Override 1.0", 2_867_833),
    ("sources/evo/2437_ConExOverride.sit.hqx", "ConEx Override1.0.0/ConEx Readme 1.0", 403_545),
    ("sources/ev/793_ConEx12u.sit.hqx", "ConEx 1.2 Patches/ConEx1.2 patch", 165_980),
]


class BinHexTest(unittest.TestCase):
    def test_crc16_xmodem_check_value(self):
        self.assertEqual(binhex.crc16(b"123456789"), 0x31C3)

    def test_unwraps_the_sit_byte_for_byte(self):
        mf = binhex.decode((PACK / "sources/ev/792_ConEx12.sit.hqx").read_bytes())
        self.assertEqual(mf.name, "ConEx 1.2.sit")
        self.assertEqual(sha(mf.data), sha((PACK / "sources/ev/ConEx 1.2.sit").read_bytes()))


class StuffItTest(unittest.TestCase):
    archives = {}

    def members(self, archive):
        if archive not in self.archives:
            self.archives[archive] = {m.path: m for m in extract.read_archive(PACK / archive)[0]}
        return self.archives[archive]

    def test_forks_decompress_to_their_recorded_sizes(self):
        # sizes are checked here; every fork also passed its own CRC on the way
        for archive, member, size in FORKS:
            with self.subTest(member=member):
                self.assertEqual(len(self.members(archive)[member].rsrc), size)

    def test_resource_forks_round_trip(self):
        for archive, member, _ in FORKS[:4]:
            with self.subTest(member=member):
                fork = self.members(archive)[member].rsrc
                self.assertEqual(rfork.serialize(rfork.parse(fork)), fork)

    def test_both_methods_were_exercised(self):
        conex = self.members(FORKS[0][0])[FORKS[0][1]]
        override = self.members(FORKS[2][0])[FORKS[2][1]]
        self.assertEqual(conex.methods["rsrc"], 15)     # Arsenic
        self.assertEqual(override.methods["rsrc"], 13)  # LZ + Huffman


if __name__ == "__main__":
    unittest.main()
