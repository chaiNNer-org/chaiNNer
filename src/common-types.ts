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
}

export interface DefaultNode {
    // Default nodes aren't currently used
    __SPECIAL: never;
    category: string;
    name: string;
}

export interface NodeData {
    readonly id: string;
    readonly parentNode?: string;
    readonly category: string;
    readonly subcategory: string;
    readonly icon: string;
    readonly type: string;
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

export interface UsableData {
    category: string;
    node: string;
    id: string;
    inputs: Record<number, InputValue | null>;
    outputs: Record<number, InputValue>;
    child: boolean;
    children?: string[];
    nodeType: string | undefined;
    percent?: number;
}
