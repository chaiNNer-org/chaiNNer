import { ExpressionJson } from './types/json';

export interface JsonObject {
    [key: string]: JsonValue;
}
export type JsonValue = null | string | number | boolean | JsonObject | JsonValue[];

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface Size {
    width: number;
    height: number;
}

export type SchemaId = string & { readonly __schemaId: never };
export type InputId = number & { readonly __inputId: never };
export type OutputId = number & { readonly __outputId: never };
export type GroupId = number & { readonly __groupId: never };
export type PackageId = string & { readonly __packageId: never };
export type FeatureId = string & { readonly __featureId: never };
export type PyPiName = string & { readonly __pyPiName: never };

export type InputValue = InputSchemaValue | undefined;
export type InputSchemaValue = string | number;
export interface InputConversionSchema {
    readonly type: ExpressionJson;
    readonly convert: ExpressionJson;
}

export interface IOFusion {
    readonly outputId: OutputId;
}

interface InputBase {
    readonly id: InputId;
    readonly type: ExpressionJson;
    /**
     * A list of input conversions. Before checking for compatibility, the type
     * system will attempt to convert any assigned type using input conversions.
     *
     * This can be used to implement e.g. number rounding or type wrapping for
     * edges.
     */
    readonly conversions: InputConversionSchema[];
    /**
     * Optional type conversion for adapting input data.
     *
     * The frontend stores input data as numbers and strings, but inputs may
     * use different types. This optional conversion allows inputs to convert
     * input data to compatible types. E.g. the directory input wraps its path.
     */
    readonly adapt?: ExpressionJson | null;
    readonly typeDefinitions?: string | null;
    readonly kind: InputKind;
    readonly label: string;
    readonly optional: boolean;
    readonly hasHandle: boolean;
    readonly description?: string;
    readonly hint: boolean;
    readonly fused?: IOFusion | null;
}
export interface InputOption {
    readonly option: string;
    readonly value: InputSchemaValue;
    readonly icon?: string | null;
    readonly type?: ExpressionJson;
    readonly condition?: Condition | null;
}
export type FileInputKind = 'image' | 'pth' | 'pt' | 'video' | 'bin' | 'param' | 'onnx';
export type DropDownStyle = 'dropdown' | 'checkbox' | 'tabs' | 'icons';
export interface DropdownGroup {
    readonly label?: string | null;
    readonly startAt: InputSchemaValue;
}
export type LabelStyle = 'default' | 'inline' | 'hidden';

export interface GenericInput extends InputBase {
    readonly kind: 'generic';
}
export interface DropDownInput extends InputBase {
    readonly kind: 'dropdown';
    readonly def: string | number;
    readonly options: readonly InputOption[];
    readonly preferredStyle: DropDownStyle;
    readonly labelStyle: LabelStyle;
    readonly groups: readonly DropdownGroup[];
}
export interface FileInput extends InputBase {
    readonly kind: 'file';
    readonly fileKind: FileInputKind;
    readonly filetypes: readonly string[];
    readonly primaryInput: boolean;
}
export interface DirectoryInput extends InputBase {
    readonly kind: 'directory';
    readonly labelStyle: LabelStyle;
}
export interface TextInput extends InputBase {
    readonly kind: 'text';
    readonly multiline?: boolean;
    readonly minLength?: number | null;
    readonly maxLength?: number | null;
    readonly placeholder?: string | null;
    readonly def?: string | null;
    readonly allowEmptyString?: boolean;
    readonly labelStyle: LabelStyle | undefined;
}
export interface NumberInput extends InputBase {
    readonly kind: 'number';
    readonly def: number;
    readonly min?: number | null;
    readonly max?: number | null;
    readonly precision: number;
    readonly controlsStep: number;
    readonly unit?: string | null;
    readonly noteExpression?: string | null;
    readonly hideTrailingZeros: boolean;
    readonly labelStyle: LabelStyle;
}
export interface SliderInput extends InputBase {
    readonly kind: 'slider';
    readonly def: number;
    readonly min: number;
    readonly max: number;
    readonly precision: number;
    readonly controlsStep: number;
    readonly unit?: string | null;
    readonly noteExpression?: string | null;
    readonly hideTrailingZeros: boolean;
    readonly ends: readonly [string | null, string | null];
    readonly sliderStep: number;
    readonly gradient?: readonly string[] | null;
    readonly scale: 'linear' | 'log' | 'log-offset' | 'sqrt';
}
export interface ColorInput extends InputBase {
    readonly kind: 'color';
    readonly def: string;
    readonly channels?: readonly number[] | null;
}

export interface StaticValueInput extends InputBase {
    readonly kind: 'static';
    readonly value: 'execution_number';
}

export type InputKind = Input['kind'];
export type Input =
    | GenericInput
    | FileInput
    | DirectoryInput
    | TextInput
    | DropDownInput
    | SliderInput
    | NumberInput
    | ColorInput
    | StaticValueInput;

