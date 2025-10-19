/* eslint-disable prefer-destructuring */
/* eslint-disable no-param-reassign */

import { Edge, Node, Viewport, getConnectedEdges, getOutgoers } from 'reactflow';
import semver from 'semver';
import {
    ColorJson,
    EdgeData,
    InputData,
    InputId,
    InputValue,
    Mutable,
    NodeData,
    NodeSchema,
    OutputId,
    SchemaId,
    Size,
} from './common-types';
import { log } from './log';
import { legacyMigrations } from './migrations-legacy';
import {
    ParsedSourceHandle,
    ParsedTargetHandle,
    assertNever,
    deriveUniqueId,
    parseSourceHandle,
    parseTargetHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from './util';

interface ReadonlyNodeData extends Omit<NodeData, 'inputData'> {
    inputData: Record<number | string, InputValue>;
}

type N = Node<Mutable<ReadonlyNodeData>>;
type E = Edge<Mutable<EdgeData>>;

export interface SaveData {
    nodes: N[];
    edges: E[];
    viewport: Viewport;
}

type ModernMigration = (data: SaveData) => SaveData;

const toV080: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        // Convert Resize (Factor) and Average Color Fix to percentage
        if (node.data.schemaId === 'chainner:image:resize_factor') {
            node.data.inputData[1] = (node.data.inputData[1] as number) * 100.0;
        }
        if (node.data.schemaId === 'chainner:image:average_color_fix') {
            node.data.inputData[2] = (node.data.inputData[2] as number) * 100.0;
        }
        // Invert interpolation weight
        if (
            ['chainner:pytorch:interpolate_models', 'chainner:ncnn:interpolate_models'].includes(
                node.data.schemaId
            )
        ) {
            node.data.inputData[2] = 100 - (node.data.inputData[2] as number);
        }
    });
    return data;
};

const updateAdjustmentScale: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        // Convert slider scales for several Adjustment nodes
        if (node.data.schemaId === 'chainner:image:hue_and_saturation') {
            node.data.inputData[2] = (((node.data.inputData[2] as number) / 255) * 100.0).toFixed(
                1
            );
        }
        if (node.data.schemaId === 'chainner:image:brightness_and_contrast') {
            node.data.inputData[1] = (((node.data.inputData[1] as number) / 255) * 100.0).toFixed(
                1
            );
            node.data.inputData[2] = (((node.data.inputData[2] as number) / 255) * 100.0).toFixed(
                1
            );
        }
    });
    return data;
};

const fixBlurNode: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        // Convert Blur Nodes to Gaussian Blur nodes
        if (node.data.schemaId === 'chainner:image:blur') {
            node.data.schemaId = 'chainner:image:gaussian_blur' as SchemaId;
            node.data.inputData[1] =
                Math.round((1.16531 * (node.data.inputData[1] as number) - 0.153601) * 10) / 10;
            node.data.inputData[2] =
                Math.round((1.16531 * (node.data.inputData[2] as number) - 0.153601) * 10) / 10;
        }
    });
    return data;
};

const addBlendNode: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        // Convert Difference Nodes to Blend Image Nodes
        if (node.data.schemaId === 'chainner:image:difference') {
            node.data.schemaId = 'chainner:image:blend' as SchemaId;
            node.data.inputData[2] = 100;
            node.data.inputData[3] = 100;
            node.data.inputData[4] = 10;
        }

        // Convert Overlay Images Nodes to Blend Image Nodes
        if (node.data.schemaId === 'chainner:image:overlay') {
            const findEdgesToChange = () => {
                const edgeList: { input?: number; output?: number } = {};
                data.edges.forEach((edge, index) => {
                    if (
                        edge.target === node.id &&
                        edge.targetHandle?.split('-').slice(-1)[0] === '3'
                    ) {
                        edgeList.input = index;
                    } else if (edge.source === node.id) {
                        edgeList.output = index;
                    }
                });
                return edgeList;
            };
            const edgesToChange = findEdgesToChange();

            // If there is a second overlay input, need to add second blend node and
            // update edges.
            if (edgesToChange.input !== undefined) {
                const newID = deriveUniqueId(node.id + String(node.data.inputData[4]));
                const newBlendNode: N = {
                    data: {
                        schemaId: 'chainner:image:blend' as SchemaId,
                        inputData: { 2: 100, 3: node.data.inputData[4] },
                        id: newID,
                    },
                    id: newID,
                    position: { x: node.position.x + 300, y: node.position.y - 100 },
                    type: 'regularNode',
                    selected: false,
                    height: node.height,
                    width: node.width,
                    zIndex: node.zIndex,
                };
                if (node.parentNode !== undefined) {
                    newBlendNode.parentNode = node.parentNode;
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    newBlendNode.data.parentNode = node.parentNode;
                }
                data.nodes.push(newBlendNode);

                data.edges[edgesToChange.input].target = newID;
                data.edges[edgesToChange.input].targetHandle = `${newID}-1`;
                if (edgesToChange.output !== undefined) {
                    data.edges[edgesToChange.output].source = newID;
                    data.edges[edgesToChange.output].sourceHandle = `${newID}-0`;
                }

                const newOutputEdge = {
                    id: deriveUniqueId(node.id + newID),
                    sourceHandle: `${node.id}-0`,
                    targetHandle: `${newID}-0`,
                    source: node.id,
                    target: newID,
                    type: 'main',
                    animated: false,
                    data: {},
                    zIndex: node.zIndex! - 1,
                };
                data.edges.push(newOutputEdge);
            }

            node.data.schemaId = 'chainner:image:blend' as SchemaId;
            node.data.inputData[3] = node.data.inputData[2];
            node.data.inputData[2] =
                node.data.inputData[5] !== undefined ? node.data.inputData[5] : 100;
            node.data.inputData[4] = 0;
        }
    });
    return data;
};

const updateRotateNode: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        // Update rotation angle from dropdown to slider
        if (node.data.schemaId === 'chainner:image:rotate') {
            const RotDeg = node.data.inputData[1];
            if (RotDeg === 0) {
                node.data.inputData[1] = 90;
            } else if (RotDeg === '1') {
                node.data.inputData[1] = 180;
            } else {
                node.data.inputData[1] = 270;
            }
        }
    });
    return data;
};

const addOpacityNode: ModernMigration = (data) => {
    const createOpacityNode = (node: N, opacityValue: InputValue, yMoveDirection: number) => {
        const newID = deriveUniqueId(node.id + String(yMoveDirection));
        const newNode: N = {
            data: {
                schemaId: 'chainner:image:opacity' as SchemaId,
                inputData: { 1: opacityValue },
                id: newID,
            },
            id: newID,
            position: {
                x: node.position.x - 260,
                y: node.position.y + yMoveDirection * 150,
            },
            type: 'regularNode',
            selected: false,
            height: node.height,
            width: node.width,
            zIndex: node.zIndex,
        };
        if (node.parentNode !== undefined) {
            newNode.parentNode = node.parentNode;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            newNode.data.parentNode = node.parentNode;
        }
        return [newID, newNode] as const;
    };

    const createOutputEdge = (
        opacityNodeID: string,
        blendNodeID: string,
        handleID: number,
        nodeZIndex: number
    ) => {
        return {
            id: deriveUniqueId(opacityNodeID + blendNodeID + String(handleID)),
            sourceHandle: `${opacityNodeID}-0`,
            targetHandle: `${blendNodeID}-${handleID}`,
            source: opacityNodeID,
            target: blendNodeID,
            type: 'main',
            animated: false,
            data: {},
            zIndex: nodeZIndex,
        };
    };

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:blend') {
            const findEdgesToChange = () => {
                const edgeList: { baseInput?: number; ovInput?: number } = {};
                data.edges.forEach((edge, index) => {
                    if (edge.target === node.id) {
                        if (
                            edge.targetHandle?.split('-').slice(-1)[0] === '0' &&
                            node.data.inputData[2] !== 100
                        ) {
                            edgeList.baseInput = index;
                        } else if (
                            edge.targetHandle?.split('-').slice(-1)[0] === '1' &&
                            node.data.inputData[3] !== 100
                        ) {
                            edgeList.ovInput = index;
                        }
                    }
                });
                return edgeList;
            };
            const edgesToChange = findEdgesToChange();

            let baseOpacityNode;
            if (node.data.inputData[2] !== 100) {
                const [newID, newNode] = createOpacityNode(node, node.data.inputData[2], -1);
                baseOpacityNode = newID;
                data.nodes.push(newNode);
            }
            let ovOpacityNode;
            if (node.data.inputData[3] !== 100) {
                const [newID, newNode] = createOpacityNode(node, node.data.inputData[3], 1);
                ovOpacityNode = newID;
                data.nodes.push(newNode);
            }

            if (baseOpacityNode !== undefined) {
                if (edgesToChange.baseInput !== undefined) {
                    data.edges[edgesToChange.baseInput].target = baseOpacityNode;
                    data.edges[edgesToChange.baseInput].targetHandle = `${baseOpacityNode}-0`;
                }
                data.edges.push(createOutputEdge(baseOpacityNode, node.id, 0, node.zIndex! - 1));
            }
            if (ovOpacityNode !== undefined) {
                if (edgesToChange.ovInput !== undefined) {
                    data.edges[edgesToChange.ovInput].target = ovOpacityNode;
                    data.edges[edgesToChange.ovInput].targetHandle = `${ovOpacityNode}-0`;
                }
                data.edges.push(createOutputEdge(ovOpacityNode, node.id, 1, node.zIndex! - 1));
            }

            node.data.inputData[2] = node.data.inputData[4];
        }
    });
    return data;
};

