import { InputId } from './common-types';

export type InputOverrideId = string & { readonly __input_override_id?: never };

export const createInputOverrideId = (nodeId: string, inputId: InputId): InputOverrideId => {
    if (nodeId.length !== 36)
        throw new Error('Expected node id to be a 36 character hexadecimal UUID.');
    return `#${nodeId}:${inputId}`;
};
