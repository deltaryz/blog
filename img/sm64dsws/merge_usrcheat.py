#!/usr/bin/env python3
"""
Portable merger for TWiLightMenu-style R4 usrcheat.dat cheat databases.

Usage:
    ./merge_usrcheat.py OUTPUT.dat INPUT1.dat [INPUT2.dat INPUT3.dat ...]

For games (matched by game_id + checksum) that appear in more than one
input file - or more than once within the SAME input file, some real
databases have duplicate rows - their cheat/folder item lists are
concatenated in argument order (and original row order for duplicate
rows within one file): items from the FIRST file/row that contains
that game land at the top, items from later files/rows are appended
after. Identical top-level items (same folder/cheat content, byte for
byte) are only kept once, so merging files/rows that share overlapping
cheats doesn't double them up.

Games that only appear once across all input (no key collision at all)
are copied through unchanged (byte-for-byte, no re-parse) so untouched
entries can never be corrupted by this tool.

A single input file is valid too - useful as a standalone "dedupe this
file's internal duplicate rows" pass.

Known limitations (by design, to avoid ever guessing/discarding real
user data):
- Dedup is exact-byte-match only, at the top-level item (folder or
  cheat) granularity. Two folders with the same title but different
  children are NOT recursively merged - both are kept as separate
  sibling folders. Two cheats with the same title but different code
  values are both kept, since which one is "correct" can't be inferred.
- When merging metadata for a repeated game (title/enabled/master
  codes), the FIRST file/row that has that key wins; only the item
  lists are unioned across all sources.

Single-file, stdlib-only - no dependencies beyond Python 3.
"""
import sys
import struct

HEADER_SIZE = 0x100

# ---------- codec (ported from natereprogle/R4Everyone's C# R4Codecs.cs,
# corrected against real usrcheat.dat byte layout - a naive reading of the
# C# source gets two alignment rules wrong, see align4/align4_with_extra
# below for what's actually going on and how it was confirmed) ----------


def align4(pos):
    """Byte offset padded up to the next 4-byte boundary (0 padding if
    already aligned). This is the rule the real file format uses when
    parsing game titles and item title/description strings - not the
    "always add a spare block" rule the C# source's naming suggests."""
    return pos + ((4 - pos % 4) % 4)


def read_cstr(data, pos):
    end = data.index(b'\x00', pos)
    return data[pos:end], end + 1


def parse_address_table(data):
    entries = []
    pos = HEADER_SIZE
    while pos + 16 <= len(data):
        chunk = data[pos:pos + 16]
        if chunk == b'\x00' * 16:
            return entries, pos
        game_id = chunk[0:4]
        checksum = chunk[4:8]
        offset = struct.unpack_from('<I', chunk, 8)[0]
        entries.append({'game_id': game_id, 'checksum': checksum, 'offset': offset})
        pos += 16
    return entries, pos


def compute_lengths(entries, filesize):
    ordered = sorted(entries, key=lambda e: e['offset'])
    for i, e in enumerate(ordered):
        nxt = ordered[i + 1]['offset'] if i + 1 < len(ordered) else filesize
        e['length'] = nxt - e['offset']
    return ordered


FOLDER_NORMAL = 0x1000
FOLDER_ONEHOT = 0x1100
CHEAT_DISABLED = 0x0000
CHEAT_ENABLED = 0x0100


def is_folder(t):
    return t in (FOLDER_NORMAL, FOLDER_ONEHOT)


def read_item(data, pos):
    num_items = struct.unpack_from('<H', data, pos)[0]
    item_type = struct.unpack_from('<H', data, pos + 2)[0]
    pos += 4
    title, pos = read_cstr(data, pos)
    desc, pos = read_cstr(data, pos)
    pos = align4(pos)
    if is_folder(item_type):
        items = []
        for _ in range(num_items):
            child, pos = read_item(data, pos)
            items.append(child)
        return {'kind': 'folder', 'title': title, 'description': desc,
                'one_hot': item_type == FOLDER_ONEHOT, 'items': items}, pos
    else:
        num_chunks = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        code = []
        for _ in range(num_chunks):
            code.append(data[pos:pos + 4])
            pos += 4
        return {'kind': 'cheat', 'title': title, 'description': desc,
                'enabled': item_type == CHEAT_ENABLED, 'code': code}, pos