const fixDropDownNumberValues: ModernMigration = (data) => {
    const needToConvert = new Set([
        'chainner:image:resize_factor/2',
        'chainner:image:resize_resolution/3',
        'chainner:image:threshold/3',
        'chainner:image:threshold_adaptive/2',
        'chainner:image:threshold_adaptive/3',
        'chainner:image:color_transfer/3',
        'chainner:image:color_transfer/4',
        'chainner:image:blend/2',
        'chainner:image:change_colorspace/1',
        'chainner:image:create_border/1',
        'chainner:image:rotate/2',
        'chainner:image:rotate/3',
        'chainner:image:rotate/4',
        'chainner:image:flip/1',
        'chainner:image:fill_alpha/1',
    ]);

    data.nodes.forEach((node) => {
        Object.keys(node.data.inputData).forEach((id) => {
            if (needToConvert.has(`${node.data.schemaId}/${id}`)) {
                const value = node.data.inputData[id];
                if (typeof value === 'string') {
                    node.data.inputData[id] = Number(value);
                }
            }
        });
    });

    return data;
};

const onnxConvertUpdate: ModernMigration = (data) => {
    const createOnnxSaveNode = (node: N, directory: InputValue, modelName: InputValue) => {
        const newID = deriveUniqueId(node.id + String(directory) + String(modelName));
        const newNode: N = {
            data: {
                schemaId: 'chainner:onnx:save_model' as SchemaId,
                inputData: { 1: directory, 2: modelName },
                id: newID,
            },
            id: newID,
            position: {
                x: node.position.x + 300,
                y: node.position.y + 200,
            },
            type: 'regularNode',
            selected: false,
            height: node.height,
            width: node.width,
            zIndex: node.zIndex,
        };
        if (node.parentNode !== undefined) {
            newNode.parentNode = node.parentNode;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            newNode.data.parentNode = node.parentNode;
        }

        const newEdge = {
            id: deriveUniqueId(node.id + newID),
            sourceHandle: `${node.id}-0`,
            targetHandle: `${newID}-0`,
            source: node.id,
            target: newID,
            type: 'main',
            animated: false,
            data: {},
            zIndex: node.zIndex! - 1,
        };
        return [newID, newNode, newEdge] as const;
    };

    const edgesToRemove: E[] = [];
    const nodesToRemove: N[] = [];
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:pytorch:convert_to_onnx') {
            const connectedEdges = getConnectedEdges([node], data.edges);
            const nameInputEdge = connectedEdges.find((edge) => {
                return edge.targetHandle === `${node.id}-2`;
            });

            const downstreamNodes = getOutgoers(node, data.nodes, data.edges);
            downstreamNodes.forEach((downstreamNode) => {
                if (downstreamNode.data.schemaId === 'chainner:onnx:load_model') {
                    const edgesConnectedToLoad = getConnectedEdges([downstreamNode], data.edges);
                    edgesConnectedToLoad.forEach((loadEdge) => {
                        if (loadEdge.target === downstreamNode.id) {
                            edgesToRemove.push(loadEdge);
                        } else if (loadEdge.sourceHandle === `${downstreamNode.id}-0`) {
                            loadEdge.source = node.id;
                            loadEdge.sourceHandle = `${node.id}-0`;
                        } else if (loadEdge.sourceHandle === `${downstreamNode.id}-1`) {
                            data.nodes.forEach((modelNameAsInputNode) => {
                                if (loadEdge.target === modelNameAsInputNode.id) {
                                    const inputDataIndex = loadEdge
                                        .targetHandle!.split('-')
                                        .slice(-1)[0];
                                    modelNameAsInputNode.data.inputData[inputDataIndex] =
                                        node.data.inputData[2];

                                    if (nameInputEdge !== undefined) {
                                        const newNameInputEdge = { ...nameInputEdge };
                                        newNameInputEdge.target = modelNameAsInputNode.id;
                                        newNameInputEdge.targetHandle = `${modelNameAsInputNode.id}-${inputDataIndex}`;
                                        newNameInputEdge.id = deriveUniqueId(
                                            newNameInputEdge.targetHandle
                                        );
                                        data.edges.push(newNameInputEdge);
                                    }
                                }
                            });
                            edgesToRemove.push(loadEdge);
                        }
                    });

                    nodesToRemove.push(downstreamNode);
                }
            });

            // Create new save model node for convert node to connect to
            const directory = node.data.inputData[1];
            const modelName = node.data.inputData[2];
            const [saveID, saveNode, saveEdge] = createOnnxSaveNode(node, directory, modelName);
            data.nodes.push(saveNode);
            data.edges.push(saveEdge);
            if (nameInputEdge !== undefined) {
                nameInputEdge.target = saveID;
                nameInputEdge.targetHandle = `${saveID}-2`;
            }
        }
    });

    // Delete edges connecting convert to load model
    edgesToRemove.forEach((edgeToRemove) => {
        data.edges.splice(data.edges.indexOf(edgeToRemove), 1);
    });
    // Delete load model nodes
    nodesToRemove.forEach((nodeToRemove) => {
        data.nodes.splice(data.nodes.indexOf(nodeToRemove), 1);
    });

    return data;
};

const removeEmptyStrings: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        node.data.inputData = Object.fromEntries(
            Object.entries(node.data.inputData).filter(([, value]) => value !== '')
        );
    });

    return data;
};

const blockSizeToRadius: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:threshold_adaptive') {
            const size = Number(node.data.inputData[4] ?? 3);
            node.data.inputData[4] = Math.floor((size - 1) / 2);
        }
    });

    return data;
};

const removeTargetTileSize: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (
            ['chainner:ncnn:upscale_image', 'chainner:onnx:upscale_image'].includes(
                node.data.schemaId
            )
        ) {
            delete node.data.inputData[2];
        }
    });

    return data;
};

const addTargetTileSizeAgain: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (
            [
                'chainner:ncnn:upscale_image',
                'chainner:onnx:upscale_image',
                'chainner:pytorch:upscale_image',
            ].includes(node.data.schemaId)
        ) {
            node.data.inputData[2] = 0;
        }
    });

    return data;
};

const brightnessImplementationChange: ModernMigration = (data) => {
    const newNodes: N[] = [];
    const newEdges: E[] = [];
    const edgeMapping = new Map<string, string>();

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:brightness_and_contrast') {
            const brightness = node.data.inputData[1] ?? 0;
            if (brightness !== 0) {
                // set the brightness to 0 and create a Hue & Sat node in its place
                node.data.inputData[1] = 0;
                const id = deriveUniqueId(node.id);

                newNodes.push({
                    data: {
                        schemaId: 'chainner:image:hue_and_saturation' as SchemaId,
                        inputData: { 1: 0, 2: 0, 3: brightness },
                        id,
                    },
                    id,
                    position: { x: node.position.x - 280, y: node.position.y - 20 },
                    type: 'regularNode',
                    selected: false,
                    height: 356,
                    width: 242,
                    zIndex: 50,
                });
                newEdges.push({
                    id: deriveUniqueId(id),
                    sourceHandle: `${id}-0`,
                    targetHandle: `${node.id}-0`,
                    source: id,
                    target: node.id,
                    type: 'main',
                    animated: false,
                    data: {},
                    zIndex: 49,
                });
                edgeMapping.set(`${node.id}-0`, `${id}-0`);
            }
        }
    });
    data.edges.forEach((edge) => {
        const to = edgeMapping.get(edge.targetHandle!);
        if (to) {
            edge.targetHandle = to;
            edge.target = parseTargetHandle(to).nodeId;
        }
    });

    data.nodes.push(...newNodes);
    data.edges.push(...newEdges);

    return data;
};

