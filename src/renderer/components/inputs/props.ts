import { Type } from '@chainner/navi';
import {
    Input,
    InputData,
    InputId,
    InputKind,
    InputSchemaValue,
    SchemaId,
    Size,
} from '../../../common/common-types';

export interface InputProps {
    readonly id: string;
    readonly inputId: InputId;
    readonly inputData: InputData;
    readonly isLocked: boolean;
    readonly label: string;
    readonly schemaId: SchemaId;
    readonly optional: boolean;
    readonly definitionType: Type;
    readonly hasHandle: boolean;
    readonly useInputData: <T extends InputSchemaValue>(
        inputId: InputId
    ) => readonly [T | undefined, (value: T) => void, () => void];
    readonly useInputSize: (
        inputId: InputId
    ) => readonly [Readonly<Size> | undefined, (size: Readonly<Size>) => void];
}

export interface NewInputProps<Kind extends InputKind, Value extends string | number = never> {
    readonly value: Value | undefined;
    readonly setValue: (input: Value) => void;
    readonly resetValue: () => void;
    readonly input: Omit<Input & { readonly kind: Kind }, 'id' | 'type' | 'conversion'>;
    readonly definitionType: Type;
    readonly isLocked: boolean;
    readonly inputKey: string;
    readonly useInputLocked: () => boolean;
    readonly useInputType: () => Type;
    readonly useInputSize: () => readonly [
        Readonly<Size> | undefined,
        (size: Readonly<Size>) => void
    ];
}
