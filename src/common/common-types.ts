import { ExpressionJson } from './types/json';

export interface JsonObject {
    [key: string]: JsonValue;
}
export type JsonValue = null | string | number | boolean | JsonObject | JsonValue[];

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export interface Size {
    width: number;
    height: number;
}
export interface IteratorSize extends Size {
    offsetTop: number;
    offsetLeft: number;
}

export type SchemaId = string & { readonly __schemaId: never };
export type InputId = number & { readonly __inputId: never };
export type OutputId = number & { readonly __outputId: never };
export type GroupId = number & { readonly __groupId: never };

export type InputValue = InputSchemaValue | undefined;
export type InputSchemaValue = string | number;
export interface InputConversionSchema {
    readonly type: ExpressionJson;
    readonly convert: ExpressionJson;
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
}
export interface InputOption {
    option: string;
    value: InputSchemaValue;
    type?: ExpressionJson;
}
export type FileInputKind = 'image' | 'pth' | 'pt' | 'video' | 'bin' | 'param' | 'onnx';
export type DropDownStyle = 'dropdown' | 'checkbox';

export interface GenericInput extends InputBase {
    readonly kind: 'generic';
}
export interface DropDownInput extends InputBase {
    readonly kind: 'dropdown';
    readonly def: string | number;
    readonly options: readonly InputOption[];
    readonly preferredStyle: DropDownStyle;
}
export interface FileInput extends InputBase {
    readonly kind: 'file';
    readonly fileKind: FileInputKind;
    readonly filetypes: readonly string[];
    readonly primaryInput: boolean;
}
export interface DirectoryInput extends InputBase {
    readonly kind: 'directory';
}
export interface TextInput extends InputBase {
    readonly kind: 'text-line';
    readonly minLength?: number | null;
    readonly maxLength?: number | null;
    readonly placeholder?: string | null;
    readonly def?: string | null;
}
export interface TextAreaInput extends InputBase {
    readonly kind: 'text';
    readonly resizable: boolean;
    readonly def: string | null;
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
    readonly scale: 'linear' | 'log' | 'log-offset';
}
export type InputKind = Input['kind'];
export type Input =
    | GenericInput
    | FileInput
    | DirectoryInput
    | TextInput
    | TextAreaInput
    | DropDownInput
    | SliderInput
    | NumberInput;

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
    readonly values: readonly InputSchemaValue[] | InputSchemaValue;
}
export interface TypeCondition {
    readonly kind: 'type';
    readonly input: InputId;
    readonly condition: ExpressionJson;
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
export type GroupKind = Group['kind'];
export type Group =
    | NcnnFileInputGroup
    | FromToDropdownsGroup
    | OptionalListGroup
    | ConditionalGroup
    | RequiredGroup
    | SeedGroup;

export type OfKind<T extends { readonly kind: string }, Kind extends T['kind']> = T extends {
    readonly kind: Kind;
}
    ? T
    : never;

export type NodeType = 'regularNode' | 'iterator' | 'iteratorHelper';

export type InputData = Readonly<Record<InputId, InputValue>>;
export type InputSize = Readonly<Record<InputId, Readonly<Size>>>;
export type OutputData = Readonly<Record<OutputId, unknown>>;
export type OutputTypes = Readonly<Partial<Record<OutputId, ExpressionJson | null>>>;
export type GroupState = Readonly<Record<GroupId, unknown>>;

export interface NodeSchema {
    readonly name: string;
    readonly category: string;
    readonly subcategory: string;
    readonly description: string;
    readonly icon: string;
    readonly nodeType: NodeType;
    readonly inputs: readonly Input[];
    readonly outputs: readonly Output[];
    readonly groupLayout: readonly (InputId | Group)[];
    readonly defaultNodes?: readonly DefaultNode[];
    readonly schemaId: SchemaId;
    readonly hasSideEffects: boolean;
    readonly deprecated: boolean;
}

export interface DefaultNode {
    // Default nodes aren't currently used
    __SPECIAL: never;
    schemaId: SchemaId;
}

export interface NodeData {
    readonly id: string;
    readonly parentNode?: string;
    readonly schemaId: SchemaId;
    readonly isDisabled?: boolean;
    readonly isLocked?: boolean;
    readonly inputData: InputData;
    readonly groupState?: GroupState;
    readonly inputSize?: InputSize;
    readonly invalid?: boolean;
    readonly iteratorSize?: Readonly<IteratorSize>;
    readonly percentComplete?: number;
    readonly minWidth?: number;
    readonly minHeight?: number;
}
export interface EdgeData {
    sourceX?: number;
    sourceY?: number;
    targetX?: number;
    targetY?: number;
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
    parent: string | null;
}

export interface WindowSize {
    readonly maximized: boolean;
    readonly width: number;
    readonly height: number;
}

export interface Category {
    name: string;
    description: string;
    icon: string;
    color: string;
    installHint?: string;
    excludedFromCheck: string[];
}
