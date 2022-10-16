import { GroupId, Input } from '../../../common/common-types';

export interface GroupProps<Options = Record<string, unknown>> {
    id: GroupId;
    type: string;
    options: Readonly<Options>;
    inputs: readonly Input[];
}
