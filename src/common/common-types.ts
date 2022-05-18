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

export type InputValue = InputSchemaValue | { id: string } | undefined;
export type InputSchemaValue = string | number;
export interface InputOption {
    option: string;
    value: InputSchemaValue;
}
export interface Input {
    readonly type: string;
    readonly label: string;
    readonly optional?: boolean;
    readonly def?: InputSchemaValue;
    readonly default?: InputSchemaValue;
    readonly options?: InputOption[];
    readonly filetypes?: string[];
}
export interface Output {
    readonly type: string;
    readonly label: string;
}

export type InputData = Readonly<Record<number, InputValue>>;

export interface NodeSchema {
    readonly name: string;
    readonly category: string;
    readonly subcategory: string;
    readonly description: string;
    readonly icon: string;
    readonly nodeType: string;
    readonly inputs: Input[];
    readonly outputs: Output[];
    readonly defaultNodes?: DefaultNode[];
    readonly schemaId: string;
}

export interface DefaultNode {
    // Default nodes aren't currently used
    __SPECIAL: never;
    schemaId: string;
}

export interface NodeData {
    readonly id: string;
    readonly parentNode?: string;
    readonly schemaId: string;
    readonly isLocked?: boolean;
    readonly inputData: InputData;
    readonly invalid?: boolean;
    readonly iteratorSize?: IteratorSize;
    readonly percentComplete?: number;
    readonly maxWidth?: number;
    readonly maxHeight?: number;
}
export interface EdgeData {
    readonly complete?: boolean;
}

export interface PythonKeys {
    python: string;
    version: string;
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

export interface UsableData {
    id: string;
    schemaId: string;
    inputs: (InputValue | null)[];
    outputs: InputValue[];
    child: boolean;
    children?: string[];
    nodeType: string | undefined;
    percent?: number;
}

export interface WindowSize {
    readonly maximized: boolean;
    readonly width: number;
    readonly height: number;
}
