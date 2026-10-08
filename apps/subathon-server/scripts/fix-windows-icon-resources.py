#!/usr/bin/env python3
"""Repair icon resources after rcedit on a Bun --compile Windows exe.

Bun names its icon group ``IDI_MYICON``. rcedit 2.0.0 only replaces
integer resource ids, so it adds a second group and leaves the named
one describing the old Bun icon. It also stores ``dwBytesInRes`` in
16 bits, which truncates images larger than 65535 bytes.

The ``RT_ICON`` payloads rcedit writes are complete. This script
restores full sizes and points ``IDI_MYICON`` at that group.
"""

from __future__ import annotations

import struct
import sys
from pathlib import Path

RT_ICON = 3
RT_GROUP_ICON = 14


def parse_ico(path: Path) -> list[dict]:
  data = path.read_bytes()
  reserved, kind, count = struct.unpack_from("<HHH", data, 0)
  if reserved != 0 or kind != 1 or count < 1:
    raise SystemExit(f"ICO inválido: {path}")
  images: list[dict] = []
  offset = 6
  for _ in range(count):
    width, height, _colors, _reserved, planes, bit_count, size, image_offset = (
      struct.unpack_from("<BBBBHHII", data, offset)
    )
    blob = data[image_offset : image_offset + size]
    if len(blob) != size:
      raise SystemExit(f"ICO truncado: {path}")
    images.append(
      {
        "width": 256 if width == 0 else width,
        "height": 256 if height == 0 else height,
        "planes": planes,
        "bit_count": bit_count,
        "blob": blob,
      }
    )
    offset += 16
  return images


def parse_group(blob: bytes) -> list[dict]:
  if len(blob) < 6:
    raise SystemExit("grupo de ícone menor que o cabeçalho")
  reserved, kind, count = struct.unpack_from("<HHH", blob, 0)
  if reserved != 0 or kind != 1:
    raise SystemExit("grupo de ícone inválido")
  need = 6 + count * 14
  if len(blob) < need:
    raise SystemExit("grupo de ícone truncado")
  entries: list[dict] = []
  cursor = 6
  for _ in range(count):
    width, height, _colors, _reserved, planes, bit_count, size, icon_id = (
      struct.unpack_from("<BBBBHHIH", blob, cursor)
    )
    entries.append(
      {
        "width": 256 if width == 0 else width,
        "height": 256 if height == 0 else height,
        "planes": planes,
        "bit_count": bit_count,
        "size": size,
        "id": icon_id,
        "entry_offset": cursor,
      }
    )
    cursor += 14
  return entries


class PeFile:
  def __init__(self, path: Path) -> None:
    self.path = path
    self.data = bytearray(path.read_bytes())
    if self.data[:2] != b"MZ":
      raise SystemExit(f"não é um executável PE: {path}")
    self.e_lfanew = struct.unpack_from("<I", self.data, 0x3C)[0]
    if self.data[self.e_lfanew : self.e_lfanew + 4] != b"PE\x00\x00":
      raise SystemExit(f"assinatura PE ausente: {path}")
    coff = self.e_lfanew + 4
    _machine, self.nsections, _t, _p, _s, self.opt_size, _chars = (
      struct.unpack_from("<HHIIIHH", self.data, coff)
    )
    self.opt = coff + 20
    magic = struct.unpack_from("<H", self.data, self.opt)[0]
    if magic != 0x20B:
      raise SystemExit(f"só PE32+ é suportado (magic={magic:#x})")
    self.checksum_off = self.opt + 64
    dd_off = self.opt + 112
    self.rsrc_rva, self.rsrc_size = struct.unpack_from("<II", self.data, dd_off + 16)
    self.sections: list[tuple[bytes, int, int, int]] = []
    sec_off = self.opt + self.opt_size
    for index in range(self.nsections):
      off = sec_off + index * 40
      name = bytes(self.data[off : off + 8]).split(b"\x00", 1)[0]
      _vsize, va, rawsize, rawptr = struct.unpack_from("<IIII", self.data, off + 8)
      self.sections.append((name, va, rawptr, rawsize))

  def rva_to_off(self, rva: int) -> int:
    for _name, va, rawptr, rawsize in self.sections:
      if va <= rva < va + rawsize:
        return rawptr + (rva - va)
    raise SystemExit(f"RVA fora das seções: {rva:#x}")

  def read_resource_tree(self) -> tuple[dict[int, bytes], list[dict]]:
    icons: dict[int, bytes] = {}
    groups: list[dict] = []

    def walk(relative: int, path: list[str]) -> None:
      directory = self.rva_to_off(self.rsrc_rva + relative)
      _chars, _ts, _maj, _min, nnames, nids = struct.unpack_from(
        "<IIHHHH", self.data, directory
      )
      entry_off = directory + 16
      for index in range(nnames + nids):
        name_field, offset_field = struct.unpack_from(
          "<II", self.data, entry_off + index * 8
        )
        is_name = bool(name_field & 0x80000000)
        is_dir = bool(offset_field & 0x80000000)
        name_value = name_field & 0x7FFFFFFF
        child = offset_field & 0x7FFFFFFF
        if is_name:
          name_off = self.rva_to_off(self.rsrc_rva + name_value)
          length = struct.unpack_from("<H", self.data, name_off)[0]
          label = self.data[name_off + 2 : name_off + 2 + length * 2].decode(
            "utf-16le"
          )
        else:
          label = str(name_value)
        if is_dir:
          walk(child, path + [label])
          continue
        data_entry = self.rva_to_off(self.rsrc_rva + child)
        data_rva, size, _codepage, _reserved = struct.unpack_from(
          "<IIII", self.data, data_entry
        )
        blob_off = self.rva_to_off(data_rva)
        blob = bytes(self.data[blob_off : blob_off + size])
        kind = path[0] if path else ""
        if kind == str(RT_ICON) and len(path) >= 2 and path[1].isdigit():
          icons[int(path[1])] = blob
        elif kind == str(RT_GROUP_ICON):
          groups.append(
            {
              "name": path[1] if len(path) > 1 else label,
              "data_entry": data_entry,
              "data_rva": data_rva,
              "size": size,
              "blob_off": blob_off,
              "blob": blob,
            }
          )

    walk(0, [])
    return icons, groups

  def patch_checksum(self) -> None:
    struct.pack_into("<I", self.data, self.checksum_off, 0)
    checksum = 0
    length = len(self.data)
    limit = length - (length % 2)
    for offset in range(0, limit, 2):
      checksum += struct.unpack_from("<H", self.data, offset)[0]
      checksum = (checksum & 0xFFFF) + (checksum >> 16)
    if length % 2:
      checksum += self.data[-1]
      checksum = (checksum & 0xFFFF) + (checksum >> 16)
    checksum = (checksum & 0xFFFF) + (checksum >> 16)
    checksum += length
    struct.pack_into("<I", self.data, self.checksum_off, checksum & 0xFFFFFFFF)

  def save(self) -> None:
    self.patch_checksum()
    self.path.write_bytes(self.data)


