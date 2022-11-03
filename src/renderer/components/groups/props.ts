import {
    Group,
    GroupKind,
    InputData,
    InputSize,
    OfKind,
    SchemaId,
} from '../../../common/common-types';
import { GroupInputs } from '../../../common/group-inputs';

export interface GroupProps<Kind extends GroupKind> {
    group: OfKind<Group, Kind>;
    inputs: GroupInputs[Kind];
    schemaId: SchemaId;
    nodeId: string;
    isLocked: boolean;
    inputData: InputData;
    inputSize: InputSize | undefined;
}
