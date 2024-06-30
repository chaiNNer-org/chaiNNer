import { Type } from '@chainner/navi';
import {
    Condition,
    Input,
    InputKind,
    OfKind,
    PartialBy,
    SchemaId,
    Size,
} from '../../../common/common-types';

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
    readonly inputType: Type;
    readonly nodeId?: string;
    readonly nodeSchemaId?: SchemaId;
    readonly testCondition: (condition: Condition) => boolean;
    readonly sequenceType?: Type;
}