const convertColorSpaceFromTo: ModernMigration = (data) => {
    const GRAY = 0;
    const RGB = 1;
    const RGBA = 2;
    const YUV = 3;
    const HSV = 4;

    const mapping: Partial<Record<number, [number, number]>> = {
        6: [RGB, GRAY],
        8: [GRAY, RGB],
        0: [RGB, RGBA],
        1: [RGBA, RGB],
        10: [RGBA, GRAY],
        9: [GRAY, RGBA],
        82: [RGB, YUV],
        84: [YUV, RGB],
        40: [RGB, HSV],
        54: [HSV, RGB],
    };
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:change_colorspace') {
            const [from, to] = mapping[node.data.inputData[1] as number] ?? [RGB, RGB];
            node.data.inputData[1] = from;
            node.data.inputData[2] = to;
        }
    });

    return data;
};

const convertColorRGBLikeDetector: ModernMigration = (data) => {
    const GRAY = 0;
    const RGB = 1;
    const RGBA = 2;
    const RGB_LIKE = 1000;

    const mapping: Partial<Record<number, number>> = {
        [GRAY]: RGB_LIKE,
        [RGB]: RGB_LIKE,
        [RGBA]: RGB_LIKE,
    };
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:change_colorspace') {
            const from = node.data.inputData[1];
            node.data.inputData[1] = mapping[from as number] ?? from;
        }
    });

    return data;
};

const convertNormalGenerator: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:normal_generator') {
            const old = { ...node.data.inputData };
            node.data.inputData[1] = 0;
            node.data.inputData[2] = old[1];
            node.data.inputData[3] = 0;
            node.data.inputData[4] = 1;
            node.data.inputData[5] = old[3];
            node.data.inputData[6] = old[4];
            node.data.inputData[7] = 'none';
        }
    });

    return data;
};

const convertColorSpaceFromDetectors: ModernMigration = (data) => {
    const YUV = 3;
    const HSV = 4;
    const HSL = 5;
    const YUV_LIKE = 1001;
    const HSV_LIKE = 1002;
    const HSL_LIKE = 1003;

    const mapping: Partial<Record<number, number>> = {
        [YUV]: YUV_LIKE,
        [HSV]: HSV_LIKE,
        [HSL]: HSL_LIKE,
    };

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:change_colorspace') {
            const from = node.data.inputData[1];
            node.data.inputData[1] = mapping[from as number] ?? from;
        }
    });

    return data;
};

const fixNumbers: ModernMigration = (data) => {
    // https://github.com/chaiNNer-org/chaiNNer/issues/1364

    const numbers: Record<string, number[] | undefined> = {
        'chainner:image:save': [5],
        'chainner:image:spritesheet_iterator': [1, 2],
        'chainner:image:simple_video_frame_iterator_save': [5],
        'chainner:image:crop_border': [1],
        'chainner:image:crop_content': [1],
        'chainner:image:crop_edges': [1, 2, 3, 4],
        'chainner:image:crop_offsets': [1, 2, 3, 4],
        'chainner:image:resize_factor': [1],
        'chainner:image:resize_resolution': [1, 2],
        'chainner:image:resize_to_side': [1],
        'chainner:image:tile_fill': [1, 2],
        'chainner:image:brightness_and_contrast': [1, 2],
        'chainner:image:gamma': [1],
        'chainner:image:hue_and_saturation': [1, 2, 3],
        'chainner:image:opacity': [1],
        'chainner:image:threshold': [1, 2],
        'chainner:image:threshold_adaptive': [1, 4, 5],
        'chainner:image:add_noise': [3],
        'chainner:image:average_color_fix': [2],
        'chainner:image:bilateral_blur': [1, 2, 3],
        'chainner:image:blur': [1, 2],
        'chainner:image:gaussian_blur': [1, 2],
        'chainner:image:median_blur': [1],
        'chainner:image:sharpen_hbf': [2],
        'chainner:image:add_normals': [1, 3],
        'chainner:image:normal_generator': [2, 3, 4],
        'chainner:image:sharpen': [1, 2, 3],
        'chainner:image:canny_edge_detection': [1, 2],
        'chainner:image:caption': [2],
        'chainner:image:create_border': [2],
        'chainner:image:create_color_gray': [0, 1, 2],
        'chainner:image:create_color_rgb': [0, 1, 2, 3, 4],
        'chainner:image:create_color_rgba': [0, 1, 2, 3, 4, 5],
        'chainner:image:create_edges': [2, 3, 4, 5],
        'chainner:image:rotate': [1],
        'chainner:image:shift': [1, 2],
        'chainner:utility:math': [0, 2],
        'chainner:utility:text_padding': [1],
        'chainner:pytorch:interpolate_models': [2],
        'chainner:pytorch:upscale_face': [3],
        'chainner:ncnn:interpolate_models': [2],
        'chainner:onnx:interpolate_models': [2],
    };

    data.nodes.forEach((node) => {
        const numberInputs = numbers[node.data.schemaId];
        if (Array.isArray(numberInputs)) {
            for (const id of numberInputs) {
                const value = Number(node.data.inputData[id] ?? NaN);
                if (Number.isNaN(value)) {
                    delete node.data.inputData[id];
                } else {
                    node.data.inputData[id] = value;
                }
            }
        }
    });

    return data;
};

const clearEdgeData: ModernMigration = (data) => {
    data.edges.forEach((edge) => {
        edge.data = {};
    });

    return data;
};

const gammaCheckbox: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:gamma') {
            const from = node.data.inputData[2] as 'normal' | 'invert';
            node.data.inputData[2] = from === 'invert' ? 1 : 0;
        }
    });

    return data;
};

const changeColorSpaceAlpha: ModernMigration = (data) => {
    const RGB = 1;
    const RGBA = 2;
    const YUV = 3;
    const HSV = 4;
    const HSL = 5;
    const YUVA = 7;
    const HSVA = 8;
    const HSLA = 9;
    const LAB = 10;
    const LABA = 11;
    const LCH = 12;
    const LCHA = 13;

    const mapping: Partial<Record<number, number>> = {
        [RGBA]: RGB,
        [YUVA]: YUV,
        [HSVA]: HSV,
        [HSLA]: HSL,
        [LABA]: LAB,
        [LCHA]: LCH,
    };

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:change_colorspace') {
            const to = node.data.inputData[2] as number;
            const mapped = mapping[to];
            if (mapped === undefined) {
                node.data.inputData[2] = to;
                node.data.inputData[3] = 0; // output alpha: False
            } else {
                node.data.inputData[2] = mapped;
                node.data.inputData[3] = 1; // output alpha: True
            }
        }
    });

    return data;
};

const deriveSeed: ModernMigration = (data) => {
    const newNodes: N[] = [];
    const newEdges: E[] = [];

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:utility:random_number') {
            const sourceEdge = data.edges.find((e) => e.targetHandle === `${node.id}-3`);
            if (sourceEdge) {
                const id = deriveUniqueId(node.id);
                newNodes.push({
                    data: {
                        schemaId: 'chainner:utility:derive_seed' as SchemaId,
                        inputData: { 0: node.data.inputData[2] },
                        id,
                    },
                    id,
                    position: { x: node.position.x - 280, y: node.position.y - 20 },
                    type: 'regularNode',
                    selected: false,
                    height: 356,
                    width: 242,
                    zIndex: node.zIndex,
                    parentNode: node.parentNode,
                });
                sourceEdge.target = id;
                sourceEdge.targetHandle = `${id}-1`;

                const seedEdge = data.edges.find((e) => e.targetHandle === `${node.id}-2`);
                if (seedEdge) {
                    sourceEdge.target = id;
                    sourceEdge.targetHandle = `${id}-2`;
                }

                newEdges.push({
                    id: deriveUniqueId(node.id + id),
                    source: id,
                    sourceHandle: `${id}-0`,
                    target: node.id,
                    targetHandle: `${node.id}-2`,
                    type: 'main',
                    animated: false,
                    data: {},
                    zIndex: sourceEdge.zIndex,
                });
            }
        }
    });
    data.nodes.push(...newNodes);
    data.edges.push(...newEdges);

    return data;
};

