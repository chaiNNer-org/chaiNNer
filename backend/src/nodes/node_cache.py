import functools
import hashlib
import os
import tempfile
import time
from enum import Enum
from typing import Dict, List, Optional, Tuple

import numpy as np
from sanic.log import logger

CACHE_MAX_BYTES = int(os.environ.get("CACHE_MAX_BYTES", 1024**3))  # default 1 GiB
CACHE_REGISTRY: List["NodeOutputCache"] = []


class CachedNumpyArray:
    def __init__(self, arr: np.ndarray):
        self.file = tempfile.TemporaryFile()
        self.file.write(arr.tobytes())

        self.shape = arr.shape
        self.dtype = arr.dtype

    def value(self) -> np.ndarray:
        self.file.seek(0)
        return np.frombuffer(self.file.read(), dtype=self.dtype).reshape(self.shape)


class NodeOutputCache:
    def __init__(self):
        self._data: Dict[Tuple, List] = {}
        self._bytes: Dict[Tuple, int] = {}
        self._access_time: Dict[Tuple, float] = {}

        CACHE_REGISTRY.append(self)

    @staticmethod
    def _args_to_key(args) -> Tuple:
        key = []
        for arg in args:
            if isinstance(arg, (int, float, bool, str, bytes)):
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
                key.append(arg.cache_key_func())
            else:
                raise RuntimeError(f"Unexpected argument type {arg.__class__.__name__}")
        return tuple(key)

    @staticmethod
    def _estimate_bytes(output) -> int:
        size = 0
        for out in output:
            if isinstance(out, np.ndarray):
                size += out.nbytes
            else:
                # any other type but numpy arrays is probably negligible, but here's an overestimate to handle
                # pathological cases where someone has a pipeline with a million math nodes
                size += 1024  # 1 KiB
        return size

    def empty(self):
        return len(self._data) == 0

    def oldest(self) -> Tuple[Tuple, float]:
        return min(self._access_time.items(), key=lambda x: x[1])

    def size(self):
        return sum(self._bytes.values())

    @staticmethod
    def _enforce_limits():
        while True:
            total_bytes = sum([cache.size() for cache in CACHE_REGISTRY])
            logger.debug(
                f"Cache size: {total_bytes} ({100*total_bytes/CACHE_MAX_BYTES:0.1f}% of limit)"
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
    def _write_arrays_to_disk(output: List) -> List:
        return [
            CachedNumpyArray(item) if isinstance(item, np.ndarray) else item
            for item in output
        ]

    @staticmethod
    def _read_arrays_from_disk(output: List) -> List:
        return [
            item.value() if isinstance(item, CachedNumpyArray) else item
            for item in output
        ]

    @staticmethod
    def _output_to_list(output) -> List:
        if isinstance(output, list):
            return output
        elif isinstance(output, tuple):
            return list(output)
        else:
            return [output]

    @staticmethod
    def _list_to_output(output: List):
        if len(output) == 1:
            return output[0]
        return output

    def get(self, args) -> Optional[List]:
        key = self._args_to_key(args)
        if key in self._data:
            logger.debug("Cache hit")
            self._access_time[key] = time.time()
            return self._list_to_output(self._read_arrays_from_disk(self._data[key]))
        logger.debug("Cache miss")
        return None

    def put(self, args, output):
        key = self._args_to_key(args)
        self._data[key] = self._write_arrays_to_disk(self._output_to_list(output))
        self._bytes[key] = self._estimate_bytes(output)
        self._access_time[key] = time.time()
        self._enforce_limits()

    def drop(self, key):
        del self._data[key]
        del self._bytes[key]
        del self._access_time[key]


def cached(run):
    cache = NodeOutputCache()

    @functools.wraps(run)
    def _run(*args):
        out = cache.get(args)
        if out is not None:
            return out
        output = run(*args)
        cache.put(args, output)
        return output

    return _run
