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
import { formatTextPattern, padCenter, padEnd, padStart } from './chainner-builtin';

const code = `
struct null;

struct Directory { path: string }

struct AudioFile;
struct Audio;

struct ImageFile;
struct Image {
    width: uint,
    height: uint,
    channels: int(1..),
}

struct VideoFile;
struct Video;

struct PthFile;
struct PtFile;
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

struct NcnnBinFile;
struct NcnnParamFile;
struct NcnnNetwork {
    scale: int(1..),
    inputChannels: int(1..),
    outputChannels: int(1..),
    nf: int(1..),
    fp: string,
}

struct OnnxFile;
struct OnnxModel {
    scale: int(1..),
}

struct IteratorAuto;

// various inputs
struct AdaptiveMethod;
struct AdaptiveThresholdType;
struct BlendMode;
struct CaptionPosition;
struct ColorSpace { channels: 1 | 3 | 4 }
struct DdsBC7Compression;
struct DdsDithering;
struct DdsErrorMetric;
struct DdsFormat;
struct DdsMipMaps;
struct EdgeFilter;
struct FillMethod;
struct FlipAxis;
struct GammaOption;
struct HeightMapSource;
struct ImageExtension;
struct InterpolationMode;
struct KernelType;
struct MathOperation { operation: string }
struct NoiseType;
struct NormalChannelInvert;
struct OverflowMethod;
struct ReciprocalScalingFactor;
struct RotateInterpolationMode;
struct ThresholdType;
struct TileMode;
struct TransferColorspace;
struct VideoPreset;
struct VideoType;

enum BorderType { ReflectMirror, Wrap, Replicate, Black, Transparent }
enum FillColor { Auto, Black, Transparent }
enum FpMode { fp32, fp16 }
enum NormalMappingAlpha { None, Unchanged, Height, One }
enum Orientation { Horizontal, Vertical }
enum PaddingAlignment { Start, End, Center }
enum ResizeCondition { Both, Upscale, Downscale }
enum RotateSizeChange { Crop, Expand }
enum SideSelection { Width, Height, Shorter, Longer }
enum NoiseColor { Rgb, Gray }

def FillColor::getOutputChannels(fill: FillColor, channels: uint) {
    match fill {
        FillColor::Transparent => 4,
        _ => channels
    }
}
def BorderType::getOutputChannels(type: BorderType, channels: uint) {
    match type {
        BorderType::Transparent => 4,
        _ => channels
    }
}
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
        channels: image.channels
    }
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

    return builder.createScope();
});