export type OutputKind = 'image' | 'large-image' | 'tagged' | 'generic';

export interface Output {
    readonly id: OutputId;
    readonly type: ExpressionJson;
    /**
     * A likely reason as to why the (generic) type expression might evaluate to `never`.
     */
    readonly neverReason?: string | null;
    readonly label: string;
    readonly kind: OutputKind;
    readonly hasHandle: boolean;
    readonly description?: string | null;
}

export type Condition = AndCondition | OrCondition | NotCondition | EnumCondition | TypeCondition;
export interface AndCondition {
    readonly kind: 'and';
    readonly items: readonly Condition[];
}
export interface OrCondition {
    readonly kind: 'or';
    readonly items: readonly Condition[];
}
export interface NotCondition {
    readonly kind: 'not';
    readonly condition: Condition;
}
export interface EnumCondition {
    readonly kind: 'enum';
    readonly enum: InputId;
    readonly values: readonly InputSchemaValue[];
}
export interface TypeCondition {
    readonly kind: 'type';
    readonly input: InputId;
    readonly condition: ExpressionJson;
    readonly ifNotConnected: boolean;
}

interface GroupBase {
    readonly id: GroupId;
    readonly kind: GroupKind;
    readonly options: Readonly<Record<string, unknown>>;
    readonly items: readonly (InputId | Group)[];
}
interface NcnnFileInputGroup extends GroupBase {
    readonly kind: 'ncnn-file-inputs';
    readonly options: Readonly<Record<string, never>>;
}
interface FromToDropdownsGroup extends GroupBase {
    readonly kind: 'from-to-dropdowns';
    readonly options: Readonly<Record<string, never>>;
}
interface OptionalListGroup extends GroupBase {
    readonly kind: 'optional-list';
    readonly options: Readonly<Record<string, never>>;
}
interface OptionalListGroup extends GroupBase {
    readonly kind: 'optional-list';
    readonly options: Readonly<Record<string, never>>;
}
interface ConditionalGroup extends GroupBase {
    readonly kind: 'conditional';
    readonly options: {
        readonly condition: Condition;
    };
}
interface RequiredGroup extends GroupBase {
    readonly kind: 'required';
    readonly options: {
        readonly condition: Condition;
    };
}
interface SeedGroup extends GroupBase {
    readonly kind: 'seed';
    readonly options: Readonly<Record<string, never>>;
}
interface LinkedInputsGroup extends GroupBase {
    readonly kind: 'linked-inputs';
    readonly options: Readonly<Record<string, never>>;
}
interface IconSetGroup extends GroupBase {
    readonly kind: 'icon-set';
    readonly options: {
        readonly label: string;
    };
}
export type GroupKind = Group['kind'];
export type Group =
    | NcnnFileInputGroup
    | FromToDropdownsGroup
    | OptionalListGroup
    | ConditionalGroup
    | RequiredGroup
    | SeedGroup
    | LinkedInputsGroup
    | IconSetGroup;

export type OfKind<T extends { readonly kind: string }, Kind extends T['kind']> = T extends {
    readonly kind: Kind;
}
    ? T
    : never;

export type NodeKind = 'regularNode' | 'newIterator' | 'collector';

export type InputData = Readonly<Record<InputId, InputValue>>;
export type InputHeight = Readonly<Record<InputId, number>>;
export type OutputData = Readonly<Record<OutputId, unknown>>;
export type OutputHeight = Readonly<Record<OutputId, number>>;
export type OutputTypes = Readonly<Partial<Record<OutputId, ExpressionJson | null>>>;
export type GroupState = Readonly<Record<GroupId, unknown>>;

export interface IteratorInputInfo {
    readonly inputs: readonly InputId[];
    readonly lengthType: ExpressionJson;
}
export interface IteratorOutputInfo {
    readonly outputs: readonly OutputId[];
    readonly lengthType: ExpressionJson;
}

export interface NodeSchema {
    readonly name: string;
    readonly category: CategoryId;
    readonly nodeGroup: NodeGroupId;
    readonly description: string;
    readonly seeAlso: readonly SchemaId[];
    readonly icon: string;
    readonly kind: NodeKind;
    readonly inputs: readonly Input[];
    readonly outputs: readonly Output[];
    readonly groupLayout: readonly (InputId | Group)[];
    readonly iteratorInputs: readonly IteratorInputInfo[];
    readonly iteratorOutputs: readonly IteratorOutputInfo[];
    readonly schemaId: SchemaId;
    readonly hasSideEffects: boolean;
    readonly deprecated: boolean;
    readonly features: readonly FeatureId[];
}

export interface DefaultNode {
    // Default nodes aren't currently used
    __SPECIAL: never;
    schemaId: SchemaId;
}

