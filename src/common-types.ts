export interface Size {
  width: number;
  height: number;
}
export interface IteratorSize extends Size {
  offsetTop: number;
  offsetLeft: number;
}

export type InputValue = string | number | { id: string };
export type Input = {
  type: string;
  label: string;
  optional?: boolean;
  def?: InputValue;
  default?: InputValue;
  options?: { value: InputValue }[];
};
export type Output = { type: string; label: string };

export interface NodeSchema {
  category: string;
  name: string;
  subcategory: string;
  description: string;
  icon: string;
  nodeType: string;
  inputs: Input[];
  outputs: Output[];
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
