import { Input } from '../../../common/common-types';
import { InputItem } from '../../../common/group-inputs';

export const someInput = (item: InputItem, condFn: (input: Input) => boolean): boolean => {
    if (item.kind !== 'group') return condFn(item);
    return item.inputs.some((i) => someInput(i, condFn));
};
