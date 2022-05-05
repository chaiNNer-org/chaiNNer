export interface JsonObject {
    [key: string]: JsonValue;
}
export type JsonValue = null | string | number | boolean | JsonObject | JsonValue[];

export interface Size {
    width: number;
    height: number;
}
export interface IteratorSize extends Size {
    offsetTop: number;
    offsetLeft: number;
}

export type InputValue = InputSchemaValue | { id: string };
export type InputSchemaValue = string | number;
export interface InputOption {
    option: string;
    value: InputSchemaValue;
}
export type Input = {
    type: string;
    label: string;
    optional?: boolean;
    def?: InputSchemaValue;
    default?: InputSchemaValue;
    options?: InputOption[];
};
export type Output = { type: string; label: string };

export interface NodeSchema {
    name: string;
    subcategory: string;
    description: string;
    icon: string;
    nodeType: string;
    inputs: Input[];
    outputs: Output[];
    defaultNodes?: DefaultNode[];
}

export interface DefaultNode {
    // Default nodes aren't currently used
    __SPECIAL: never;
    category: string;
    name: string;
}

export type SchemaMap = Record<string, Record<string, NodeSchema>>;

export type NodeData = {
    id: string;
    parentNode?: string;
    category: string;
    subcategory: string;
    icon: string;
    type: string;
    isLocked?: boolean;
    inputData: Record<number, InputValue>;
    invalid?: boolean;
    iteratorSize?: IteratorSize;
    percentComplete?: number;
    maxWidth?: number;
    maxHeight?: number;
};
export type EdgeData = { complete?: boolean };

export interface PythonKeys {
    python: string;
    version: string;
}

export interface UsableData {
    category: string;
    node: string;
    id: string;
    inputs: Record<number, InputValue>;
    outputs: Record<number, InputValue>;
    child: boolean;
    children?: string[];
    nodeType: string | undefined;
    percent?: number;
}
