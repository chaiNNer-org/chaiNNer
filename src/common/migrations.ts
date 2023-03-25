/* eslint-disable prefer-destructuring */
/* eslint-disable no-param-reassign */

import log from 'electron-log';
import { Edge, Node, Viewport, getConnectedEdges, getOutgoers } from 'reactflow';
import semver from 'semver';
import { EdgeData, InputValue, Mutable, NodeData, SchemaId } from './common-types';
import { legacyMigrations } from './migrations-legacy';
import { deriveUniqueId, parseTargetHandle } from './util';

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
];

export const currentMigration = migrations.length;

export const migrate = (version: string | null, data: unknown, migration?: number) => {
    version ||= '0.0.0';
    migration ??= versionToMigration(version);

    try {
        return migrations.slice(migration).reduce((current, fn) => fn(current as never), data);
    } catch (error) {
        log.error(error);
        throw error;
    }
};
