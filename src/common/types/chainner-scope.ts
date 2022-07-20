import { lazy } from '../util';
import { globalScope } from './global-scope';
import { parseDefinitions } from './parse';
import { ReadonlyScope, Scope } from './scope';
import { SourceDocument } from './source';

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
}

struct NcnnBinFile;
struct NcnnParamFile;
struct NcnnNetwork;

struct OnnxFile;
struct OnnxModel;

struct IteratorAuto;

// various inputs
struct AdaptiveMethod;
struct AdaptiveThresholdType;
struct BlendMode;
struct BorderType;
struct ColorMode { inputChannels: 1 | 3 | 4, outputChannels: 1 | 3 | 4 }
struct Colorspace;
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
struct VideoType;

struct Horizontal;
struct Vertical;
let Orientation = Horizontal | Vertical;

struct RotateCropSize;
struct RotateExpandSize;
let RotateSizeChange = RotateCropSize | RotateExpandSize;

struct AutoColorFill;
struct BlackColorFill;
struct TransparentColorFill;
let FillColor = AutoColorFill | BlackColorFill | TransparentColorFill;

// util function for upscaling nodes
let real = ..;
def getUpscaleChannels(
    imageChannels: int(1..),
    inputChannels: int(1..),
    outputChannels: int(1..),
) {
    match imageChannels {
        1 => 1,
        4 => match inputChannels { 3 => add(outputChannels, 1), _ => outputChannels },
        _ => outputChannels
    }
}
`;

export const getChainnerScope = lazy((): ReadonlyScope => {
    const scope = new Scope('Chainner scope', globalScope);

    const definitions = parseDefinitions(new SourceDocument(code, 'chainner-internal'));
    for (const d of definitions) {
        scope.add(d);
    }

    return scope;
});
