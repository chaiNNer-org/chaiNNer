import { lazy } from '../util';
import { globalScope } from './global-scope';
import { parseDefinitions } from './parse';
import { Scope, ScopeBuilder } from './scope';
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
    modelType: string,
    size: string,
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
struct CaptionPosition;
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

enum Orientation { Horizontal, Vertical }
enum SideSelection { Width, Height, Shorter, Longer}
enum RotateSizeChange { Crop, Expand }
enum FillColor { Auto, Black, Transparent }
enum FpMode { fp32, fp16 }
`;

export const getChainnerScope = lazy((): Scope => {
    const builder = new ScopeBuilder('Chainner scope', globalScope);

    const definitions = parseDefinitions(new SourceDocument(code, 'chainner-internal'));
    for (const d of definitions) {
        builder.add(d);
    }

    return builder.createScope();
});
