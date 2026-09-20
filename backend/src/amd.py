from __future__ import annotations

import os
import re
import subprocess
import sys
from dataclasses import dataclass
from functools import lru_cache

from logger import logger

# Marketing name -> gfx target.
#
# This table is also the support list: ROCm wheels for Windows are only offered
# for RDNA2, RDNA3, RDNA3.5 and RDNA4. Everything older (RDNA1, Vega, Polaris,
# GCN) has no Windows kernels published by AMD, so those cards fall through to
# the regular CPU build instead of failing at runtime.
#
# Order matters: the first match wins, so narrower patterns come first.
_GFX_TARGETS: list[tuple[str, str]] = [
    # --- RDNA4 -------------------------------------------------------------
    (r"\brx\s*9070\b", "gfx1201"),  # RX 9070 XT / 9070 / 9070 GRE
    (r"\bai\s+pro\s+r9[67]00", "gfx1201"),  # Radeon AI PRO R9700 / R9600D
    (r"\brx\s*90[56]0\b", "gfx1200"),  # RX 9060 XT / 9060 / 9050
    # --- RDNA3 -------------------------------------------------------------
    (r"\brx\s*79\d{2}", "gfx1100"),  # RX 7900 XTX / XT / GRE / 7900M
    (r"\bpro\s+w79\d{2}", "gfx1100"),  # PRO W7900 / W7800
    (r"\brx\s*7[78]\d{2}", "gfx1101"),  # RX 7800 XT / 7700 XT / 7700
    (r"\bpro\s+w7700", "gfx1101"),
    (r"\bpro\s+v710", "gfx1101"),
    (r"\brx\s*7[456]\d{2}", "gfx1102"),  # RX 7600 XT / 7600 / 7400
    (r"\bradeon\s+7[468]0m", "gfx1103"),  # Ryzen 7040/8040 iGPU
    # --- RDNA3.5 APUs ------------------------------------------------------
    (r"\bradeon\s+80[456]0s", "gfx1151"),  # Ryzen AI Max / Max+
    (r"\bradeon\s+8[89]0m", "gfx1150"),  # Ryzen AI 9 (880M / 890M)
    (r"\bradeon\s+8[46]0m", "gfx1152"),  # Ryzen AI 5/7 (840M / 860M)
    (r"\bradeon\s+820m", "gfx1152"),
    # --- RDNA2 -------------------------------------------------------------
    (r"\brx\s*6[89]\d{2}", "gfx1030"),  # RX 6800 / 6900 / 6950
    (r"\bpro\s+w6800", "gfx1030"),
    (r"\bpro\s+v620", "gfx1030"),
    (r"\brx\s*67\d{2}", "gfx1031"),  # RX 6700 series
    (r"\brx\s*66\d{2}", "gfx1032"),  # RX 6600 series
    (r"\brx\s*6[45]\d{2}", "gfx1034"),  # RX 6500 / 6400
    (r"\bradeon\s+6[89]0m", "gfx1035"),  # Rembrandt iGPU
]

_GFX_RES = [(re.compile(pattern, re.IGNORECASE), gfx) for pattern, gfx in _GFX_TARGETS]


def _gfx_for(name: str) -> str | None:
    for regex, gfx in _GFX_RES:
        if regex.search(name):
            return gfx
    return None


@dataclass(frozen=True)
class AmdDevice:
    name: str
    gfx: str | None

    @property
    def supported(self) -> bool:
        return self.gfx is not None


def _query_windows_gpus() -> list[str]:
    """
    Returns the names of all display adapters reported by Windows.
    """
    try:
        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        output = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-CimInstance Win32_VideoController"
                " | Select-Object -ExpandProperty Name",
            ],
            creationflags=creation_flags,
            stderr=subprocess.DEVNULL,
            timeout=20,
            text=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.info("Could not enumerate display adapters: %s", e)
        return []

    return [line.strip() for line in output.splitlines() if line.strip()]


class AmdInfo:
    def __init__(self, devices: list[AmdDevice]):
        self.__devices = devices

    @property
    def devices(self) -> list[AmdDevice]:
        return self.__devices

    @property
    def is_available(self) -> bool:
        """An AMD GPU is present, whatever its architecture."""
        return len(self.__devices) > 0

    @property
    def is_supported(self) -> bool:
        """At least one AMD GPU has ROCm-for-Windows kernels published for it."""
        return len(self.gfx_targets) > 0

    @property
    def gfx_targets(self) -> list[str]:
        """Every distinct supported gfx target present in this machine."""
        return sorted({d.gfx for d in self.__devices if d.gfx is not None})

    @property
    def torch_extras(self) -> str | None:
        """
        The pip extras to install torch with, e.g. "device-gfx1201".

        One extra per installed card, so a machine with a discrete Radeon and a
        Ryzen iGPU gets kernels for both and nothing else. Returns None when no
        supported card was found, in which case the ROCm build must not be
        offered at all.
        """
        targets = self.gfx_targets
        if not targets:
            return None
        return ",".join(f"device-{gfx}" for gfx in targets)


def _get_amd_info() -> AmdInfo:
    if sys.platform != "win32":
        # On Linux the regular PyTorch ROCm index is used instead, so none of
        # this is needed.
        return AmdInfo([])

    # Escape hatch for cards that are not in the table, or that need an
    # HSA_OVERRIDE_GFX_VERSION. Accepts one or more comma-separated targets.
    override = os.environ.get("CHAINNER_ROCM_GFX", "").strip()

    devices: list[AmdDevice] = []
    for name in _query_windows_gpus():
        lowered = name.lower()
        if "amd" not in lowered and "radeon" not in lowered:
            continue
        devices.append(AmdDevice(name=name, gfx=_gfx_for(name)))

    if override:
        # Keep the reported names, but force the targets.
        forced = [g.strip() for g in override.split(",") if g.strip()]
        if not devices:
            devices = [AmdDevice(name="AMD GPU (forced)", gfx=g) for g in forced]
        else:
            devices = [
                AmdDevice(name=devices[i].name if i < len(devices) else "AMD GPU", gfx=g)
                for i, g in enumerate(forced)
            ]

    if devices:
        logger.info(
            "Found AMD GPU(s): %s",
            ", ".join(f"{d.name} [{d.gfx or 'unsupported by ROCm on Windows'}]" for d in devices),
        )

    return AmdInfo(devices)


@lru_cache(maxsize=1)
def _cached_amd_info() -> AmdInfo:
    return _get_amd_info()


amd = _cached_amd_info()
