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
    padCenter,
    padEnd,
    padStart,
    parseColorJson,
    regexReplace,
    splitFilePath,
} from './chainner-builtin';

const code = `
struct null;

struct Seed;

struct Directory { path: string }

struct AudioFile;
struct Audio;

struct ImageFile { path: string }
struct Image {
    width: int(1..),
    height: int(1..),
    channels: int(1..),
}
struct Color { channels: int(1..) }

struct VideoFile { path: string }
struct Video;

struct PthFile { path: string }
struct PtFile { path: string }
struct PyTorchScript;
struct PyTorchModel {
    scale: int(1..),
    inputChannels: int(1..),
    outputChannels: int(1..),
    arch: string,
    size: string,
    subType: string,
}
let PyTorchFaceModel = PyTorchModel {
    arch: "GFPGAN" | "RestoreFormer" | "CodeFormer",
    subType: "Face SR"
};
let PyTorchSRModel = PyTorchModel {
    arch: invStrSet(PyTorchFaceModel.arch | PyTorchInpaintModel.arch),
    subType: "SR"
};
let PyTorchInpaintModel = PyTorchModel {
    arch: "LaMa" | "MAT",
    subType: "Inpaint"
};

struct NcnnBinFile { path: string }
struct NcnnParamFile { path: string }
struct NcnnNetwork {
    scale: int(1..),
    inputChannels: int(1..),
    outputChannels: int(1..),
    nf: int(1..),
    fp: string,
}

struct OnnxFile { path: string }
struct OnnxModel {
    arch: string,
    subType: string,
    scaleHeight: int(1..),
    scaleWidth: int(1..),
}
let OnnxRemBgModel = OnnxModel {
    subType: "RemBg",
};
let OnnxGenericModel = OnnxModel {
    subType: "Generic",
};

struct IteratorAuto;

// various inputs
struct AdaptiveMethod;
struct AdaptiveThresholdType;
struct ColorSpace { channels: 1 | 3 | 4, supportsAlpha: bool }
struct DdsFormat;
struct DdsMipMaps;
struct ImageExtension;
struct NormalChannelInvert;
struct RotateInterpolationMode;
struct ThresholdType;
struct TileSize;
struct VideoPreset;
struct VideoType;

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

def removeBackground(model: OnnxRemBgModel, image: Image) {
    Image {
        width: image.width,
        height: image.height * model.scaleHeight,
        channels: 4,
    }
}

struct SplitFilePath {
    dir: Directory,
    basename: string,
    ext: string,
}

intrinsic def formatPattern(pattern: string, ...args: string | null): string;
intrinsic def regexReplace(text: string, regex: string, replacement: string, count: uint | inf): string;
intrinsic def padStart(text: string, width: uint, padding: string): string;
intrinsic def padEnd(text: string, width: uint, padding: string): string;
intrinsic def padCenter(text: string, width: uint, padding: string): string;
intrinsic def splitFilePath(path: string): SplitFilePath;
intrinsic def parseColorJson(json: string): Color;
`;

export const getChainnerScope = lazy((): Scope => {
    const builder = new ScopeBuilder('Chainner scope', globalScope);

    const intrinsic: Record<string, (scope: Scope, ...args: NeverType[]) => Type> = {
        formatPattern: makeScoped(formatTextPattern),
        regexReplace: makeScoped(regexReplace),
        padStart: makeScoped(padStart),
        padEnd: makeScoped(padEnd),
        padCenter: makeScoped(padCenter),
        splitFilePath,
        parseColorJson,
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
