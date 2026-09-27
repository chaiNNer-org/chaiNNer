from __future__ import annotations

import ctypes
import re
import sys
from collections import defaultdict
from ctypes import wintypes
from dataclasses import dataclass

from logger import logger

# GPU load and VRAM usage for any Windows display adapter, read from the same
# sources Task Manager uses: DXGI for the adapter list and VRAM size, and the
# "GPU Engine" / "GPU Adapter Memory" performance counters for the live numbers.
#
# This exists because there is no NVML equivalent for AMD on Windows: amdsmi is
# Linux-only, and WMI's AdapterRAM is a uint32 that caps out at 4 GB.

VENDOR_AMD = 0x1002
VENDOR_NVIDIA = 0x10DE

_DXGI_ADAPTER_FLAG_SOFTWARE = 0x2
_DXGI_ERROR_NOT_FOUND = -2005270526  # 0x887A0002

_PDH_MORE_DATA = -2147481646  # 0x800007D2
_PDH_FMT_DOUBLE = 0x00000200
_PDH_FMT_LARGE = 0x00000400
_PDH_FMT_NOCAP100 = 0x00008000
_PDH_CSTATUS_VALID_DATA = 0x0
_PDH_CSTATUS_NEW_DATA = 0x1

# Integrated GPUs only get a small carve-out as "dedicated" memory and live off
# shared system memory. Below this, dedicated + shared is the honest total.
_UMA_DEDICATED_THRESHOLD = 1024**3

_LUID_RE = re.compile(r"luid_0x([0-9a-f]+)_0x([0-9a-f]+)", re.IGNORECASE)
_ENGINE_RE = re.compile(r"(luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\d+_eng_\d+)", re.IGNORECASE)


class _LUID(ctypes.Structure):
    _fields_ = [("LowPart", wintypes.DWORD), ("HighPart", wintypes.LONG)]


class _DXGI_ADAPTER_DESC1(ctypes.Structure):  # noqa: N801
    _fields_ = [
        ("Description", wintypes.WCHAR * 128),
        ("VendorId", wintypes.UINT),
        ("DeviceId", wintypes.UINT),
        ("SubSysId", wintypes.UINT),
        ("Revision", wintypes.UINT),
        ("DedicatedVideoMemory", ctypes.c_size_t),
        ("DedicatedSystemMemory", ctypes.c_size_t),
        ("SharedSystemMemory", ctypes.c_size_t),
        ("AdapterLuid", _LUID),
        ("Flags", wintypes.UINT),
    ]


class _GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


# {770aae78-f26f-4dba-a829-253c83d1b387}
_IID_IDXGIFactory1 = _GUID(
    0x770AAE78,
    0xF26F,
    0x4DBA,
    (ctypes.c_ubyte * 8)(0xA8, 0x29, 0x25, 0x3C, 0x83, 0xD1, 0xB3, 0x87),
)

# COM vtable slots.
_RELEASE = 2
_FACTORY1_ENUM_ADAPTERS1 = 12
_ADAPTER1_GET_DESC1 = 10


def _com_method(obj: ctypes.c_void_p, index: int, *argtypes):
    vtable = ctypes.cast(obj, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
    prototype = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, *argtypes)
    return prototype(vtable[index])


def _release(obj: ctypes.c_void_p) -> None:
    if obj:
        _com_method(obj, _RELEASE)(obj)


@dataclass(frozen=True)
class Adapter:
    name: str
    vendor_id: int
    luid: tuple[int, int]
    """(HighPart, LowPart), both as unsigned 32-bit ints."""
    dedicated_total: int
    shared_total: int

    @property
    def is_uma(self) -> bool:
        return self.dedicated_total < _UMA_DEDICATED_THRESHOLD