const seedInput: ModernMigration = (data) => {
    const changedInputs: Record<string, number> = {
        'chainner:external_stable_diffusion:img2img': 4,
        'chainner:external_stable_diffusion:img2img_inpainting': 5,
        'chainner:external_stable_diffusion:img2img_outpainting': 4,
        'chainner:external_stable_diffusion:txt2img': 2,
        'chainner:image:create_noise': 2,
        'chainner:image:add_noise': 4,
    };

    const newNodes: N[] = [];
    const newEdges: E[] = [];

    data.nodes.forEach((node) => {
        const inputId = changedInputs[node.data.schemaId];
        if (typeof inputId === 'number') {
            const seedEdge = data.edges.find((e) => e.targetHandle === `${node.id}-${inputId}`);
            if (seedEdge) {
                const id = deriveUniqueId(`${node.id}seedInput`);
                newNodes.push({
                    data: {
                        schemaId: 'chainner:utility:derive_seed' as SchemaId,
                        inputData: { 0: 0 },
                        id,
                    },
                    id,
                    position: { x: node.position.x - 280, y: node.position.y - 20 },
                    type: 'regularNode',
                    selected: false,
                    height: 356,
                    width: 242,
                    zIndex: node.zIndex,
                    parentNode: node.parentNode,
                });
                seedEdge.target = id;
                seedEdge.targetHandle = `${id}-1`;

                newEdges.push({
                    id: deriveUniqueId(node.id + id),
                    source: id,
                    sourceHandle: `${id}-0`,
                    target: node.id,
                    targetHandle: `${node.id}-${inputId}`,
                    type: 'main',
                    animated: false,
                    data: {},
                    zIndex: seedEdge.zIndex,
                });
            }
        }
    });
    data.nodes.push(...newNodes);
    data.edges.push(...newEdges);

    return data;
};

const createColor: ModernMigration = (data) => {
    const CREATE_COLOR_GRAY = 'chainner:image:create_color_gray' as SchemaId;
    const CREATE_COLOR_RGB = 'chainner:image:create_color_rgb' as SchemaId;
    const CREATE_COLOR_RGBA = 'chainner:image:create_color_rgba' as SchemaId;
    const CREATE_COLOR = 'chainner:image:create_color' as SchemaId;
    const COLOR_FROM = 'chainner:utility:color_from_channels' as SchemaId;

    const newNodes: N[] = [];
    const newEdges: E[] = [];
    const nodesToRemove = new Set<string>();

    const newCreateColor = (color: ColorJson, width: number, height: number, from: N): string => {
        const id = deriveUniqueId(`${CREATE_COLOR}/${from.id}`);
        newNodes.push({
            data: {
                id,
                schemaId: CREATE_COLOR,
                inputData: {
                    0: JSON.stringify(color),
                    1: width,
                    2: height,
                },
            },
            id,
            position: { ...from.position },
            type: 'regularNode',
            selected: false,
            zIndex: from.zIndex,
            parentNode: from.parentNode,
        });
        return id;
    };
    const getColorFromInputData = (color: ColorJson): Record<string | number, InputValue> => {
        const to8Bit = (n: number) => Math.round(n * 255);
        const toPercent = (n: number) => Number((n * 100).toFixed(1));

        switch (color.kind) {
            case 'grayscale': {
                const [luma] = color.values;
                return { 0: 0, 1: to8Bit(luma) };
            }
            case 'rgb': {
                const [r, g, b] = color.values;
                return { 0: 1, 2: to8Bit(r), 3: to8Bit(g), 4: to8Bit(b) };
            }
            case 'rgba': {
                const [r, g, b, a] = color.values;
                return { 0: 2, 2: to8Bit(r), 3: to8Bit(g), 4: to8Bit(b), 5: toPercent(a) };
            }
            default:
                return assertNever(color);
        }
    };
    const newColorFrom = (color: ColorJson, from: N): string => {
        const id = deriveUniqueId(`${COLOR_FROM}/${from.id}`);
        newNodes.push({
            data: {
                id,
                schemaId: COLOR_FROM,
                inputData: getColorFromInputData(color),
            },
            id,
            position: { x: from.position.x - 260, y: from.position.y },
            type: 'regularNode',
            selected: false,
            zIndex: from.zIndex,
            parentNode: from.parentNode,
        });
        return id;
    };

    const hasSomeEdgesToTargets = (nodeId: string, inputIds: number[]): boolean => {
        const handles = new Set<string>();
        for (const inputId of inputIds) {
            handles.add(stringifyTargetHandle({ nodeId, inputId: inputId as InputId }));
        }

        for (const e of data.edges) {
            if (handles.has(e.targetHandle!)) {
                return true;
            }
        }
        return false;
    };
    const changeEdgeIfExistsTarget = (from: ParsedTargetHandle, to: ParsedTargetHandle): void => {
        const handle = stringifyTargetHandle(from);
        for (const e of data.edges) {
            if (e.targetHandle === handle) {
                e.targetHandle = stringifyTargetHandle(to);
                e.target = to.nodeId;
                break;
            }
        }
    };
    const changeEdgeIfExistsSource = (from: ParsedSourceHandle, to: ParsedSourceHandle): void => {
        const handle = stringifySourceHandle(from);
        for (const e of data.edges) {
            if (e.sourceHandle === handle) {
                e.sourceHandle = stringifySourceHandle(to);
                e.source = to.nodeId;
            }
        }
    };
    const newEdge = (from: ParsedSourceHandle, to: ParsedTargetHandle): void => {
        const f = stringifySourceHandle(from);
        const t = stringifyTargetHandle(to);
        newEdges.push({
            id: deriveUniqueId(f + t),
            source: from.nodeId,
            sourceHandle: f,
            target: to.nodeId,
            targetHandle: t,
            type: 'main',
            animated: false,
        });
    };

    data.nodes.forEach((node) => {
        if (
            node.data.schemaId === CREATE_COLOR_GRAY ||
            node.data.schemaId === CREATE_COLOR_RGB ||
            node.data.schemaId === CREATE_COLOR_RGBA
        ) {
            let inputDataColor: ColorJson;
            if (node.data.schemaId === CREATE_COLOR_GRAY) {
                inputDataColor = {
                    kind: 'grayscale',
                    values: [Number(node.data.inputData[2] ?? 126) / 255],
                };
            } else if (node.data.schemaId === CREATE_COLOR_RGB) {
                inputDataColor = {
                    kind: 'rgb',
                    values: [
                        Number(node.data.inputData[2] ?? 126) / 255,
                        Number(node.data.inputData[3] ?? 126) / 255,
                        Number(node.data.inputData[4] ?? 126) / 255,
                    ],
                };
            } else if (node.data.schemaId === CREATE_COLOR_RGBA) {
                inputDataColor = {
                    kind: 'rgba',
                    values: [
                        Number(node.data.inputData[2] ?? 126) / 255,
                        Number(node.data.inputData[3] ?? 126) / 255,
                        Number(node.data.inputData[4] ?? 126) / 255,
                        Number(node.data.inputData[5] ?? 126) / 255,
                    ],
                };
            } else {
                throw new Error('Invalid schema id');
            }

            const width = Number(node.data.inputData[0] ?? 1);
            const height = Number(node.data.inputData[1] ?? 1);
            const ccId = newCreateColor(inputDataColor, width, height, node);
            nodesToRemove.add(node.id);
            // rewire image output edges
            changeEdgeIfExistsSource(
                { nodeId: node.id, outputId: 0 as OutputId },
                { nodeId: ccId, outputId: 0 as OutputId }
            );
            // rewire width and height edges
            changeEdgeIfExistsTarget(
                { nodeId: node.id, inputId: 0 as InputId },
                { nodeId: ccId, inputId: 1 as InputId }
            );
            changeEdgeIfExistsTarget(
                { nodeId: node.id, inputId: 1 as InputId },
                { nodeId: ccId, inputId: 2 as InputId }
            );

            // if the color channel inputs have edges, then we need to cerate a Color From node
            if (hasSomeEdgesToTargets(node.id, [2, 3, 4, 5])) {
                const cfId = newColorFrom(inputDataColor, node);

                newEdge(
                    { nodeId: cfId, outputId: 0 as OutputId },
                    { nodeId: ccId, inputId: 0 as InputId }
                );

                if (node.data.schemaId === CREATE_COLOR_GRAY) {
                    changeEdgeIfExistsTarget(
                        { nodeId: node.id, inputId: 2 as InputId },
                        { nodeId: cfId, inputId: 1 as InputId }
                    );
                } else {
                    // RGB or RGBA
                    changeEdgeIfExistsTarget(
                        { nodeId: node.id, inputId: 2 as InputId },
                        { nodeId: cfId, inputId: 2 as InputId }
                    );
                    changeEdgeIfExistsTarget(
                        { nodeId: node.id, inputId: 3 as InputId },
                        { nodeId: cfId, inputId: 3 as InputId }
                    );
                    changeEdgeIfExistsTarget(
                        { nodeId: node.id, inputId: 4 as InputId },
                        { nodeId: cfId, inputId: 4 as InputId }
                    );
                }

                if (
                    node.data.schemaId === CREATE_COLOR_RGBA &&
                    hasSomeEdgesToTargets(node.id, [5])
                ) {
                    // RGBA alpha
                    // This is a bit more involved because we need to convert from 0-255 to 0-100
                    const mathId = deriveUniqueId(`math/${node.id}`);
                    newNodes.push({
                        data: {
                            id: mathId,
                            schemaId: 'chainner:utility:math' as SchemaId,
                            inputData: {
                                0: 0,
                                1: 'div',
                                2: 2.55,
                            },
                        },
                        id: mathId,
                        position: { x: node.position.x - 540, y: node.position.y },
                        type: 'regularNode',
                        selected: false,
                        zIndex: node.zIndex,
                        parentNode: node.parentNode,
                    });
                    changeEdgeIfExistsTarget(
                        { nodeId: node.id, inputId: 5 as InputId },
                        { nodeId: mathId, inputId: 0 as InputId }
                    );
                    newEdge(
                        { nodeId: mathId, outputId: 0 as OutputId },
                        { nodeId: cfId, inputId: 5 as InputId }
                    );
                }
            }
        }
    });

    data.nodes.push(...newNodes);
    data.edges.push(...newEdges);
    data.nodes = data.nodes.filter((n) => !nodesToRemove.has(n.id));

    return data;
};

