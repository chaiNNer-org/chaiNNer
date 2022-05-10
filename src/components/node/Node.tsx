import { CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import {
    Center,
    Menu,
    MenuItem,
    MenuList,
    Portal,
    useColorModeValue,
    VStack,
} from '@chakra-ui/react';
import { memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NodeData } from '../../common-types';
import checkNodeValidity from '../../helpers/checkNodeValidity';
import {
    GlobalConstantsContext,
    GlobalContext,
    GlobalSettersContext,
} from '../../helpers/contexts/GlobalNodeState';
import getAccentColor from '../../helpers/getNodeAccentColors';
import shadeColor from '../../helpers/shadeColor';
import NodeBody from './NodeBody';
import NodeFooter from './NodeFooter';
import NodeHeader from './NodeHeader';

const NodeWrapper = memo(({ data, selected }: NodeProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <Node
        data={data}
        selected={selected}
    />
));

interface NodeProps {
    data: NodeData;
    selected: boolean;
}

const Node = memo(({ data, selected }: NodeProps) => {
    const { nodes, edges } = useContext(GlobalContext);
    const { schemata } = useContext(GlobalConstantsContext);
    const { updateIteratorBounds, setHoveredNode } = useContext(GlobalSettersContext);

    const { id, inputData, isLocked, parentNode, schemaId } = data;

    // We get inputs and outputs this way in case something changes with them in the future
    // This way, we have to do less in the migration file
    const schema = schemata.get(schemaId);
    const { inputs, outputs, icon, category, name } = schema;

    const regularBorderColor = useColorModeValue('gray.400', 'gray.600');
    const accentColor = getAccentColor(category);
    const borderColor = useMemo(
        () => (selected ? shadeColor(accentColor, 0) : regularBorderColor),
        [selected, accentColor, regularBorderColor]
    );

    const [validity, setValidity] = useState<[boolean, string]>([false, '']);

    useEffect(() => {
        if (inputs.length) {
            setValidity(checkNodeValidity({ id, inputs, inputData, edges }));
        }
    }, [inputData, edges.length, nodes.length]);

    const targetRef = useRef<HTMLDivElement>(null);
    const [checkedSize, setCheckedSize] = useState(false);

    useLayoutEffect(() => {
        if (targetRef.current && parentNode) {
            updateIteratorBounds(parentNode, null, {
                width: targetRef.current.offsetWidth,
                height: targetRef.current.offsetHeight,
            });
            setCheckedSize(true);
        }
    }, [checkedSize, targetRef.current?.offsetHeight]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [showMenu, setShowMenu] = useState(false);
    // const [menuPosition, setMenuPosition] = useState({});

    // useEffect(() => {
    //   if (!selected) {
    //     setShowMenu(false);
    //   }
    // }, [selected]);

    return (
        <>
            <Menu isOpen={showMenu}>
                <Center
                    bg={useColorModeValue('gray.300', 'gray.700')}
                    borderColor={borderColor}
                    borderRadius="lg"
                    borderWidth="0.5px"
                    boxShadow="lg"
                    py={2}
                    ref={targetRef}
                    transition="0.15s ease-in-out"
                    onClick={() => {
                        // setShowMenu(false);
                    }}
                    onContextMenu={() => {
                        // WIP
                        // if (selected) {
                        //   if (showMenu) {
                        //     setShowMenu(false);
                        //   } else {
                        //     setMenuPosition({ x: event.clientX, y: event.clientY });
                        //     setShowMenu(true);
                        //   }
                        // }
                    }}
                    onDragEnter={() => {
                        if (parentNode) {
                            setHoveredNode(parentNode);
                        }
                    }}
                >
                    <VStack minWidth="240px">
                        <NodeHeader
                            accentColor={accentColor}
                            icon={icon}
                            name={name}
                            parentNode={parentNode}
                            selected={selected}
                        />
                        <NodeBody
                            accentColor={accentColor}
                            id={id}
                            inputData={inputData}
                            inputs={inputs}
                            isLocked={isLocked}
                            outputs={outputs}
                            schemaId={schemaId}
                        />
                        <NodeFooter
                            id={id}
                            invalidReason={validity[1]}
                            isLocked={isLocked}
                            isValid={validity[0]}
                            // toggleLock={toggleLock}
                        />
                    </VStack>
                </Center>
                <Portal>
                    <MenuList
                        position="fixed"
                        // top={menuPosition.y}
                        // left={menuPosition.x}
                    >
                        <MenuItem
                            icon={<CopyIcon />}
                            onClick={() => {
                                // duplicateNode(id);
                            }}
                        >
                            Duplicate
                        </MenuItem>
                        <MenuItem
                            icon={<CloseIcon />}
                            onClick={() => {
                                //  clearNode(id);
                            }}
                        >
                            Clear
                        </MenuItem>
                        <MenuItem
                            icon={<DeleteIcon />}
                            onClick={() => {
                                // removeNodeById(id);
                            }}
                        >
                            Delete
                        </MenuItem>
                    </MenuList>
                </Portal>
            </Menu>
        </>
    );
});

export default memo(NodeWrapper);
