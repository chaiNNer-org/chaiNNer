from __future__ import annotations

import functools
import hashlib
import os
import tempfile
import time
from collections.abc import Iterable
from enum import Enum
from typing import NewType

import numpy as np

from api import RunFn
from logger import logger

CACHE_MAX_BYTES = int(os.environ.get("CACHE_MAX_BYTES", 1024**3))  # default 1 GiB
CACHE_REGISTRY: list[NodeOutputCache] = []


class CachedNumpyArray:
    def __init__(self, arr: np.ndarray):
        self.file = tempfile.TemporaryFile()
        self.file.write(arr.tobytes())

        self.shape = arr.shape
        self.dtype = arr.dtype

    def value(self) -> np.ndarray:
        self.file.seek(0)
        return np.frombuffer(self.file.read(), dtype=self.dtype).reshape(self.shape)


CacheKey = NewType("CacheKey", tuple)


class NodeOutputCache:
    def __init__(self):
        self._data: dict[CacheKey, list] = {}
        self._bytes: dict[CacheKey, int] = {}
        self._access_time: dict[CacheKey, float] = {}

        CACHE_REGISTRY.append(self)

    @staticmethod
    def _args_to_key(args: Iterable[object]) -> CacheKey:
        key = []
        for arg in args:
            if isinstance(arg, int | float | bool | str | bytes):
                key.append(arg)
            elif arg is None:
                key.append(None)
            elif isinstance(arg, Enum):
                key.append(arg.value)
            elif isinstance(arg, np.ndarray):
                key.append(tuple(arg.shape))
                key.append(arg.dtype.str)
                key.append(hashlib.sha256(arg.tobytes()).digest())
            elif hasattr(arg, "cache_key_func"):
                key.append(arg.__class__.__name__)
                key.append(arg.cache_key_func())  # type: ignore
            else:
                raise RuntimeError(f"Unexpected argument type {arg.__class__.__name__}")
        return CacheKey(tuple(key))

    @staticmethod
    def _estimate_bytes(output: list[object]) -> int:
        size = 0
        for out in output:
            if isinstance(out, np.ndarray):
                size += out.nbytes
            else:
                # any other type but numpy arrays is probably negligible, but here's an overestimate to handle
                # pathological cases where someone has a pipeline with a million math nodes
                size += 1024  # 1 KiB
        return size

    def empty(self) -> bool:
        return len(self._data) == 0

    def oldest(self) -> tuple[CacheKey, float]:
        return min(self._access_time.items(), key=lambda x: x[1])

    def size(self):
        return sum(self._bytes.values())

    @staticmethod
    def _enforce_limits():
        while True:
            total_bytes = sum([cache.size() for cache in CACHE_REGISTRY])
            logger.debug(
                "Cache size: %d (%.1f%% of limit)",
                total_bytes,
                100 * total_bytes / CACHE_MAX_BYTES,
            )
            if total_bytes <= CACHE_MAX_BYTES:
                return
            logger.debug("Dropping oldest cache key")

            oldest_keys = [
                (cache, cache.oldest()) for cache in CACHE_REGISTRY if not cache.empty()
            ]

            cache, (key, _) = min(oldest_keys, key=lambda x: x[1][1])
            cache.drop(key)

    @staticmethod
    def _write_arrays_to_disk(output: list) -> list:
        return [
            CachedNumpyArray(item) if isinstance(item, np.ndarray) else item
            for item in output
        ]

    @staticmethod
    def _read_arrays_from_disk(output: list) -> list:
        return [
            item.value() if isinstance(item, CachedNumpyArray) else item
            for item in output
        ]

    @staticmethod
    def _output_to_list(output: object) -> list[object]:
        if isinstance(output, list):
            return output
        elif isinstance(output, tuple):
            return list(output)
        else:
            return [output]

    @staticmethod
    def _list_to_output(output: list[object]):
        if len(output) == 1:
            return output[0]
        return output

    def get(self, args: Iterable[object]) -> object | None:
        key = self._args_to_key(args)
        if key in self._data:
            logger.debug("Cache hit")
            self._access_time[key] = time.time()
            return self._list_to_output(self._read_arrays_from_disk(self._data[key]))
        logger.debug("Cache miss")
        return None

    def put(self, args: Iterable[object], output: object):
        key = self._args_to_key(args)
        self._data[key] = self._write_arrays_to_disk(self._output_to_list(output))
        self._bytes[key] = self._estimate_bytes(self._output_to_list(output))
        self._access_time[key] = time.time()
        self._enforce_limits()

    def drop(self, key: CacheKey):
        del self._data[key]
        del self._bytes[key]
        del self._access_time[key]


def cached(run: RunFn):
    cache = NodeOutputCache()

    @functools.wraps(run)
    def _run(*args: object):
        out = cache.get(args)
        if out is not None:
            return out
        output = run(*args)
        cache.put(args, output)
        return output

    return _run
