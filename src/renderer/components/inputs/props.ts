import { Type } from '@chainner/navi';
import { Input, InputKind, OfKind, SchemaId, Size } from '../../../common/common-types';

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface InputProps<Kind extends InputKind, Value extends string | number = never> {
    readonly value: Value | undefined;
    readonly setValue: (input: Value) => void;
    readonly resetValue: () => void;
    readonly input: Omit<PartialBy<OfKind<Input, Kind>, 'id'>, 'type' | 'conversion'>;
    readonly definitionType: Type;
    readonly isLocked: boolean;
    readonly isConnected: boolean;
    readonly inputKey: string;
    readonly size: Readonly<Size> | undefined;
    readonly setSize: (size: Readonly<Size>) => void;
    readonly useInputType: () => Type;
    readonly nodeId?: string;
    readonly nodeSchemaId?: SchemaId;
}
