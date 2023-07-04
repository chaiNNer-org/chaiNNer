import { Group, GroupKind, OfKind } from '../../../common/common-types';
import { GroupInputs, InputItem } from '../../../common/group-inputs';
import { NodeState } from '../../helpers/nodeState';

export type InputItemRenderer = (props: {
    item: InputItem;
    nodeState: NodeState;
}) => JSX.Element | null;

export interface GroupProps<Kind extends GroupKind> {
    group: OfKind<Group, Kind>;
    inputs: GroupInputs[Kind];
    nodeState: NodeState;
    ItemRenderer: InputItemRenderer;
}