def count_flattened(item):
    count = 1
    if item['kind'] == 'folder':
        for c in item['items']:
            count += count_flattened(c)
    return count


def align4_with_extra(pos):
    """Used only for the cheat item's declared size field, which is written
    to the file but never actually read back by any known parser. Unlike
    align4() above, this one always adds one full extra 4-byte block on top
    of the normal round-up, even when already aligned - confirmed by
    comparing this field's value against real cheat entries with both
    already-aligned and non-aligned title/description lengths."""
    return ((pos + 3) & ~3) + 4


def cheat_size(item):
    total = len(item['title']) + 1 + len(item['description']) + 1
    aligned = align4_with_extra(total)
    return aligned + 4 + 4 * len(item['code'])


def write_title_desc(buf, title, desc):
    buf += title
    buf += b'\x00'
    buf += desc
    buf += b'\x00'
    pos = len(buf)
    aligned = align4(pos)
    buf += b'\x00' * (aligned - pos)
    return buf


def write_item(buf, item):
    if item['kind'] == 'folder':
        buf += struct.pack('<H', len(item['items']))
        buf += struct.pack('<H', FOLDER_ONEHOT if item.get('one_hot') else FOLDER_NORMAL)
        buf = write_title_desc(buf, item['title'], item.get('description', b''))
        for child in item['items']:
            buf = write_item(buf, child)
        return buf
    else:
        size = cheat_size(item)
        count_field = min((size - 1) // 4, 0xFFFF)
        buf += struct.pack('<H', count_field)
        buf += struct.pack('<H', CHEAT_ENABLED if item.get('enabled') else CHEAT_DISABLED)
        buf = write_title_desc(buf, item['title'], item.get('description', b''))
        buf += struct.pack('<I', len(item['code']))
        for chunk in item['code']:
            buf += chunk
        return buf


def read_game_blob(blob):
    title, pos = read_cstr(blob, 0)
    pos = align4(pos)
    num_items = struct.unpack_from('<H', blob, pos)[0]
    pos += 2
    enabled_bytes = blob[pos:pos + 2]
    pos += 2
    master_codes = list(struct.unpack_from('<8I', blob, pos))
    pos += 32
    items = []
    items_seen = 0
    while items_seen < num_items:
        item, pos = read_item(blob, pos)
        items.append(item)
        items_seen += count_flattened(item)
    # both of these should be mathematically guaranteed by a correct parse,
    # so failing either means the alignment/size logic above has a bug for
    # this particular blob - fail loudly here instead of silently returning
    # a game with truncated or misaligned data.
    assert pos == len(blob), f"parse did not consume full blob: {pos} vs {len(blob)}"
    assert items_seen == num_items, f"flattened count mismatch: {items_seen} vs {num_items}"
    return {'title': title, 'enabled': enabled_bytes[1] == 0xF0,
            'master_codes': master_codes, 'items': items}


def write_game_blob(game):
    buf = bytearray()
    buf += game['title']
    buf += b'\x00'
    pos = len(buf)
    aligned = align4(pos)
    buf += b'\x00' * (aligned - pos)
    flattened = sum(count_flattened(i) for i in game['items'])
    buf += struct.pack('<H', min(flattened, 0xFFFF))
    buf += struct.pack('<H', 0xF000 if game['enabled'] else 0x0000)
    for mc in game['master_codes']:
        buf += struct.pack('<I', mc)
    for item in game['items']:
        buf = write_item(buf, item)
    return bytes(buf)


# ---------- merge logic ----------


def load_file(path):
    """Returns (header, blobs_by_key, key_order). blobs_by_key maps key ->
    LIST of blobs, since a single input file can itself contain duplicate
    (game_id, checksum) rows (observed in real production databases) - every
    occurrence is preserved, never silently dropped."""
    data = open(path, 'rb').read()
    entries, _ = parse_address_table(data)
    ordered = compute_lengths(entries, len(data))
    by_key = {}
    key_order = []
    seen = set()
    for e in ordered:
        key = (e['game_id'], e['checksum'])
        blob = data[e['offset']:e['offset'] + e['length']]
        by_key.setdefault(key, []).append(blob)
        if key not in seen:
            seen.add(key)
            key_order.append(key)
    return data[:HEADER_SIZE], by_key, key_order


def main():
    if len(sys.argv) < 3:
        sys.stderr.write(__doc__ + "\n")
        sys.exit(1)

    out_path = sys.argv[1]
    in_paths = sys.argv[2:]

    files = [load_file(p) for p in in_paths]
    header = files[0][0]

    key_order = []
    seen = set()
    for _, _, korder in files:
        for k in korder:
            if k not in seen:
                seen.add(k)
                key_order.append(k)

    final_entries = []
    merged_count = 0
    single_count = 0
    for key in key_order:
        # every occurrence of this key, across all files, in argument order
        # (and in original row order for any duplicate rows within one file)
        matches = []
        for _, by_key, _ in files:
            matches.extend(by_key.get(key, []))
        if len(matches) == 1:
            # untouched game: copy the original bytes verbatim rather than
            # parsing and re-serializing. even though the codec round-trips
            # correctly (verified against a full real-world database, tens
            # of thousands of cheats, byte-for-byte), there's no reason to
            # put a game anywhere near the parser if nothing about it needs
            # to change - fewer opportunities for corruption that way.
            final_entries.append({'game_id': key[0], 'checksum': key[1], 'bytes': matches[0]})
            single_count += 1
        else:
            games = [read_game_blob(b) for b in matches]
            merged_items = []
            seen_items = set()
            for g in games:
                for item in g['items']:
                    # fingerprint = the item's own serialized bytes. two
                    # cheats/folders are only treated as "the same" if every
                    # byte matches - title, description, and code words. this
                    # was checked against merging a real production database
                    # with a second copy of itself: every (game, cheat)
                    # pair that existed before the merge still existed after,
                    # and nothing new was fabricated, confirmed by diffing
                    # the complete before/after content sets directly rather
                    # than just comparing counts.
                    fingerprint = bytes(write_item(bytearray(), item))
                    if fingerprint in seen_items:
                        continue
                    seen_items.add(fingerprint)
                    merged_items.append(item)
            # metadata (title, enabled flag, master codes) comes from
            # whichever file/row was encountered first for this key - only
            # the item lists get combined across sources.
            base = dict(games[0])
            base['items'] = merged_items
            new_blob = write_game_blob(base)
            # re-parse what was just written and check it comes back out
            # the same size as what went in, as a guard against a future
            # change to the write path silently dropping something.
            check = read_game_blob(new_blob)
            assert len(check['items']) == len(merged_items), "merge round-trip item count mismatch"
            final_entries.append({'game_id': key[0], 'checksum': key[1], 'bytes': new_blob})
            merged_count += 1

    print(f"games merged across files: {merged_count}, unchanged (single-source): {single_count}, "
          f"total: {len(final_entries)}", file=sys.stderr)

    addr_table_size = len(final_entries) * 16 + 16
    blob_start = HEADER_SIZE + addr_table_size
    addr_table = bytearray()
    blob_region = bytearray()
    cursor = blob_start
    for fe in final_entries:
        row = bytearray(16)
        row[0:4] = fe['game_id']
        row[4:8] = fe['checksum']
        struct.pack_into('<I', row, 8, cursor)
        addr_table += row
        blob_region += fe['bytes']
        cursor += len(fe['bytes'])
    addr_table += b'\x00' * 16

    output = header + bytes(addr_table) + bytes(blob_region)
    with open(out_path, 'wb') as f:
        f.write(output)
    print(f"wrote {out_path} ({len(output)} bytes)", file=sys.stderr)


if __name__ == '__main__':
    main()
