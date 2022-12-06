import {
    Group,
    GroupKind,
    InputData,
    InputSize,
    OfKind,
    SchemaId,
} from '../../../common/common-types';
import { GroupInputs, InputItem } from '../../../common/group-inputs';

export type InputItemRenderer = (props: {
    item: InputItem;
    nodeId: string;
    inputData: InputData;
    inputSize?: InputSize;
    isLocked: boolean;
    schemaId: SchemaId;
}) => JSX.Element | null;

export interface GroupProps<Kind extends GroupKind> {
    group: OfKind<Group, Kind>;
    inputs: GroupInputs[Kind];
    schemaId: SchemaId;
    nodeId: string;
    isLocked: boolean;
    inputData: InputData;
    inputSize: InputSize | undefined;
    ItemRenderer: InputItemRenderer;
}
