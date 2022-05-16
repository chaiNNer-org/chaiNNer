import { Center, VStack, useColorModeValue } from '@chakra-ui/react';
import { DragEvent, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from 'react-flow-renderer';
import { useContext, useContextSelector } from 'use-context-selector';
import path from 'path';
import { EdgeData, Input, NodeData } from '../../../common/common-types';
import checkNodeValidity from '../../helpers/checkNodeValidity';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getSingleFileWithExtension } from '../../helpers/dataTransfer';
import getAccentColor from '../../helpers/getNodeAccentColors';
import shadeColor from '../../helpers/shadeColor';
import NodeBody from './NodeBody';
import NodeFooter from './NodeFooter';
import NodeHeader from './NodeHeader';
import { AlertBoxContext } from '../../contexts/AlertBoxContext';

/**
 * If there is only one file input, then this input will be returned. `undefined` otherwise.
 */
const getSingleFileInput = (inputs: readonly Input[]): Input | undefined => {
    const fileInputs = inputs.filter((i) => {
        switch (i.type) {
            case 'file::image':
            case 'file::video':
            case 'file::pth':
            case 'file::bin':
            case 'file::param':
                return true;
            default:
                return false;
        }
    });

    return fileInputs.length === 1 ? fileInputs[0] : undefined;
};

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
    const { sendToast } = useContext(AlertBoxContext);
    const edgeChanges = useContextSelector(GlobalVolatileContext, (c) => c.edgeChanges);
    const { schemata, updateIteratorBounds, setHoveredNode, useInputData } =
        useContext(GlobalContext);
    const { getEdges } = useReactFlow<NodeData, EdgeData>();

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
            setValidity(checkNodeValidity({ id, inputs, inputData, edges: getEdges() }));
        }
    }, [inputData, edgeChanges]);

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
    }, [checkedSize, targetRef.current?.offsetHeight, updateIteratorBounds]);

    const fileInput = useMemo(() => getSingleFileInput(inputs), [inputs]);

    const onDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (fileInput && fileInput.filetypes && event.dataTransfer.types.includes('Files')) {
            event.stopPropagation();

            // eslint-disable-next-line no-param-reassign
            event.dataTransfer.dropEffect = 'move';
        }
    };

    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (fileInput && fileInput.filetypes && event.dataTransfer.types.includes('Files')) {
            event.stopPropagation();

            const p = getSingleFileWithExtension(event.dataTransfer, fileInput.filetypes);
            if (p) {
                const index = inputs.indexOf(fileInput);
                const [, setInput] = useInputData<string>(id, index, inputData);
                setInput(p);
                return;
            }

            if (event.dataTransfer.files.length !== 1) {
                sendToast({
                    status: 'error',
                    description: `Only one file is accepted by ${fileInput.label}.`,
                });
            } else {
                const ext = path.extname(event.dataTransfer.files[0].path);
                sendToast({
                    status: 'error',
                    description: `${fileInput.label} does not accept ${ext} files.`,
                });
            }
        }
    };

    return (
        <Center
            bg={useColorModeValue('gray.300', 'gray.700')}
            borderColor={borderColor}
            borderRadius="lg"
            borderWidth="0.5px"
            boxShadow="lg"
            py={2}
            ref={targetRef}
            transition="0.15s ease-in-out"
            onDragEnter={() => {
                if (parentNode) {
                    setHoveredNode(parentNode);
                }
            }}
            onDragOver={onDragOver}
            onDrop={onDrop}
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
                />
            </VStack>
        </Center>
    );
});

export default memo(NodeWrapper);