export interface NodeData {
    readonly id: string;
    readonly schemaId: SchemaId;
    readonly isDisabled?: boolean;
    readonly isLocked?: boolean;
    readonly inputData: InputData;
    readonly groupState?: GroupState;
    readonly inputHeight?: InputHeight;
    readonly outputHeight?: OutputHeight;
    readonly nodeWidth?: number;
    readonly invalid?: boolean;
    readonly minWidth?: number;
    readonly minHeight?: number;
    readonly isCollapsed?: boolean;
}
export interface EdgeData {
    sourceX?: number;
    sourceY?: number;
    targetX?: number;
    targetY?: number;
}

export interface PyPiPackage {
    readonly displayName: string;
    readonly pypiName: PyPiName;
    readonly version: Version;
    readonly findLink?: string | null;
    /**
     * A size estimate (in bytes) for the whl file to download.
     */
    readonly sizeEstimate: number;
    readonly autoUpdate: boolean;
}

export interface Feature {
    readonly id: FeatureId;
    readonly name: string;
    readonly description: string;
}

export type SettingKey = string & { readonly __settingKey: never };
export type SettingValue = string | number | boolean;

interface SettingBase {
    readonly type: Setting['type'];
    readonly key: SettingKey;
    readonly label: string;
    readonly description: string;
    readonly default: SettingValue;
    readonly disabled?: boolean;
}

export interface ToggleSetting extends SettingBase {
    readonly type: 'toggle';
    readonly default: boolean;
}

export interface NumberSetting extends SettingBase {
    readonly type: 'number';
    readonly min: number;
    readonly max: number;
    readonly default: number;
}

export interface DropdownSetting extends SettingBase {
    readonly type: 'dropdown';
    readonly options: readonly { readonly label: string; readonly value: string }[];
    readonly default: string;
    readonly small?: boolean;
}

export interface CacheSetting extends SettingBase {
    readonly type: 'cache';
    readonly default: string;
    readonly directory: string;
}

export type Setting = ToggleSetting | NumberSetting | DropdownSetting | CacheSetting;

export interface Package {
    readonly id: PackageId;
    readonly name: string;
    readonly icon: string;
    readonly color: string;
    readonly description: string;
    readonly dependencies: readonly PyPiPackage[];
    readonly features: readonly Feature[];
    readonly settings: readonly Setting[];
}

export interface FeatureState {
    readonly packageId: PackageId;
    readonly featureId: FeatureId;
    readonly enabled: boolean;
    readonly details?: string | null;
}

/**
 * A valid semantic version or a string that can be coerced into one.
 */
export type Version =
    | `${number}.${number}.${number}`
    | `${number}.${number}.${number}${'+' | '-'}${string}`
    | (string & { readonly __coerceableVersionString: undefined });

export interface PythonInfo {
    readonly python: string;
    readonly version: Version;
}

export type FfmpegInfo =
    | {
          readonly ffmpeg: string;
          readonly ffprobe: string;
      }
    | {
          readonly ffmpeg: undefined;
          readonly ffprobe: undefined;
      };

export type FileSaveResult = FileSaveSuccess | FileSaveCanceled;
export type FileSaveCanceled = { kind: 'Canceled' };
export type FileSaveSuccess = { kind: 'Success'; path: string };

export type FileOpenResult<T> = FileOpenSuccess<T> | FileOpenError;
export interface FileOpenSuccess<T> {
    kind: 'Success';
    path: string;
    saveData: T;
}
export interface FileOpenError {
    kind: 'Error';
    path: string;
    error: string;
}

export interface BackendJsonEdgeInput {
    type: 'edge';
    id: string;
    index: number;
}
export interface BackendJsonValueInput {
    type: 'value';
    value: InputValue | null;
}
export type BackendJsonInput = BackendJsonEdgeInput | BackendJsonValueInput;
export interface BackendJsonNode {
    id: string;
    schemaId: SchemaId;
    inputs: BackendJsonInput[];
    nodeType: string;
}

export interface WindowSize {
    readonly maximized: boolean;
    readonly width: number;
    readonly height: number;
}

export type CategoryId = string & { readonly __categoryId: never };
export interface Category {
    readonly id: CategoryId;
    readonly name: string;
    readonly description: string;
    readonly icon: string;
    readonly color: string;
    readonly installHint?: string;
    readonly groups: readonly NodeGroup[];
}
export type NodeGroupId = string & { readonly __nodeGroupId: never };
export interface NodeGroup {
    readonly id: NodeGroupId;
    readonly category: CategoryId;
    readonly name: string;
    readonly order: readonly SchemaId[];
}

export type ColorJson = GrayscaleColorJson | RgbColorJson | RgbaColorJson;
export type ColorKind = ColorJson['kind'];
export interface GrayscaleColorJson {
    readonly kind: 'grayscale';
    readonly values: readonly [luma: number];
}
export interface RgbColorJson {
    readonly kind: 'rgb';
    readonly values: readonly [r: number, g: number, b: number];
}
export interface RgbaColorJson {
    readonly kind: 'rgba';
    readonly values: readonly [r: number, g: number, b: number, a: number];
}

export interface PackageSettings {
    [packageName: string]: Record<string, SettingValue>;
}
