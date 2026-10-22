# Yodacon Ship Pack — everything is built from the archives in sources/.
#
#   make            rebuild the assets from sources/ and rehash the manifest
#   make test       check the extractor against the 1990s bytes
#   make check      load every page in headless Chromium; fail on errors
#   make serve      preview at http://localhost:8000
#   make release    the versioned zip, in dist/
#   make capture    re-photograph the catalogue pages (dated)

PY      ?= python3
VERSION := $(shell cat VERSION)
SHOTS    = /tmp/yodacon-ship-pack-capture

.PHONY: all assets manifest test check serve release capture

all: assets

assets:
	$(PY) tools/build_pack.py

## manifest: rehash after editing pages or docs, without rebuilding assets
manifest:
	$(PY) tools/build_pack.py --manifest-only

test:
	$(PY) -m unittest discover -s tools
	node --test projects/konquest/test.mjs
	$(PY) tools/example_notes.py --check

## check: serve the pack, load every page in headless Chromium, fail on any error.
## ANGLE=vulkan where Chromium has no SwiftShader (e.g. Alpine).
ANGLE ?= swiftshader
PAGES ?= all examples/ projects/ playground/ projects/konquest/ styleguide/ projects/dom-shipyard/ projects/dom-dogfight/ projects/threejs-fleet/ projects/threejs-hangar/ projects/courier/ projects/fleet-tactics/ projects/orbital-defence/ projects/slingshot/ projects/pin-miner/ projects/cutaway/ projects/gauntlet/ projects/rally/ projects/convoy/ projects/picket/ projects/recall/ projects/blockade/ projects/dock/ projects/crossing/ projects/salvo/ projects/flak/ projects/formation/ projects/refit/
check:
	@$(PY) -m http.server 8799 --bind 127.0.0.1 >/dev/null 2>&1 & pid=$$!; sleep 1; \
	  node tools/check_pages.mjs http://127.0.0.1:8799/ $(PAGES) --angle $(ANGLE); rc=$$?; \
	  kill $$pid; exit $$rc

serve:
	$(PY) -m http.server 8000

release: test manifest
	$(PY) tools/build_pack.py --manifest-only --zip dist
	@echo "tag it: git tag -a v$(VERSION) -m 'Yodacon Ship Pack $(VERSION)'"

capture:
	node tools/capture_page.mjs "http://www.cytheraguides.com/archives/ambrosia_addons/ev/" $(SHOTS)/ev \
	  'head=^table' 'thead=thead' 'rows=tr:has(a[id="792_ConEx12.sit.hqx"])@2'
	$(PY) tools/stamp_capture.py $(SHOTS)/ev sources/screenshots/cythera-ev-conex12.png head thead rows
	node tools/capture_page.mjs "http://www.cytheraguides.com/archives/ambrosia_addons/evo/" $(SHOTS)/evo \
	  'head=^table' 'thead=thead' 'rows=tr:has(a[id="2437_ConExOverride.sit.hqx"])'
	$(PY) tools/stamp_capture.py $(SHOTS)/evo sources/screenshots/cythera-evo-conexoverride.png head thead rows