def _enum_adapters() -> list[Adapter]:
    dxgi = ctypes.WinDLL("dxgi")
    factory = ctypes.c_void_p()
    hr = dxgi.CreateDXGIFactory1(ctypes.byref(_IID_IDXGIFactory1), ctypes.byref(factory))
    if hr < 0:
        raise OSError(f"CreateDXGIFactory1 failed: 0x{hr & 0xFFFFFFFF:08X}")

    adapters: list[Adapter] = []
    seen: set[tuple[int, int]] = set()
    try:
        enum_adapters1 = _com_method(
            factory,
            _FACTORY1_ENUM_ADAPTERS1,
            wintypes.UINT,
            ctypes.POINTER(ctypes.c_void_p),
        )
        index = 0
        while True:
            adapter = ctypes.c_void_p()
            hr = enum_adapters1(factory, index, ctypes.byref(adapter))
            if hr == _DXGI_ERROR_NOT_FOUND:
                break
            index += 1
            if hr < 0:
                continue
            try:
                desc = _DXGI_ADAPTER_DESC1()
                get_desc1 = _com_method(
                    adapter, _ADAPTER1_GET_DESC1, ctypes.POINTER(_DXGI_ADAPTER_DESC1)
                )
                if get_desc1(adapter, ctypes.byref(desc)) < 0:
                    continue
            finally:
                _release(adapter)

            if desc.Flags & _DXGI_ADAPTER_FLAG_SOFTWARE:
                continue
            luid = (desc.AdapterLuid.HighPart & 0xFFFFFFFF, desc.AdapterLuid.LowPart)
            if luid in seen:
                continue
            seen.add(luid)
            adapters.append(
                Adapter(
                    name=desc.Description,
                    vendor_id=desc.VendorId,
                    luid=luid,
                    dedicated_total=desc.DedicatedVideoMemory,
                    shared_total=desc.SharedSystemMemory,
                )
            )
    finally:
        _release(factory)

    return adapters


class _PDH_FMT_COUNTERVALUE_UNION(ctypes.Union):  # noqa: N801
    _fields_ = [
        ("longValue", wintypes.LONG),
        ("doubleValue", ctypes.c_double),
        ("largeValue", ctypes.c_longlong),
    ]


class _PDH_FMT_COUNTERVALUE(ctypes.Structure):  # noqa: N801
    _fields_ = [("CStatus", wintypes.DWORD), ("value", _PDH_FMT_COUNTERVALUE_UNION)]


class _PDH_FMT_COUNTERVALUE_ITEM_W(ctypes.Structure):  # noqa: N801
    _fields_ = [("szName", wintypes.LPWSTR), ("FmtValue", _PDH_FMT_COUNTERVALUE)]


class _PdhQuery:
    def __init__(self, paths: list[str]):
        self._pdh = ctypes.WinDLL("pdh")
        self._query = ctypes.c_void_p()
        status = self._pdh.PdhOpenQueryW(None, None, ctypes.byref(self._query))
        if status != 0:
            raise OSError(f"PdhOpenQueryW failed: 0x{status & 0xFFFFFFFF:08X}")

        self._counters: dict[str, ctypes.c_void_p] = {}
        for path in paths:
            counter = ctypes.c_void_p()
            status = self._pdh.PdhAddEnglishCounterW(
                self._query, ctypes.c_wchar_p(path), None, ctypes.byref(counter)
            )
            if status != 0:
                self.close()
                raise OSError(
                    f"PdhAddEnglishCounterW({path}) failed: 0x{status & 0xFFFFFFFF:08X}"
                )
            self._counters[path] = counter

    def collect(self) -> None:
        # Wildcard instances are re-enumerated on every collect, so processes
        # that start using the GPU later are picked up automatically.
        self._pdh.PdhCollectQueryData(self._query)

    def values(self, path: str, fmt: int) -> dict[str, float]:
        counter = self._counters[path]
        size = wintypes.DWORD(0)
        count = wintypes.DWORD(0)
        status = self._pdh.PdhGetFormattedCounterArrayW(
            counter, fmt, ctypes.byref(size), ctypes.byref(count), None
        )
        if status != _PDH_MORE_DATA or size.value == 0:
            return {}

        buffer = (ctypes.c_byte * size.value)()
        status = self._pdh.PdhGetFormattedCounterArrayW(
            counter, fmt, ctypes.byref(size), ctypes.byref(count), buffer
        )
        if status != 0:
            return {}

        items = ctypes.cast(buffer, ctypes.POINTER(_PDH_FMT_COUNTERVALUE_ITEM_W))
        result: dict[str, float] = {}
        for i in range(count.value):
            item = items[i]
            if item.FmtValue.CStatus not in (
                _PDH_CSTATUS_VALID_DATA,
                _PDH_CSTATUS_NEW_DATA,
            ):
                # Rate counters have no value until they were sampled twice.
                continue
            if fmt & _PDH_FMT_DOUBLE:
                value = item.FmtValue.value.doubleValue
            else:
                value = float(item.FmtValue.value.largeValue)
            result[item.szName] = value
        return result

    def close(self) -> None:
        if self._query:
            self._pdh.PdhCloseQuery(self._query)
            self._query = ctypes.c_void_p()


