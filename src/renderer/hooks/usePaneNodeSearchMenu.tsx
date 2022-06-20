import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import {
    Box,
    HStack,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    MenuList,
    Text,
    useColorModeValue,
} from '@chakra-ui/react';
import log from 'electron-log';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OnConnectStartParams } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { NodeSchema } from '../../common/common-types';
import { IconFactory } from '../components/CustomIcons';
import { GlobalContext } from '../contexts/GlobalNodeState';
import getNodeAccentColors from '../helpers/getNodeAccentColors';
import { getMatchingNodes, getNodesByCategory } from '../helpers/nodeSearchFuncs';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const usePaneNodeSearchMenu = (
    connectingFrom: OnConnectStartParams | null,
    connectingFromType: string | null,
    onPaneContextMenuNodeClick: (node: NodeSchema, position: { x: number; y: number }) => void
): UseContextMenu => {
    const { schemata } = useContext(GlobalContext);

    const [searchQuery, setSearchQuery] = useState<string>('');
    const matchingNodes = useMemo(
        () =>
            getMatchingNodes(searchQuery, schemata.schemata).filter((node) => {
                if (!connectingFrom || !connectingFromType) {
                    return true;
                }
                if (connectingFrom.handleType === 'source') {
                    return node.inputs.some((input) => {
                        return connectingFromType === input.type && input.hasHandle;
                    });
                }
                if (connectingFrom.handleType === 'target') {
                    return node.outputs.some((output) => {
                        return connectingFromType === output.type;
                    });
                }
                log.error(`Unknown handle type: ${connectingFrom.handleType!}`);
                return true;
            }),
        [connectingFrom, connectingFromType, searchQuery, schemata.schemata]
    );
    const byCategories = useMemo(() => getNodesByCategory(matchingNodes), [matchingNodes]);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSearchQuery('');
    }, [connectingFrom]);

    return useContextMenu(
        () => (
            <MenuList
                bgColor="gray.800"
                borderWidth={0}
                className="nodrag"
                ref={menuRef}
            >
                <InputGroup
                    borderBottomWidth={1}
                    borderRadius={0}
                >
                    <InputLeftElement
                        color={useColorModeValue('gray.500', 'gray.300')}
                        pointerEvents="none"
                    >
                        <SearchIcon />
                    </InputLeftElement>
                    <Input
                        autoFocus
                        borderRadius={0}
                        placeholder="Search..."
                        spellCheck={false}
                        type="text"
                        value={searchQuery}
                        variant="filled"
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <InputRightElement
                        _hover={{ color: useColorModeValue('black', 'white') }}
                        style={{
                            color: useColorModeValue('gray.500', 'gray.300'),
                            cursor: 'pointer',
                            display: searchQuery ? undefined : 'none',
                            fontSize: '66%',
                        }}
                        onClick={() => setSearchQuery('')}
                    >
                        <CloseIcon />
                    </InputRightElement>
                </InputGroup>
                <Box
                    h="auto"
                    maxH={400}
                    overflowY="scroll"
                    p={1}
                >
                    {[...byCategories].map(([category, categoryNodes]) => {
                        const accentColor = getNodeAccentColors(category);
                        return (
                            <Box key={category}>
                                <HStack
                                    borderRadius="md"
                                    mx={1}
                                    py={0.5}
                                >
                                    <IconFactory
                                        accentColor={accentColor}
                                        boxSize={3}
                                        icon={category}
                                    />
                                    <Text fontSize="xs">{category}</Text>
                                </HStack>
                                {[...categoryNodes].map((node) => (
                                    <HStack
                                        _hover={{ backgroundColor: 'gray.700' }}
                                        borderRadius="md"
                                        key={node.schemaId}
                                        mx={1}
                                        px={2}
                                        py={0.5}
                                        onClick={() => {
                                            const position =
                                                menuRef.current!.getBoundingClientRect();
                                            setSearchQuery('');
                                            onPaneContextMenuNodeClick(node, position);
                                        }}
                                    >
                                        <IconFactory
                                            accentColor="gray.500"
                                            icon={node.icon}
                                        />
                                        <Text>{node.name}</Text>
                                    </HStack>
                                ))}
                            </Box>
                        );
                    })}
                </Box>
            </MenuList>
        ),
        [
            connectingFrom,
            connectingFromType,
            byCategories,
            menuRef,
            onPaneContextMenuNodeClick,
            searchQuery,
            schemata.schemata,
            matchingNodes,
        ]
    );
};
