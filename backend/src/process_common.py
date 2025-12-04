from dataclasses import dataclass
from typing import NewType

from api.iter import Collector, Generator, Transformer
from api.node_data import IteratorOutputInfo

Output = list[object]


@dataclass(frozen=True)
class RegularOutput:
    output: Output


@dataclass(frozen=True)
class GeneratorOutput:
    info: IteratorOutputInfo
    generator: Generator
    partial_output: Output


@dataclass(frozen=True)
class CollectorOutput:
    collector: Collector


@dataclass(frozen=True)
class TransformerOutput:
    info: IteratorOutputInfo
    transformer: Transformer
    partial_output: Output


NodeOutput = RegularOutput | GeneratorOutput | CollectorOutput | TransformerOutput

ExecutionId = NewType("ExecutionId", str)