_ENGINE_UTIL = r"\GPU Engine(*)\Utilization Percentage"
_DEDICATED_USAGE = r"\GPU Adapter Memory(*)\Dedicated Usage"
_SHARED_USAGE = r"\GPU Adapter Memory(*)\Shared Usage"


def _parse_luid(instance: str) -> tuple[int, int] | None:
    match = _LUID_RE.search(instance)
    if match is None:
        return None
    return int(match.group(1), 16), int(match.group(2), 16)


@dataclass(frozen=True)
class AdapterUsage:
    adapter: Adapter
    utilization: float
    """Busiest engine, in percent. Same definition as Task Manager's "GPU" column."""
    memory_used: int
    memory_total: int


class WindowsGpuMonitor:
    def __init__(self, adapters: list[Adapter]):
        self.adapters = adapters
        self._query = _PdhQuery([_ENGINE_UTIL, _DEDICATED_USAGE, _SHARED_USAGE])
        # Prime the rate counters, so the first real sample has a baseline.
        self._query.collect()

    def sample(self) -> list[AdapterUsage]:
        self._query.collect()

        # One instance per (process, engine). Sum over processes to get each
        # engine's load, then take the busiest engine of each adapter. ROCm work
        # lands on the Compute engines, games on 3D, but either counts.
        engine_load: dict[str, float] = defaultdict(float)
        for instance, value in self._query.values(
            _ENGINE_UTIL, _PDH_FMT_DOUBLE | _PDH_FMT_NOCAP100
        ).items():
            match = _ENGINE_RE.search(instance)
            if match is not None:
                engine_load[match.group(1)] += value

        utilization: dict[tuple[int, int], float] = defaultdict(float)
        for engine, load in engine_load.items():
            luid = _parse_luid(engine)
            if luid is not None:
                utilization[luid] = max(utilization[luid], load)

        def per_luid(path: str) -> dict[tuple[int, int], int]:
            totals: dict[tuple[int, int], int] = defaultdict(int)
            for instance, value in self._query.values(path, _PDH_FMT_LARGE).items():
                luid = _parse_luid(instance)
                if luid is not None:
                    totals[luid] += int(value)
            return totals

        dedicated = per_luid(_DEDICATED_USAGE)
        shared = per_luid(_SHARED_USAGE)

        usages: list[AdapterUsage] = []
        for adapter in self.adapters:
            used = dedicated.get(adapter.luid, 0)
            total = adapter.dedicated_total
            if adapter.is_uma:
                used += shared.get(adapter.luid, 0)
                total += adapter.shared_total
            usages.append(
                AdapterUsage(
                    adapter=adapter,
                    utilization=min(utilization.get(adapter.luid, 0.0), 100.0),
                    memory_used=used,
                    memory_total=total,
                )
            )
        return usages

    def close(self) -> None:
        self._query.close()


def create_monitor(vendor_ids: set[int]) -> WindowsGpuMonitor | None:
    """
    Returns a monitor for all hardware adapters of the given vendors, or None if
    there are none or the counters are unavailable (not Windows, or the WDDM
    driver is too old to publish GPU performance counters).
    """
    if sys.platform != "win32":
        return None
    try:
        adapters = [a for a in _enum_adapters() if a.vendor_id in vendor_ids]
        if not adapters:
            return None
        return WindowsGpuMonitor(adapters)
    except Exception as e:  # noqa: BLE001
        logger.info("GPU usage counters are unavailable: %s", e)
        return None


__all__ = [
    "VENDOR_AMD",
    "VENDOR_NVIDIA",
    "Adapter",
    "AdapterUsage",
    "WindowsGpuMonitor",
    "create_monitor",
]