const emptyStringInput: ModernMigration = (data) => {
    const getKey = (schemaId: string, inputId: number | string) => `${schemaId}/${inputId}`;
    const allowEmptyString = new Set([
        getKey('chainner:utility:regex_replace', 2),
        getKey('chainner:utility:text_append', 0),
        getKey('chainner:utility:text_replace', 2),
        getKey('chainner:utility:text', 0),
    ]);
    const directories = new Set([
        getKey('chainner:image:save', 1),
        getKey('chainner:image:file_iterator', 0),
        getKey('chainner:image:paired_image_file_iterator', 0),
        getKey('chainner:image:paired_image_file_iterator', 1),
        getKey('chainner:image:simple_video_frame_iterator_save', 1),
        getKey('chainner:utility:directory', 0),
        getKey('chainner:pytorch:save_model', 1),
        getKey('chainner:pytorch:model_file_iterator', 0),
        getKey('chainner:ncnn:save_model', 1),
        getKey('chainner:ncnn:model_file_iterator', 0),
        getKey('chainner:onnx:save_model', 1),
        getKey('chainner:onnx:model_file_iterator', 0),
    ]);

    const targetHandles = new Set(data.edges.map((e) => e.targetHandle!));

    const newNodes: N[] = [];
    const newEdges: E[] = [];

    let emptyStringNodeId: string | undefined;

    data.nodes.forEach((node) => {
        for (const [inputId, inputValue] of Object.entries(node.data.inputData)) {
            const key = getKey(node.data.schemaId, inputId);
            if (inputValue === '' && directories.has(key)) {
                // due to an old bug, directory inputs may have stored the empty string in chains
                delete node.data.inputData[inputId];
            } else if (inputValue === '' && !allowEmptyString.has(key)) {
                delete node.data.inputData[inputId];

                if (targetHandles.has(`${node.id}-${inputId}`)) {
                    // this input has an edge, so we need to create an empty string node
                    // eslint-disable-next-line no-continue
                    continue;
                }

                if (emptyStringNodeId === undefined) {
                    emptyStringNodeId = deriveUniqueId('emptyString');
                    newNodes.push({
                        data: {
                            id: emptyStringNodeId,
                            schemaId: 'chainner:utility:text' as SchemaId,
                            inputData: { 0: '' },
                        },
                        id: emptyStringNodeId,
                        position: { x: node.position.x - 280, y: node.position.y - 20 },
                        type: 'regularNode',
                        selected: false,
                    });
                }

                newEdges.push({
                    id: deriveUniqueId(`${node.id}-${inputId}-${emptyStringNodeId}`),
                    source: emptyStringNodeId,
                    sourceHandle: `${emptyStringNodeId}-0`,
                    target: node.id,
                    targetHandle: `${node.id}-${inputId}`,
                    type: 'main',
                    animated: false,
                    data: {},
                });
            }
        }
    });
    data.nodes.push(...newNodes);
    data.edges.push(...newEdges);

    return data;
};

const surfaceBlurRadius: ModernMigration = (data) => {
    const toRadius = (diameter: number): number => {
        diameter = Math.round(diameter);
        if (diameter <= 0) return 0;
        if (diameter <= 3) return 1;
        // d = 2r+1
        const r = Math.ceil((diameter - 1) / 2);
        return Math.min(r, 100);
    };

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:bilateral_blur') {
            const diameter = node.data.inputData[1];
            if (typeof diameter === 'number') {
                node.data.inputData[1] = toRadius(diameter);
            }
        }
    });

    return data;
};

const saveImageWebPLossless: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:save') {
            const format = node.data.inputData[4];
            if (format === 'webp-lossless') {
                // image format (enum)
                node.data.inputData[4] = 'webp';
                // webp lossless (bool)
                node.data.inputData[14] = 1;
            }
        }
    });

    return data;
};

const unifiedCrop: ModernMigration = (data) => {
    const map = new Map<string, string>();
    const changeInputId = (nodeId: string, from: number, to: number) => {
        map.set(`${nodeId}-${from}`, `${nodeId}-${to}`);
    };

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:crop_border') {
            node.data.schemaId = 'chainner:image:crop' as SchemaId;
            node.data.inputData = {
                1: 0,
                2: node.data.inputData[1],
            };
            changeInputId(node.id, 1, 2);
        }

        if (node.data.schemaId === 'chainner:image:crop_edges') {
            node.data.schemaId = 'chainner:image:crop' as SchemaId;
            node.data.inputData = {
                1: 1,
                3: node.data.inputData[1],
                4: node.data.inputData[2],
                5: node.data.inputData[4],
                6: node.data.inputData[3],
            };
            changeInputId(node.id, 1, 3);
            changeInputId(node.id, 2, 4);
            changeInputId(node.id, 3, 6);
            changeInputId(node.id, 4, 5);
        }

        if (node.data.schemaId === 'chainner:image:crop_offsets') {
            node.data.schemaId = 'chainner:image:crop' as SchemaId;
            node.data.inputData = {
                1: 2,
                3: node.data.inputData[1],
                4: node.data.inputData[2],
                7: node.data.inputData[3],
                8: node.data.inputData[4],
            };
            changeInputId(node.id, 1, 3);
            changeInputId(node.id, 2, 4);
            changeInputId(node.id, 3, 7);
            changeInputId(node.id, 4, 8);
        }
    });

    data.edges.forEach((e) => {
        if (e.targetHandle) {
            e.targetHandle = map.get(e.targetHandle) ?? e.targetHandle;
        }
    });

    return data;
};

const writeOutputFrame: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:simple_video_frame_iterator_save') {
            const old = { ...node.data.inputData };
            // Video_preset, crf
            node.data.inputData[9] = old[4];
            node.data.inputData[10] = old[5];
            // Audio
            const copyAudio = Boolean(old[6]);
            // Writer, fps
            node.data.inputData[14] = old[7];
            node.data.inputData[15] = old[8];
            // Video type to encoder/container
            const mapping: Partial<
                Record<string, [string, string, string, string, string, string]>
            > = {
                mp4: ['libx264', 'mp4', 'mkv', 'mkv', 'webm', 'none'],
                avi: ['libx264', 'avi', 'mkv', 'mkv', 'webm', 'none'],
                mkv: ['libx264', 'mkv', 'mkv', 'mkv', 'webm', 'none'],
                'mkv-ffv1': ['ffv1', 'mkv', 'mkv', 'mkv', 'webm', 'none'],
                webm: ['libvpx-vp9', 'mkv', 'mkv', 'mkv', 'webm', 'none'],
                gif: ['none', 'mkv', 'mkv', 'mkv', 'webm', 'gif'],
                none: ['none', 'mkv', 'mkv', 'mkv', 'webm', 'none'],
            };
            const videoType = node.data.inputData[3];
            const [
                videoEncoder,
                h264Container,
                h265Container,
                ffv1Container,
                vp9Container,
                noneContainer,
            ] = mapping[videoType as string] ?? ['none', 'mkv', 'mkv', 'mkv', 'webm', 'none'];
            node.data.inputData[3] = videoEncoder;
            node.data.inputData[4] = h264Container;
            node.data.inputData[5] = h265Container;
            node.data.inputData[5] = ffv1Container;
            node.data.inputData[6] = vp9Container;
            node.data.inputData[7] = noneContainer;
            // Audio settings
            node.data.inputData[11] = 'none';
            node.data.inputData[12] = 'none';
            if (copyAudio) {
                node.data.inputData[11] = 'copy';
                node.data.inputData[12] = 'copy';
                if (vp9Container === 'webm' && videoEncoder === 'libvpx-vp9') {
                    node.data.inputData[12] = 'transcode';
                }
            }
            // Additional parameters
            node.data.inputData[13] = 0;
            node.data.inputData[14] = '';
        }
    });

    return data;
};

