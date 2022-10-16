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
export interface InputOption {
    option: string;
    value: InputSchemaValue;
    type?: ExpressionJson;
}
export type InputKind =
    | 'number'
    | 'slider'
    | 'dropdown'
    | 'text'
    | 'text-line'
    | 'directory'
    | 'file'
    | 'generic';
export type FileInputKind = 'image' | 'pth' | 'pt' | 'video' | 'bin' | 'param' | 'onnx';
export interface Input {
    readonly id: InputId;
    readonly type: ExpressionJson;
    readonly conversion?: ExpressionJson | null;
    readonly kind: InputKind;
    readonly label: string;
    readonly optional: boolean;
    readonly hasHandle: boolean;
    readonly def?: InputSchemaValue;
    readonly default?: InputSchemaValue;
    readonly options?: InputOption[];
    readonly fileKind?: FileInputKind;
    readonly filetypes?: string[];
}

export type OutputKind = 'image' | 'large-image' | 'text' | 'directory' | 'pytorch' | 'generic';

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

export interface Group {
    readonly id: GroupId;
    readonly type: string;
    readonly options: Readonly<Partial<Record<string, unknown>>>;
    readonly items: readonly InputId[];
}

export type NodeType = 'regularNode' | 'iterator' | 'iteratorHelper';

export type InputData = Readonly<Record<InputId, InputValue>>;
export type InputSize = Readonly<Record<InputId, Readonly<Size>>>;
export type OutputData = Readonly<Record<OutputId, unknown>>;
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
    readonly groups: readonly Group[];
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
    readonly iteratorSize?: IteratorSize;
    readonly percentComplete?: number;
    readonly minWidth?: number;
    readonly minHeight?: number;
}
export interface EdgeData {
    readonly complete?: boolean;
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

export interface JsonEdgeInput {
    type: 'edge';
    id: string;
    index: number;
}
export interface JsonValueInput {
    type: 'value';
    value: InputValue | null;
}
export type JsonInput = JsonEdgeInput | JsonValueInput;
export interface JsonNode {
    id: string;
    schemaId: SchemaId;
    inputs: JsonInput[];
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
