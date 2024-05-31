import {
    IntrinsicFunctionDefinition,
    NeverType,
    Scope,
    ScopeBuilder,
    SourceDocument,
    Type,
    globalScope,
    makeScoped,
    parseDefinitions,
} from '@chainner/navi';
import { lazy } from '../util';
import {
    formatTextPattern,
    getParentDirectory,
    goIntoDirectory,
    padCenter,
    padEnd,
    padStart,
    parseColorJson,
    regexFind,
    regexReplace,
    splitFilePath,
} from './chainner-builtin';

const code = `
struct null;

struct Error { message: string }
def error(message: invStrSet("")): Error {
    Error { message }
}

struct Seed;

struct Directory { path: string }
struct File {
    // what kind of file. E.g. image, video, pth
    kind: string,
    path: string,
}

struct Audio;

struct Image {
    width: int(1..),
    height: int(1..),
    channels: int(1..),
}
struct Color { channels: int(1..) }

struct Video;

// models

struct PyTorchScript;
struct PyTorchModel {
    scale: int(1..),
    inputChannels: int(1..),
    outputChannels: int(1..),
    arch: string,
    size: string,
    subType: string,
    tiling: ModelTiling,
}
enum ModelTiling { Supported, Discouraged, Internal }

struct NcnnNetwork {
    scale: int(1..),
    inputChannels: int(1..),
    outputChannels: int(1..),
    nf: int(1..),
    fp: string,
}

struct OnnxModel {
    arch: string,
    subType: string,
    scaleHeight: int(1..),
    scaleWidth: int(1..),
    inputChannels: int(1..),
    outputChannels: int(1..),
}
let OnnxRemBgModel = OnnxModel {
    subType: "RemBg",
};
let OnnxGenericModel = OnnxModel {
    subType: "Generic",
};

def pytorchToOnnx(model: PyTorchModel): OnnxModel {
    OnnxModel {
        scaleHeight: model.scale,
        scaleWidth: model.scale,
        inputChannels: model.inputChannels,
        outputChannels: model.outputChannels,
    }
}
def onnxToNcnn(model: OnnxModel): NcnnNetwork {
    NcnnNetwork {
        scale: model.scaleWidth & model.scaleHeight,
        inputChannels: model.inputChannels,
        outputChannels: model.outputChannels,
    }
}

// various inputs

struct ColorSpace { channels: 1 | 3 | 4, supportsAlpha: bool }
struct DdsFormat;
struct DdsMipMaps;
struct RotateInterpolationMode;
struct TileSize;
struct AudioStream;

enum FpMode { fp32, fp16 }

def FpMode::toString(mode: FpMode) {
    match mode {
        FpMode::fp32 => "fp32",
        FpMode::fp16 => "fp16",
    }
}

def convenientUpscale(model: PyTorchModel | NcnnNetwork, image: Image) {
    Image {
        width: model.scale * image.width,
        height: model.scale * image.height,
        channels: if model.inputChannels == model.outputChannels {
            image.channels
        } else {
            model.outputChannels
        }
    }
}
def convenientUpscaleOnnx(model: OnnxModel, image: Image) {
    Image {
        width: model.scaleWidth * image.width,
        height: model.scaleHeight * image.height,
        channels: if model.inputChannels == model.outputChannels {
            image.channels
        } else {
            model.outputChannels
        }
    }
}

struct SplitFilePath {
    dir: Directory,
    basename: string,
    ext: string,
}

intrinsic def formatPattern(pattern: string, ...args: string | null): string | Error;
intrinsic def regexReplace(text: string, regex: string, replacement: string, count: uint | inf): string | Error;
intrinsic def regexFind(text: string, regex: string, pattern: string): string | Error;
intrinsic def padStart(text: string, width: uint, padding: string): string;
intrinsic def padEnd(text: string, width: uint, padding: string): string;
intrinsic def padCenter(text: string, width: uint, padding: string): string;
intrinsic def splitFilePath(path: string): SplitFilePath;
intrinsic def parseColorJson(json: string): Color;
intrinsic def getParentDirectory(path: string, times: uint): string;
intrinsic def goIntoDirectory(basePath: string, path: string): string | Error;
`;

export const getChainnerScope = lazy((): Scope => {
    const builder = new ScopeBuilder('Chainner scope', globalScope);

    const intrinsic: Record<string, (scope: Scope, ...args: NeverType[]) => Type> = {
        formatPattern: formatTextPattern,
        regexReplace,
        regexFind,
        padStart: makeScoped(padStart),
        padEnd: makeScoped(padEnd),
        padCenter: makeScoped(padCenter),
        splitFilePath,
        parseColorJson,
        getParentDirectory: makeScoped(getParentDirectory),
        goIntoDirectory,
    };

    const definitions = parseDefinitions(new SourceDocument(code, 'chainner-internal'));
    for (const d of definitions) {
        if (d.underlying === 'declaration') {
            if (!(d.name in intrinsic)) {
                throw new Error(`Unable to find definition for intrinsic ${d.name}`);
            }
            const fn = intrinsic[d.name] as (scope: Scope, ...args: Type[]) => Type;
            builder.add(IntrinsicFunctionDefinition.from(d, fn));
        } else {
            builder.add(d);
        }
    }

    return builder.createScope();
});