const separateNodeWidthAndInputHeight: ModernMigration = (data) => {
    const hasInputSize = (
        nodeData: Mutable<ReadonlyNodeData>
    ): nodeData is Mutable<ReadonlyNodeData> & {
        inputSize?: Record<InputId, Size>;
    } => 'inputSize' in nodeData;

    data.nodes.forEach((node) => {
        let maxWidth = 0;
        if (hasInputSize(node.data)) {
            const inputSize = node.data.inputSize!;
            delete node.data.inputSize;
            node.data.inputHeight ??= {};
            for (const [inputId, { width, height }] of Object.entries(inputSize)) {
                maxWidth = Math.max(maxWidth, width);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                node.data.inputHeight[inputId as InputId] = height;
            }
            node.data.nodeWidth = maxWidth;
        }
    });

    return data;
};

const oldToNewIterators: ModernMigration = (data) => {
    const newNodes: N[] = [];
    const newEdges: E[] = [];

    const nodesByParentNodes = new Map<string, N[]>();

    data.nodes.forEach((node) => {
        if (node.parentNode) {
            if (!nodesByParentNodes.has(node.parentNode)) {
                nodesByParentNodes.set(node.parentNode, []);
            }
            nodesByParentNodes.get(node.parentNode)?.push(node);
        }
    });

    const nodesToDelete = new Set<string>();

    const standardIteratorMigration = (node: N, helperSchemaId: string, newSchemaId: string) => {
        const subNodes = nodesByParentNodes.get(node.id);
        const helper = subNodes?.find((n) => n.data.schemaId === helperSchemaId);

        const iteratorInputs = node.data.inputData;
        const iteratorEdges = data.edges.filter((e) => e.source === node.id);
        const helperEdges = data.edges.filter((e) => e.source === helper?.id);

        // Create the new iterator node
        const newIterator: N = {
            data: {
                ...node.data,
                id: node.id,
                schemaId: newSchemaId as SchemaId,
                inputData: { ...iteratorInputs },
            },
            id: node.id,
            position: node.position,
            type: 'newIterator',
            selected: false,
        };

        newNodes.push(newIterator);

        // Fix positions
        subNodes?.forEach((n) => {
            n.position.x += node.position.x;
            n.position.y += node.position.y;
        });

        // Attach all edges to correct new spots
        iteratorEdges.forEach((e) => {
            e.sourceHandle = e.sourceHandle?.replace(e.source, newIterator.id);
            e.source = newIterator.id;
        });
        helperEdges.forEach((e) => {
            e.sourceHandle = e.sourceHandle?.replace(e.source, newIterator.id);
            e.source = newIterator.id;
        });

        nodesToDelete.add(node.id);
        if (helper?.id) nodesToDelete.add(helper.id);
    };

    data.nodes.forEach((node) => {
        switch (node.data.schemaId) {
            case 'chainner:image:file_iterator': {
                standardIteratorMigration(
                    node,
                    'chainner:image:file_iterator_load',
                    'chainner:image:load_images'
                );
                break;
            }
            case 'chainner:image:paired_image_file_iterator': {
                standardIteratorMigration(
                    node,
                    'chainner:image:paired_file_iterator_load',
                    'chainner:image:load_image_pairs'
                );
                break;
            }
            case 'chainner:pytorch:model_file_iterator': {
                standardIteratorMigration(
                    node,
                    'chainner:pytorch:model_iterator_load',
                    'chainner:pytorch:load_models'
                );
                break;
            }
            case 'chainner:ncnn:model_file_iterator': {
                standardIteratorMigration(
                    node,
                    'chainner:ncnn:model_iterator_load',
                    'chainner:ncnn:load_models'
                );
                break;
            }
            case 'chainner:onnx:model_file_iterator': {
                standardIteratorMigration(
                    node,
                    'chainner:onnx:model_iterator_load',
                    'chainner:onnx:load_models'
                );
                break;
            }
            case 'chainner:image:spritesheet_iterator': {
                standardIteratorMigration(
                    node,
                    'chainner:image:spritesheet_iterator_load',
                    'chainner:image:split_spritesheet'
                );

                const subNodes = nodesByParentNodes.get(node.id);
                const appendHelper = subNodes?.find(
                    (n) => n.data.schemaId === 'chainner:image:spritesheet_iterator_save'
                );

                if (appendHelper) {
                    const appendHelperInputs = appendHelper.data.inputData;

                    const newCollector: N = {
                        data: {
                            ...node.data,
                            id: appendHelper.id,
                            schemaId: 'chainner:image:merge_spritesheet' as SchemaId,
                            inputData: { ...appendHelperInputs },
                        },
                        id: appendHelper.id,
                        position: {
                            x: appendHelper.position.x,
                            y: appendHelper.position.y,
                        },
                        type: 'collector',
                        selected: false,
                    };

                    newNodes.push(newCollector);
                    nodesToDelete.add(appendHelper.id);

                    // Copy the rows and columns from the iterator to the collector
                    newCollector.data.inputData[1] = node.data.inputData[1];
                    newCollector.data.inputData[2] = node.data.inputData[2];
                }

                break;
            }
            case 'chainner:image:video_frame_iterator': {
                const subNodes = nodesByParentNodes.get(node.id);
                const loadHelper = subNodes?.find(
                    (n) => n.data.schemaId === 'chainner:image:simple_video_frame_iterator_load'
                );
                const saveHelper = subNodes?.find(
                    (n) => n.data.schemaId === 'chainner:image:simple_video_frame_iterator_save'
                );

                const iteratorInputs = node.data.inputData;
                const iteratorEdges = data.edges.filter((e) => e.source === node.id);
                const loadHelperEdges = data.edges.filter((e) => e.source === loadHelper?.id);
                const saveHelperEdges = data.edges.filter((e) => e.target === saveHelper?.id);

                // Create the new iterator node
                const newIterator: N = {
                    data: {
                        ...node.data,
                        id: node.id,
                        schemaId: 'chainner:image:load_video' as SchemaId,
                        inputData: { ...iteratorInputs },
                    },
                    id: node.id,
                    position: node.position,
                    type: 'newIterator',
                    selected: false,
                };

                newNodes.push(newIterator);

                // Fix positions
                subNodes?.forEach((n) => {
                    n.position.x += node.position.x;
                    n.position.y += node.position.y;
                });

                // Attach all edges to correct new spots
                iteratorEdges.forEach((e) => {
                    e.sourceHandle = e.sourceHandle?.replace(e.source, newIterator.id);
                    e.source = newIterator.id;
                });
                loadHelperEdges.forEach((e) => {
                    e.sourceHandle = e.sourceHandle?.replace(e.source, newIterator.id);
                    e.source = newIterator.id;
                });

                if (saveHelper) {
                    const isSetToNone =
                        String(saveHelper.data.inputData[3]).toLowerCase() === 'none';
                    if (!isSetToNone) {
                        const newSaveInputData = { ...saveHelper.data.inputData };

                        newSaveInputData[8] = saveHelper.data.inputData[9];
                        newSaveInputData[9] = saveHelper.data.inputData[10];
                        newSaveInputData[10] = saveHelper.data.inputData[11];
                        newSaveInputData[11] = saveHelper.data.inputData[12];
                        newSaveInputData[12] = saveHelper.data.inputData[13];
                        newSaveInputData[13] = saveHelper.data.inputData[14];

                        const newCollector: N = {
                            data: {
                                ...node.data,
                                id: saveHelper.id,
                                schemaId: 'chainner:image:save_video' as SchemaId,
                                inputData: newSaveInputData,
                            },
                            id: saveHelper.id,
                            position: {
                                x: saveHelper.position.x,
                                y: saveHelper.position.y,
                            },
                            type: 'collector',
                            selected: false,
                        };

                        newNodes.push(newCollector);
                        nodesToDelete.add(saveHelper.id);

                        saveHelperEdges.forEach((e) => {
                            e.targetHandle = e.targetHandle?.replace(e.target, newCollector.id);
                            e.target = newCollector.id;
                        });

                        // Connect FPS and audio
                        const fpsEdge = {
                            id: deriveUniqueId(`${saveHelper.id}-fps`),
                            source: newIterator.id,
                            sourceHandle: `${newIterator.id}-4`,
                            target: saveHelper.id,
                            targetHandle: `${saveHelper.id}-14`,
                            type: 'main',
                            animated: false,
                            data: {},
                        };
                        newEdges.push(fpsEdge);

                        if (
                            !(
                                newSaveInputData[10] === 'none' ||
                                (String(newSaveInputData[3]).toLowerCase() === 'libvpx-vp9' &&
                                    String(newSaveInputData[7]).toLowerCase() === 'webm' &&
                                    newSaveInputData[11] === 'none')
                            )
                        ) {
                            const audioEdge = {
                                id: deriveUniqueId(`${saveHelper.id}-audio`),
                                source: newIterator.id,
                                sourceHandle: `${newIterator.id}-5`,
                                target: saveHelper.id,
                                targetHandle: `${saveHelper.id}-15`,
                                type: 'main',
                                animated: false,
                                data: {},
                            };
                            newEdges.push(audioEdge);
                        }
                    }
                }

                nodesToDelete.add(node.id);
                if (loadHelper?.id) nodesToDelete.add(loadHelper.id);
                if (saveHelper?.id) nodesToDelete.add(saveHelper.id);

                break;
            }
            default:
                break;
        }
    });

    data.nodes = data.nodes
        .filter((n) => !nodesToDelete.has(n.id))
        .filter((n) => n.type !== 'iterator' && n.type !== 'iteratorHelper');
    data.nodes.push(...newNodes);
    data.edges.push(...newEdges);

    // Remove all parentNode attributes
    data.nodes = data.nodes.map((node) => {
        const newNode = { ...node };
        if (newNode.parentNode) {
            delete newNode.parentNode;
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (newNode.data.parentNode) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            delete newNode.data.parentNode;
        }
        return newNode;
    });

    return data;
};