def fix(exe_path: Path, ico_path: Path) -> None:
  expected = parse_ico(ico_path)
  pe = PeFile(exe_path)
  icons, groups = pe.read_resource_tree()
  if not groups:
    raise SystemExit("executável sem RT_GROUP_ICON")

  by_blob = {image["blob"]: image for image in expected}
  matching: list[dict] = []
  for group in groups:
    try:
      entries = parse_group(group["blob"])
    except SystemExit:
      continue
    if len(entries) != len(expected):
      continue
    ok = True
    for entry in entries:
      blob = icons.get(entry["id"])
      if blob is None or blob not in by_blob:
        ok = False
        break
      image = by_blob[blob]
      if image["width"] != entry["width"] or image["height"] != entry["height"]:
        ok = False
        break
    if ok:
      matching.append(group)
  if not matching:
    raise SystemExit(
      "não achei grupo com as "
      f"{len(expected)} imagens do ICO"
    )
  good = matching[0]
  for group in matching[1:]:
    if group["blob"] != good["blob"] and group["data_rva"] != good["data_rva"]:
      raise SystemExit("há mais de um grupo diferente com as imagens do ICO")
  entries = parse_group(good["blob"])
  for entry in entries:
    actual = len(icons[entry["id"]])
    if entry["size"] == actual:
      continue
    if (entry["size"] & 0xFFFF) != (actual & 0xFFFF):
      raise SystemExit(
        f"tamanho do ícone {entry['id']} não confere: "
        f"grupo={entry['size']} recurso={actual}"
      )
    struct.pack_into(
      "<I",
      pe.data,
      good["blob_off"] + entry["entry_offset"] + 8,
      actual,
    )
    print(
      f"corrigido dwBytesInRes id={entry['id']} "
      f"{entry['width']}x{entry['height']}: {entry['size']} -> {actual}"
    )

  good_rva = good["data_rva"]
  good_size = good["size"]
  for group in groups:
    current_rva, current_size = struct.unpack_from("<II", pe.data, group["data_entry"])
    if current_rva == good_rva and current_size == good_size:
      continue
    struct.pack_into("<II", pe.data, group["data_entry"], good_rva, good_size)
    print(f"grupo {group['name']} agora aponta para o ícone novo")

  pe.save()

  pe = PeFile(exe_path)
  icons, groups = pe.read_resource_tree()
  for image in expected:
    if image["blob"] not in icons.values():
      raise SystemExit(
        f"imagem {image['width']}x{image['height']} ausente no executável"
      )
  seen = {image["blob"] for image in expected}
  for group in groups:
    entries = parse_group(group["blob"])
    if len(entries) != len(expected):
      raise SystemExit(
        f"grupo {group['name']} não ficou com {len(expected)} imagens"
      )
    found: set[bytes] = set()
    for entry in entries:
      blob = icons[entry["id"]]
      if entry["size"] != len(blob) or blob not in seen:
        raise SystemExit(
          f"grupo {group['name']} divergente em {entry['width']}px"
        )
      found.add(blob)
    if found != seen:
      raise SystemExit(f"grupo {group['name']} não cobre todas as imagens")
    print(f"ok grupo {group['name']}: {len(entries)} tamanhos")
  print(f"ícone aplicado: {exe_path}")


def main() -> None:
  if len(sys.argv) != 3:
    raise SystemExit(
      "uso: fix-windows-icon-resources.py <exe> <ico>"
    )
  fix(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
  main()
