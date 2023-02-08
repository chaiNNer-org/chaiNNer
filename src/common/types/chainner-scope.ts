import {
    BuiltinFunctionDefinition,
    Scope,
    ScopeBuilder,
    SourceDocument,
    StringType,
    StructType,
    Type,
    globalScope,
    intInterval,
    parseDefinitions,
    union,
} from '@chainner/navi';
import { lazy } from '../util';
import { formatTextPattern, padCenter, padEnd, padStart, splitFilePath } from './chainner-builtin';

const code = `
struct null;

struct Directory { path: string }

struct AudioFile;
struct Audio;

struct ImageFile { path: string }
struct Image {
    width: uint,
    height: uint,
    channels: int(1..),
}

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
    arch: invStrSet(PyTorchFaceModel.arch),
    subType: "SR"
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
    scale: int(1..),
    inputChannels: int(1..),
    outputChannels: int(1..),
    arch: string,
    subType: string,
}
let OnnxRemBgModel = OnnxModel {
    arch: "OnnxRemBgModel",
    subType: "RemBg",
};
let OnnxGenericModel = OnnxModel {
    arch: "OnnxGenericModel",
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

def convenientUpscale(model: PyTorchModel | NcnnNetwork | OnnxModel, image: Image) {
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

struct SplitFilePath {
    dir: Directory,
    basename: string,
    ext: string,
}
`;

export const getChainnerScope = lazy((): Scope => {
    const builder = new ScopeBuilder('Chainner scope', globalScope);

    const definitions = parseDefinitions(new SourceDocument(code, 'chainner-internal'));
    for (const d of definitions) {
        builder.add(d);
    }

    builder.add(
        new BuiltinFunctionDefinition(
            'formatPattern',
            formatTextPattern as (..._: Type[]) => Type,
            [StringType.instance],
            union(StringType.instance, new StructType('null'))
        )
    );

    builder.add(
        new BuiltinFunctionDefinition('padStart', padStart as (..._: Type[]) => Type, [
            StringType.instance,
            intInterval(0, Infinity),
            StringType.instance,
        ])
    );
    builder.add(
        new BuiltinFunctionDefinition('padEnd', padEnd as (..._: Type[]) => Type, [
            StringType.instance,
            intInterval(0, Infinity),
            StringType.instance,
        ])
    );
    builder.add(
        new BuiltinFunctionDefinition('padCenter', padCenter as (..._: Type[]) => Type, [
            StringType.instance,
            intInterval(0, Infinity),
            StringType.instance,
        ])
    );
    builder.add(
        BuiltinFunctionDefinition.unary('splitFilePath', splitFilePath, StringType.instance)
    );

    return builder.createScope();
});