const removeZIndexes: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.zIndex) {
            delete node.zIndex;
        }
    });

    data.edges.forEach((edge) => {
        if (edge.zIndex) {
            delete edge.zIndex;
        }
    });

    return data;
};

const createBorderEdgesTileFillToPad: ModernMigration = (data) => {
    interface EdgeMapping {
        nodeId: string;
        from: InputId | number;
        to: InputId | number;
    }
    const edgeChanges: EdgeMapping[] = [];

    const BORDER = 0;
    const EDGES = 1;
    const OFFSETS = 2;

    data.nodes.forEach((node) => {
        if (node.data.schemaId === ('chainner:image:create_border' as SchemaId)) {
            edgeChanges.push(
                { nodeId: node.id, from: 3, to: 2 }, // color
                { nodeId: node.id, from: 2, to: 4 } // amount
            );

            const oldData = node.data.inputData;
            const newData: Record<number | InputId, InputValue> = {
                1: oldData[1],
                2: oldData[3],
                3: BORDER,
                4: oldData[2],
            };
            node.data.inputData = newData as InputData;
            node.data.schemaId = 'chainner:image:pad' as SchemaId;
        }

        if (node.data.schemaId === ('chainner:image:create_edges' as SchemaId)) {
            edgeChanges.push(
                { nodeId: node.id, from: 6, to: 2 }, // color
                { nodeId: node.id, from: 2, to: 6 }, // top
                { nodeId: node.id, from: 3, to: 5 }, // left
                { nodeId: node.id, from: 4, to: 7 }, // right
                { nodeId: node.id, from: 5, to: 8 } // bottom
            );

            const oldData = node.data.inputData;
            const newData: Record<number | InputId, InputValue> = {
                1: oldData[1],
                2: oldData[6],
                3: EDGES,
                6: oldData[2],
                5: oldData[3],
                7: oldData[4],
                8: oldData[5],
            };
            node.data.inputData = newData as InputData;
            node.data.schemaId = 'chainner:image:pad' as SchemaId;
        }

        if (node.data.schemaId === ('chainner:image:tile_fill' as SchemaId)) {
            edgeChanges.push(
                { nodeId: node.id, from: 1, to: 9 }, // width
                { nodeId: node.id, from: 2, to: 10 } // height
            );

            const tileMode = node.data.inputData[3] ?? 0;

            const oldData = node.data.inputData;
            const newData: Record<number | InputId, InputValue> = {
                // eslint-disable-next-line eqeqeq
                1: tileMode == 0 ? 3 : 4,
                3: OFFSETS,
                5: 0,
                6: 0,
                9: oldData[1],
                10: oldData[2],
            };
            node.data.inputData = newData as InputData;
            node.data.schemaId = 'chainner:image:pad' as SchemaId;
        }
    });

    const byNode = new Map<string, EdgeMapping[]>();
    for (const mapping of edgeChanges) {
        if (!byNode.has(mapping.nodeId)) {
            byNode.set(mapping.nodeId, []);
        }
        byNode.get(mapping.nodeId)?.push(mapping);
    }

    data.edges.forEach((edge) => {
        const mappings = byNode.get(edge.target) ?? [];
        for (const mapping of mappings) {
            const nodeId = mapping.nodeId;
            const from = mapping.from as InputId;
            const to = mapping.to as InputId;

            if (edge.targetHandle === stringifyTargetHandle({ nodeId, inputId: from })) {
                edge.targetHandle = stringifyTargetHandle({ nodeId, inputId: to });
                break;
            }
        }
    });

    return data;
};

const unifiedResizeNode: ModernMigration = (data) => {
    interface EdgeMapping {
        nodeId: string;
        from: InputId | number;
        to: InputId | number;
    }
    const edgeChanges: EdgeMapping[] = [];

    const PERCENTAGE = 0;
    const ABSOLUTE = 1;

    data.nodes.forEach((node) => {
        if (node.data.schemaId === ('chainner:image:resize_resolution' as SchemaId)) {
            edgeChanges.push(
                { nodeId: node.id, from: 1, to: 3 }, // width
                { nodeId: node.id, from: 2, to: 4 }, // height
                { nodeId: node.id, from: 3, to: 5 } // interpolation
            );

            const oldData = node.data.inputData;
            const newData: Record<number | InputId, InputValue> = {
                1: ABSOLUTE,
                3: oldData[1],
                4: oldData[2],
                5: oldData[3],
            };
            node.data.inputData = newData as InputData;
            node.data.schemaId = 'chainner:image:resize' as SchemaId;
        }

        if (node.data.schemaId === ('chainner:image:resize_factor' as SchemaId)) {
            edgeChanges.push(
                { nodeId: node.id, from: 1, to: 2 }, // scale
                { nodeId: node.id, from: 2, to: 5 } // interpolation
            );

            const oldData = node.data.inputData;
            const newData: Record<number | InputId, InputValue> = {
                1: PERCENTAGE,
                2: oldData[1],
                5: oldData[2],
            };
            node.data.inputData = newData as InputData;
            node.data.schemaId = 'chainner:image:resize' as SchemaId;
        }
    });

    const byNode = new Map<string, EdgeMapping[]>();
    for (const mapping of edgeChanges) {
        if (!byNode.has(mapping.nodeId)) {
            byNode.set(mapping.nodeId, []);
        }
        byNode.get(mapping.nodeId)?.push(mapping);
    }

    data.edges.forEach((edge) => {
        const mappings = byNode.get(edge.target) ?? [];
        for (const mapping of mappings) {
            const nodeId = mapping.nodeId;
            const from = mapping.from as InputId;
            const to = mapping.to as InputId;

            if (edge.targetHandle === stringifyTargetHandle({ nodeId, inputId: from })) {
                edge.targetHandle = stringifyTargetHandle({ nodeId, inputId: to });
                break;
            }
        }
    });

    return data;
};

