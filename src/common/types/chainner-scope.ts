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
let PyTorchModel::FaceArchs = "GFPGAN" | "RestoreFormer";

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
struct OnnxModel;

struct IteratorAuto;

// various inputs
struct AdaptiveMethod;
struct AdaptiveThresholdType;
struct BlendMode;
struct CaptionPosition;
struct ColorSpace { channels: 1 | 3 | 4 }
struct EdgeFilter;
struct FillMethod;
struct FlipAxis;
struct GammaOption;
struct ImageExtension;
struct InterpolationMode;
struct MathOperation { operation: string }
struct OverflowMethod;
struct ReciprocalScalingFactor;
struct RotateInterpolationMode;
struct ThresholdType;
struct TileMode;
struct TransferColorspace;
struct VideoType;
struct VideoPreset;

enum BorderType { ReflectMirror, Wrap, Replicate, Black, Transparent }
enum FillColor { Auto, Black, Transparent }
enum FpMode { fp32, fp16 }
enum Orientation { Horizontal, Vertical }
enum PaddingAlignment { Start, End, Center }
enum ResizeCondition { Both, Upscale, Downscale }
enum RotateSizeChange { Crop, Expand }
enum SideSelection { Width, Height, Shorter, Longer }

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
