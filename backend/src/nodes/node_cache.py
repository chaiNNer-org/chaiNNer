import functools
import hashlib
import os
from enum import Enum
from typing import List, Dict, Tuple, Optional

import numpy as np
from sanic.log import logger

CACHE_MAX_BYTES = int(os.environ.get("CACHE_MAX_BYTES", 1024**3))  # default 1 GiB
CACHE_REGISTRY: List["OutputCache"] = []


class AccessCounter:
    count = 0

    @classmethod
    def next(cls):
        cls.count += 1
        return cls.count


class OutputCache:
    def __init__(self):
        self._data: Dict[Tuple, Tuple] = {}
        self.bytes: Dict[Tuple, int] = {}
        self.last_accessed: Dict[Tuple, int] = {}

        CACHE_REGISTRY.append(self)

    @staticmethod
    def _args_to_key(args) -> Tuple:
        key = []
        for arg in args:
            if isinstance(arg, (int, float, str, bytes)):
                key.append(arg)
            elif arg is None:
                key.append(None)
            elif isinstance(arg, Enum):
                key.append(arg.value)
            elif isinstance(arg, np.ndarray):
                key.append(tuple(arg.shape))
                key.append(hashlib.sha256(arg.tobytes()).digest())
            else:
                raise RuntimeError(f"Unexpected argument type {arg.__class__.__name__}")
        return tuple(key)

    @staticmethod
    def _estimate_bytes(output) -> int:
        size = 0
        for out in output:
            if isinstance(out, np.ndarray):
                size += out.nbytes
        return size

    def oldest(self) -> Optional[Tuple[Tuple, int]]:
        if not self.last_accessed:
            return None
        return min(self.last_accessed.items(), key=lambda x: x[1])

    @staticmethod
    def _enforce_limits():
        while True:
            total_bytes = sum(
                [size for cache in CACHE_REGISTRY for size in cache.bytes.values()]
            )
            if total_bytes <= CACHE_MAX_BYTES:
                return
            logger.info("Dropping oldest cache key")

            oldest_keys = []
            for cache in CACHE_REGISTRY:
                x = cache.oldest()
                if x is None:
                    continue
                oldest_keys.append((cache, x))

            cache, (key, _) = min(oldest_keys, key=lambda x: x[1][1])
            cache.drop(key)

    def get(self, args) -> Optional[Tuple]:
        key = self._args_to_key(args)
        if key in self._data:
            logger.info("Cache hit")
            self.last_accessed[key] = AccessCounter.next()
            return self._data[key]
        logger.info("Cache miss")
        return None

    def put(self, args, output):
        key = self._args_to_key(args)
        self._data[key] = output
        self.bytes[key] = self._estimate_bytes(output)
        self.last_accessed[key] = AccessCounter.next()
        self._enforce_limits()

    def drop(self, key):
        del self._data[key]
        del self.bytes[key]
        del self.last_accessed[key]


def cached(run):
    cache = OutputCache()

    @functools.wraps(run)
    def _run(obj, *args):
        out = cache.get(args)
        if out is not None:
            return out
        output = run(obj, *args)
        cache.put(args, output)
        return output

    return _run