const saveVideoInputPR2514: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:save_video') {
            const oldData = node.data.inputData;

            const encoder = oldData[3];
            const formatH264 = oldData[4];
            const formatH265 = oldData[5];
            const formatFFV1 = oldData[6];
            const formatVP9 = oldData[7];
            const formatMap: Record<string, InputValue> = {
                libx264: formatH264,
                libx265: formatH265,
                ffv1: formatFFV1,
                'libvpx-vp9': formatVP9,
            };
            const format = formatMap[encoder ?? 'libx264'];

            const oldAudioSettings = oldData[10];
            const oldReducedAudioSettings = oldData[11];
            const audioSettings = format === 'webm' ? oldReducedAudioSettings : oldAudioSettings;

            const newData = {
                // Image Sequence, Directory, Video Name
                0: oldData[0],
                1: oldData[1],
                2: oldData[2],
                // Video Format, Encoder
                4: format,
                3: encoder,
                // VideoPreset, Quality (CRF), Additional parameters, FPS
                8: oldData[8],
                9: oldData[9],
                12: oldData[12],
                13: oldData[13],
                14: oldData[14],
                // Audio
                15: oldData[15],
                10: audioSettings,
            };

            node.data.inputData = newData;
        }
    });

    return data;
};

const normalMapGeneratorInvert: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:normal_generator') {
            const inputData = node.data.inputData;

            const invert = Number(inputData[6] ?? 0);
            delete inputData[6];

            // eslint-disable-next-line no-bitwise
            const invertR = (invert & 1) !== 0;
            // eslint-disable-next-line no-bitwise
            const invertG = (invert & 2) !== 0;

            inputData[17] = Number(invertR);
            inputData[18] = Number(invertG);
        }
    });

    return data;
};

const saveVideoInputPatchMigration: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:save_video') {
            const oldData = node.data.inputData;

            if (oldData[10] === 'none') {
                oldData[10] = 'auto';
            }

            node.data.inputData = oldData;
        }
    });

    return data;
};

const saveVideoAdvancedModeMigration: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:save_video') {
            node.data.inputData[16] = 1;
        }
    });

    return data;
};

const newIteratorToGenerator: ModernMigration = (data) => {
    data.nodes.forEach((node) => {
        if (node.type === 'newIterator') {
            node.type = 'generator';
        }
    });

    return data;
};

const splitLoadImagePairs: ModernMigration = (data) => {
    const newNodes: Node<NodeData>[] = [];
    const newEdges: Edge<EdgeData>[] = [];
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:load_image_pairs') {
            const nodeAId = deriveUniqueId(`${node.id}A`);
            const nodeAData = {
                0: node.data.inputData[0],
                1: false,
                2: true,
                3: '**/*',
                4: node.data.inputData[2],
                5: node.data.inputData[3],
                6: node.data.inputData[4],
            };
            const nodeA: Node<NodeData> = {
                ...node,
                id: nodeAId,
                position: {
                    x: node.position.x,
                    y: node.position.y - 250,
                },
                data: {
                    ...node.data,
                    id: nodeAId,
                    schemaId: 'chainner:image:load_images' as SchemaId,
                    inputData: nodeAData,
                    nodeName: `${node.data.nodeName ?? 'Load Images'} A`,
                },
            };

            const nodeBId = deriveUniqueId(`${node.id}B`);
            const nodeBData = {
                0: node.data.inputData[1],
                1: false,
                2: true,
                3: '**/*',
                4: node.data.inputData[2],
                5: node.data.inputData[3],
                6: node.data.inputData[4],
            };
            const nodeB: Node<NodeData> = {
                ...node,
                id: nodeBId,
                position: {
                    x: node.position.x,
                    y: node.position.y + 250,
                },
                data: {
                    ...node.data,
                    id: nodeBId,
                    schemaId: 'chainner:image:load_images' as SchemaId,
                    inputData: nodeBData,
                    nodeName: `${node.data.nodeName ?? 'Load Images'} B`,
                },
            };
            newNodes.push(nodeA, nodeB);

            const sourceEdges = data.edges.filter((e) => e.source === node.id);
            for (const edge of sourceEdges) {
                if (edge.sourceHandle) {
                    const parsed = parseSourceHandle(edge.sourceHandle);
                    if ([0, 2, 4, 6].includes(parsed.outputId)) {
                        edge.source = nodeAId;
                        edge.sourceHandle = `${nodeAId}-${parsed.outputId / 2}`;
                    } else if ([1, 3, 5, 7].includes(parsed.outputId)) {
                        edge.source = nodeBId;
                        edge.sourceHandle = `${nodeBId}-${(parsed.outputId - 1) / 2}`;
                    } else if (parsed.outputId === 8) {
                        edge.source = nodeAId;
                        edge.sourceHandle = `${nodeAId}-${4}`;
                        const newEdge = {
                            ...edge,
                            id: deriveUniqueId(edge.id),
                            source: nodeBId,
                            sourceHandle: `${nodeBId}-${4}`,
                        };
                        newEdges.push(newEdge);
                    }
                }
            }
            const targetEdges = data.edges.filter((e) => e.target === node.id);
            for (const edge of targetEdges) {
                if (edge.targetHandle) {
                    const parsed = parseTargetHandle(edge.targetHandle);
                    if (parsed.inputId === 0) {
                        edge.target = nodeAId;
                        edge.targetHandle = `${nodeAId}-${0}`;
                    } else if (parsed.inputId === 1) {
                        edge.target = nodeBId;
                        edge.targetHandle = `${nodeBId}-${0}`;
                    } else if (parsed.inputId === 3) {
                        edge.target = nodeAId;
                        edge.targetHandle = `${nodeAId}-${5}`;
                        const newEdge = {
                            ...edge,
                            id: deriveUniqueId(edge.id),
                            target: nodeBId,
                            targetHandle: `${nodeBId}-${5}`,
                        };
                        newEdges.push(newEdge);
                    }
                }
            }
        }
    });

    data.nodes = data.nodes
        .filter((n) => n.data.schemaId !== 'chainner:image:load_image_pairs')
        .concat(newNodes);
    data.edges = data.edges.concat(newEdges);
    return data;
};

// ==============

const versionToMigration = (version: string) => {
    const versions = {
        '0.1.0': 0, // Legacy files
        '0.3.0': 1, // v0.1.x & v0.2.x to v0.3.0
        '0.5.0': 2, // v0.3.x & v0.4.x to v0.5.0
        '0.5.2': 3, // v0.5.0 & v0.5.1 to v0.5.2
        '0.7.0': 4,
        '0.8.0': 5,
    };

    for (const [ver, migration] of Object.entries(versions)) {
        if (semver.lt(version, ver)) {
            return migration;
        }
    }
    return 6;
};

const migrations = [
    ...legacyMigrations,
    toV080,
    updateAdjustmentScale,
    fixBlurNode,
    addBlendNode,
    updateRotateNode,
    addOpacityNode,
    fixDropDownNumberValues,
    onnxConvertUpdate,
    removeEmptyStrings,
    blockSizeToRadius,
    removeTargetTileSize,
    addTargetTileSizeAgain,
    brightnessImplementationChange,
    convertColorSpaceFromTo,
    convertColorRGBLikeDetector,
    convertNormalGenerator,
    convertColorSpaceFromDetectors,
    fixNumbers,
    clearEdgeData,
    gammaCheckbox,
    changeColorSpaceAlpha,
    deriveSeed,
    seedInput,
    createColor,
    emptyStringInput,
    surfaceBlurRadius,
    saveImageWebPLossless,
    unifiedCrop,
    writeOutputFrame,
    separateNodeWidthAndInputHeight,
    oldToNewIterators,
    removeZIndexes,
    createBorderEdgesTileFillToPad,
    unifiedResizeNode,
    saveVideoInputPR2514,
    normalMapGeneratorInvert,
    saveVideoInputPatchMigration,
    saveVideoAdvancedModeMigration,
    newIteratorToGenerator,
    splitLoadImagePairs,
];

export const currentMigration = migrations.length;

export const migrate = (
    version: string | null,
    data: unknown,
    migration?: number,
    schemas?: readonly NodeSchema[]
) => {
    version ||= '0.0.0';
    migration ??= versionToMigration(version);

    try {
        // Apply legacy migrations first
        const migratedData = migrations.slice(migration).reduce((current, fn) => fn(current as never), data);
        
        // If schemas are available, apply per-node migrations
        if (schemas && schemas.length > 0) {
            // Import dynamically to avoid circular dependencies
            const { applyPerNodeMigrations } = require('./migrations/apply-per-node');
            return applyPerNodeMigrations(migratedData as SaveData, schemas);
        }
        
        return migratedData;
    } catch (error) {
        log.error(error);
        throw error;
    }
};
