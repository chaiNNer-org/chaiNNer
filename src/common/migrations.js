/* eslint-disable prefer-destructuring */
/* eslint-disable no-param-reassign */
/* eslint-disable import/prefer-default-export */
import log from 'electron-log';
import { getConnectedEdges, getOutgoers, isEdge, isNode } from 'reactflow';
import semver from 'semver';
import { deriveUniqueId, parseTargetHandle } from './util';

// ==============
//   pre-alpha
// ==============

const preAlpha = (data) => {
    const newData = { ...data };
    const newElements = newData.elements.map((element) => {
        const newElement = { ...element };
        if (newElement.type === 'ESRGAN::Load') {
            newElement.type = 'Model::AutoLoad';
            newElement.data.type = 'Model::AutoLoad';
        } else if (newElement.type === 'ESRGAN::Run') {
            newElement.type = 'Image::Upscale';
            newElement.data.type = 'Image::Upscale';
        }
        return newElement;
    });
    newData.elements = newElements;
    return newData;
};

// ==============
//    v0.3.0
// ==============

const v03TypeMap = {
    'Adjust::Blur': ['Image (Effect)', 'Blur'],
    'Adjust::Brightness': ['Image (Effect)', 'Brightness & Contrast'],
    'Adjust::Contrast': ['Image (Effect)', 'Brightness & Contrast'],
    'Adjust::Shift': ['Image (Effect)', 'Shift'],
    'Border::Make': ['Image (Utility)', 'Create Border'],
    'Color::Convert': ['Image (Utility)', 'Change Colorspace'],
    'Concat::Horizontal': ['Image (Utility)', 'Stack Images'],
    'Concat::Vertical': ['Image (Utility)', 'Stack Images'],
    'Image::Read': ['Image', 'Load Image'],
    'Image::Show': ['Image', 'Preview Image'],
    'Image::Write': ['Image', 'Save Image'],
    'Resize::Factor': ['Image (Utility)', 'Resize (Factor)'],
    'Resize::Resolution': ['Image (Utility)', 'Resize (Resolution)'],
    'Threshold::Adaptive': ['Image (Effect)', 'Threshold (Adaptive)'],
    'Threshold::Standard': ['Image (Effect)', 'Threshold'],
    'Crop::Border': ['Image (Utility)', 'Crop (Border)'],
    'Crop::Offsets': ['Image (Utility)', 'Crop (Offsets)'],
    'Img::Channel::Merge': ['Image (Utility)', 'Merge Channels'],
    'Img::Channel::Split': ['Image (Utility)', 'Split Channels'],
    'Image::Upscale': ['PyTorch', 'Upscale Image'],
    'Model::AutoLoad': ['PyTorch', 'Load Model'],
    'Model::Interpolate': ['PyTorch', 'Interpolate Models'],
    'Model::Read': ['PyTorch', 'Load Model'],
    'Model::Save': ['PyTorch', 'Save Model'],
};

const toV03 = (data) => {
    const newData = { ...data };
    let newElements = [...newData.elements];
    newElements.forEach((element) => {
        if (isNode(element)) {
            if (['Model::Read', 'Model::Interpolate'].includes(element.data.type)) {
                // Find any connections coming out of a Model::Read
                const edges = newData.elements.filter((e) => e.source === element.id);
                if (edges) {
                    edges.forEach((edge) => {
                        // Find the targets of each connection
                        const target = newElements.find((n) => n.id === edge.target);
                        if (target.data.type === 'Model::AutoLoad') {
                            // If target is an AutoLoad node, get the outgoing connections of it
                            const targetEdges = newElements.filter((e) => e.source === target.id);
                            // For each of the outgoing connections, replace the source with the output of the
                            // new Load Model node
                            targetEdges.forEach((targetEdge) => {
                                targetEdge.source = element.id;
                                targetEdge.sourceHandle = `${element.id}-0`;
                            });
                        }
                    });
                }
            }
        }
    });
    newElements = newElements
        .filter((element) => !['Model::AutoLoad'].includes(element.data.type))
        .map((element) => {
            if (isNode(element)) {
                const newElement = { ...element };
                newElement.type = 'regularNode';
                delete newElement.data.inputs;
                delete newElement.data.outputs;
                // Nobody should have these two things but me
                delete newElement.data.icon;
                delete newElement.data.subcategory;
                // Move the contrast data to a B&C node at the right index
                if (newElement.data.type === 'Adjust::Contrast') {
                    newElement.data.inputData[1] = newElement.data.inputData[0];
                    delete newElement.data.inputData[0];
                } else if (newElement.data.type.includes('Concat')) {
                    const newInputData = {};
                    newInputData[4] =
                        newElement.data.type === 'Concat::Horizontal' ? 'horizontal' : 'vertical';
                    newElement.data.inputData = newInputData;
                }
                try {
                    const [newCategory, newType] = v03TypeMap[newElement.data.type];
                    newElement.data.type = newType;
                    newElement.data.category = newCategory;
                } catch (error) {
                    log.warn(
                        `File contains invalid node of type "${newElement.data.type}" that could not be converted.`
                    );
                }
                return newElement;
            }
            return element;
        });
    newData.elements = newElements;
    return newData;
};

// ==============
//    v0.5.0
// ==============

const toV05 = (data) => {
    const nodes = data.elements.filter((e) => isNode(e));
    const edges = data.elements
        .filter((e) => isEdge(e))
        .map((e) => {
            const newEdge = { ...e };
            delete newEdge.style;
            newEdge.data = {};
            return newEdge;
        });
    const viewport = {
        x: data.position[0],
        y: data.position[1],
        zoom: data.zoom,
    };
    const newData = {
        nodes,
        edges,
        viewport,
    };
    return newData;
};

// ==============
//    v0.5.2
// ==============

const toV052 = (data) => {
    const newData = { ...data };
    newData.nodes.forEach((node) => {
        // Update any connections coming out of a Load Image or Load Image (Iterator)
        if (['Load Image', 'Load Image (Iterator)'].includes(node.data.type)) {
            const edges = newData.edges.filter((e) => e.source === node.id);
            edges.forEach((edge) => {
                const edgeIndex = edge.sourceHandle.slice(-2);
                // Image Name node moves different amounts in different Load Image types
                const newEdgeIndex = node.data.type === 'Load Image' ? '2' : '3';
                if (edgeIndex === '-1') {
                    edge.sourceHandle = edge.source.concat('-', newEdgeIndex);
                }
            });
        }

        // Update any connections and inputs to Save Image Node
        if (node.data.type === 'Save Image') {
            // Shift text input values >=2 down one place and set Relative Path to empty string
            node.data.inputData[4] = node.data.inputData[3];
            node.data.inputData[3] = node.data.inputData[2];
            node.data.inputData[2] = '';
            // Move Image Name connection if it exists
            const edges = newData.edges.filter((e) => e.target === node.id);
            edges.forEach((edge) => {
                const edgeIndex = edge.targetHandle.slice(-2);
                if (edgeIndex === '-2') {
                    edge.targetHandle = edge.target.concat('-', '3');
                }
            });
        }
    });
    return newData;
};

// ==============
//    v0.7.0
// ==============

const v07TypeMap = {
    'Image:Load Image': 'chainner:image:load',
    'Image:Read Image': 'chainner:image:load', // For some reason some of my chains have this...
    'Image:Save Image': 'chainner:image:save',
    'Image:Preview Image': 'chainner:image:preview',
    'Image:Image File Iterator': 'chainner:image:file_iterator',
    'Image:Load Image (Iterator)': 'chainner:image:file_iterator_load',
    'Image (Utility):Add Caption': 'chainner:image:caption',
    'Image (Utility):Average Color Fix': 'chainner:image:average_color_fix',
    'Image (Utility):Change Colorspace': 'chainner:image:change_colorspace',
    'Image (Utility):Color Transfer': 'chainner:image:color_transfer',
    'Image (Utility):Create Border': 'chainner:image:create_border',
    'Image (Utility):Fill Alpha': 'chainner:image:fill_alpha',
    'Image (Utility):Overlay Images': 'chainner:image:overlay',
    'Image (Utility):Stack Images': 'chainner:image:stack',
    'Image (Utility):Add Normals': 'chainner:image:add_normals',
    'Image (Utility):Normalize': 'chainner:image:normalize_normal_map',
    'Image (Utility):Crop (Border)': 'chainner:image:crop_border',
    'Image (Utility):Crop (Edges)': 'chainner:image:crop_edges',
    'Image (Utility):Crop (Offsets)': 'chainner:image:crop_offsets',
    'Image (Utility):Resize (Factor)': 'chainner:image:resize_factor',
    'Image (Utility):Resize (Resolution)': 'chainner:image:resize_resolution',
    'Image (Utility):Merge Channels': 'chainner:image:merge_channels',
    'Image (Utility):Merge Transparency': 'chainner:image:merge_transparency',
    'Image (Utility):Split Channels': 'chainner:image:split_channels',
    'Image (Utility):Split Transparency': 'chainner:image:split_transparency',
    'Image (Effect):Blur': 'chainner:image:blur',
    'Image (Effect):Brightness & Contrast': 'chainner:image:brightness_and_contrast',
    'Image (Effect):Gaussian Blur': 'chainner:image:gaussian_blur',
    'Image (Effect):Hue & Saturation': 'chainner:image:hue_and_saturation',
    'Image (Effect):Sharpen': 'chainner:image:sharpen',
    'Image (Effect):Shift': 'chainner:image:shift',
    'Image (Effect):Threshold': 'chainner:image:threshold',
    'Image (Effect):Threshold (Adaptive)': 'chainner:image:threshold_adaptive',
    'PyTorch:Load Model': 'chainner:pytorch:load_model',
    'PyTorch:Save Model': 'chainner:pytorch:save_model',
    'PyTorch:Upscale Image': 'chainner:pytorch:upscale_image',
    'PyTorch:Convert To ONNX': 'chainner:pytorch:convert_to_onnx',
    'PyTorch:Interpolate Models': 'chainner:pytorch:interpolate_models',
    'NCNN:Load Model': 'chainner:ncnn:load_model',
    'NCNN:Save Model': 'chainner:ncnn:save_model',
    'NCNN:Upscale Image': 'chainner:ncnn:upscale_image',
    'NCNN:Interpolate Models': 'chainner:ncnn:interpolate_models',
    'Utility:Note': 'chainner:utility:note',
    'Utility:Text Append': 'chainner:utility:text_append',
};

const toV070 = (data) => {
    data.nodes.forEach((node) => {
        const oldType = `${node.data.category}:${node.data.type}`;
        const newType = v07TypeMap[oldType];
        if (newType) {
            node.data.schemaId = newType;
            delete node.data.category;
            delete node.data.type;
            delete node.data.icon;
            delete node.data.subcategory;
        }
    });
    return data;
};

const toV080 = (data) => {
    data.nodes.forEach((node) => {
        // Convert Resize (Factor) and Average Color Fix to percentage
        if (node.data.schemaId === 'chainner:image:resize_factor') {
            node.data.inputData['1'] *= 100.0;
        }
        if (node.data.schemaId === 'chainner:image:average_color_fix') {
            node.data.inputData['2'] *= 100.0;
        }
        // Invert interpolation weight
        if (
            ['chainner:pytorch:interpolate_models', 'chainner:ncnn:interpolate_models'].includes(
                node.data.schemaId
            )
        ) {
            node.data.inputData['2'] = 100 - node.data.inputData['2'];
        }
    });
    return data;
};

const updateAdjustmentScale = (data) => {
    data.nodes.forEach((node) => {
        // Convert slider scales for several Adjustment nodes
        if (node.data.schemaId === 'chainner:image:hue_and_saturation') {
            node.data.inputData['2'] = ((node.data.inputData['2'] / 255) * 100.0).toFixed(1);
        }
        if (node.data.schemaId === 'chainner:image:brightness_and_contrast') {
            node.data.inputData['1'] = ((node.data.inputData['1'] / 255) * 100.0).toFixed(1);
            node.data.inputData['2'] = ((node.data.inputData['2'] / 255) * 100.0).toFixed(1);
        }
    });
    return data;
};

const fixBlurNode = (data) => {
    data.nodes.forEach((node) => {
        // Convert Blur Nodes to Gaussian Blur nodes
        if (node.data.schemaId === 'chainner:image:blur') {
            node.data.schemaId = 'chainner:image:gaussian_blur';
            node.data.inputData['1'] =
                Math.round((1.16531 * node.data.inputData['1'] - 0.153601) * 10) / 10;
            node.data.inputData['2'] =
                Math.round((1.16531 * node.data.inputData['2'] - 0.153601) * 10) / 10;
        }
    });
    return data;
};

const addBlendNode = (data) => {
    data.nodes.forEach((node) => {
        // Convert Difference Nodes to Blend Image Nodes
        if (node.data.schemaId === 'chainner:image:difference') {
            node.data.schemaId = 'chainner:image:blend';
            node.data.inputData['2'] = 100;
            node.data.inputData['3'] = 100;
            node.data.inputData['4'] = 10;
        }

        // Convert Overlay Images Nodes to Blend Image Nodes
        if (node.data.schemaId === 'chainner:image:overlay') {
            const findEdgesToChange = () => {
                const edgeList = {};
                data.edges.forEach((edge, index) => {
                    if (
                        edge.target === node.id &&
                        edge.targetHandle.split('-').slice(-1)[0] === '3'
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
                const newID = deriveUniqueId(node.id + String(node.data.inputData['4']));
                const newBlendNode = {
                    data: {
                        schemaId: 'chainner:image:blend',
                        inputData: { 2: 100, 3: node.data.inputData['4'] },
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
                    zIndex: node.zIndex - 1,
                };
                data.edges.push(newOutputEdge);
            }

            node.data.schemaId = 'chainner:image:blend';
            node.data.inputData['3'] = node.data.inputData['2'];
            node.data.inputData['2'] =
                node.data.inputData['5'] !== undefined ? node.data.inputData['5'] : 100;
            node.data.inputData['4'] = 0;
        }
    });
    return data;
};

const updateRotateNode = (data) => {
    data.nodes.forEach((node) => {
        // Update rotation angle from dropdown to slider
        if (node.data.schemaId === 'chainner:image:rotate') {
            const RotDeg = node.data.inputData['1'];
            if (RotDeg === 0) {
                node.data.inputData['1'] = 90;
            } else if (RotDeg === '1') {
                node.data.inputData['1'] = 180;
            } else {
                node.data.inputData['1'] = 270;
            }
        }
    });
    return data;
};

const addOpacityNode = (data) => {
    const createOpacityNode = (node, opacityValue, yMoveDirection) => {
        const newID = deriveUniqueId(node.id + yMoveDirection);
        const newNode = {
            data: {
                schemaId: 'chainner:image:opacity',
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
        return [newID, newNode];
    };

    const createOutputEdge = (opacityNodeID, blendNodeID, handleID, nodeZIndex) => {
        return {
            id: deriveUniqueId(opacityNodeID + blendNodeID + handleID),
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
                const edgeList = {};
                data.edges.forEach((edge, index) => {
                    if (edge.target === node.id) {
                        if (
                            edge.targetHandle.split('-').slice(-1)[0] === '0' &&
                            node.data.inputData['2'] !== 100
                        ) {
                            edgeList.baseInput = index;
                        } else if (
                            edge.targetHandle.split('-').slice(-1)[0] === '1' &&
                            node.data.inputData['3'] !== 100
                        ) {
                            edgeList.ovInput = index;
                        }
                    }
                });
                return edgeList;
            };
            const edgesToChange = findEdgesToChange();

            const newOpacityNodeIDs = {};
            if (node.data.inputData['2'] !== 100) {
                const [newID, newNode] = createOpacityNode(node, node.data.inputData['2'], -1);
                newOpacityNodeIDs.baseOpacityNode = newID;
                data.nodes.push(newNode);
            }
            if (node.data.inputData['3'] !== 100) {
                const [newID, newNode] = createOpacityNode(node, node.data.inputData['3'], 1);
                newOpacityNodeIDs.ovOpacityNode = newID;
                data.nodes.push(newNode);
            }

            if (newOpacityNodeIDs.baseOpacityNode !== undefined) {
                if (edgesToChange.baseInput !== undefined) {
                    data.edges[edgesToChange.baseInput].target = newOpacityNodeIDs.baseOpacityNode;
                    data.edges[
                        edgesToChange.baseInput
                    ].targetHandle = `${newOpacityNodeIDs.baseOpacityNode}-0`;
                }
                data.edges.push(
                    createOutputEdge(newOpacityNodeIDs.baseOpacityNode, node.id, 0, node.zIndex - 1)
                );
            }
            if (newOpacityNodeIDs.ovOpacityNode !== undefined) {
                if (edgesToChange.ovInput !== undefined) {
                    data.edges[edgesToChange.ovInput].target = newOpacityNodeIDs.ovOpacityNode;
                    data.edges[
                        edgesToChange.ovInput
                    ].targetHandle = `${newOpacityNodeIDs.ovOpacityNode}-0`;
                }
                data.edges.push(
                    createOutputEdge(newOpacityNodeIDs.ovOpacityNode, node.id, 1, node.zIndex - 1)
                );
            }

            node.data.inputData['2'] = node.data.inputData['4'];
        }
    });
    return data;
};

const fixDropDownNumberValues = (data) => {
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

const onnxConvertUpdate = (data) => {
    const createOnnxSaveNode = (node, directory, modelName) => {
        const newID = deriveUniqueId(node.id + directory + modelName);
        const newNode = {
            data: {
                schemaId: 'chainner:onnx:save_model',
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
            zIndex: node.zIndex - 1,
        };
        return [newID, newNode, newEdge];
    };

    const edgesToRemove = [];
    const nodesToRemove = [];
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
                                    const inputDataIndex = loadEdge.targetHandle
                                        .split('-')
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

const removeEmptyStrings = (data) => {
    data.nodes.forEach((node) => {
        node.data.inputData = Object.fromEntries(
            Object.entries(node.data.inputData).filter(([, value]) => value !== '')
        );
    });

    return data;
};

const blockSizeToRadius = (data) => {
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:threshold_adaptive') {
            const size = node.data.inputData[4] ?? 3;
            node.data.inputData[4] = Math.floor((size - 1) / 2);
        }
    });

    return data;
};

const removeTargetTileSize = (data) => {
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

const addTargetTileSizeAgain = (data) => {
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

const brightnessImplementationChange = (data) => {
    const newNodes = [];
    const newEdges = [];
    const edgeMapping = new Map();

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:brightness_and_contrast') {
            const brightness = node.data.inputData[1] ?? 0;
            if (brightness !== 0) {
                // set the brightness to 0 and create a Hue & Sat node in its place
                node.data.inputData[1] = 0;
                const id = deriveUniqueId(node.id);

                newNodes.push({
                    data: {
                        schemaId: 'chainner:image:hue_and_saturation',
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
        const to = edgeMapping.get(edge.targetHandle);
        if (to) {
            edge.targetHandle = to;
            edge.target = parseTargetHandle(to).nodeId;
        }
    });

    data.nodes.push(...newNodes);
    data.edges.push(...newEdges);

    return data;
};

const convertColorSpaceFromTo = (data) => {
    const GRAY = 0;
    const RGB = 1;
    const RGBA = 2;
    const YUV = 3;
    const HSV = 4;

    /** @type {Partial<Record<number, [number, number]>>} */
    const mapping = {
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
            const [from, to] = mapping[node.data.inputData[1]] ?? [RGB, RGB];
            node.data.inputData[1] = from;
            node.data.inputData[2] = to;
        }
    });

    return data;
};

const convertColorRGBLikeDetector = (data) => {
    const GRAY = 0;
    const RGB = 1;
    const RGBA = 2;
    const RGB_LIKE = 1000;

    /** @type {Partial<Record<number, number>>} */
    const mapping = {
        [GRAY]: RGB_LIKE,
        [RGB]: RGB_LIKE,
        [RGBA]: RGB_LIKE,
    };
    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:change_colorspace') {
            const from = node.data.inputData[1];
            node.data.inputData[1] = mapping[from] ?? from;
        }
    });

    return data;
};

const convertNormalGenerator = (data) => {
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

const convertColorSpaceFromDetectors = (data) => {
    const YUV = 3;
    const HSV = 4;
    const HSL = 5;
    const YUV_LIKE = 1001;
    const HSV_LIKE = 1002;
    const HSL_LIKE = 1003;

    /** @type {Partial<Record<number, [number, number]>>} */
    const mapping = {
        [YUV]: YUV_LIKE,
        [HSV]: HSV_LIKE,
        [HSL]: HSL_LIKE,
    };

    data.nodes.forEach((node) => {
        if (node.data.schemaId === 'chainner:image:change_colorspace') {
            const from = node.data.inputData[1];
            node.data.inputData[1] = mapping[from] ?? from;
        }
    });

    return data;
};

// ==============

const versionToMigration = (version) => {
    const versions = {
        '0.1.0': 0, // Legacy files
        '0.3.0': 1, // v0.1.x & v0.2.x to v0.3.0
        '0.5.0': 2, // v0.3.x & v0.4.x to v0.5.0
        '0.5.2': 3, // v0.5.0 & v0.5.1 to v0.5.2
        '0.7.0': 4,
        '0.8.0': 5,
    };

    // eslint-disable-next-line no-restricted-syntax
    for (const [ver, migration] of Object.entries(versions)) {
        if (semver.lt(version, ver)) {
            return migration;
        }
    }
    return 6;
};

const migrations = [
    preAlpha,
    toV03,
    toV05,
    toV052,
    toV070,
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
];

export const currentMigration = migrations.length;

export const migrate = (version, data, migration) => {
    version ||= '0.0.0';
    migration ??= versionToMigration(version);

    try {
        return migrations.slice(migration).reduce((current, fn) => fn(current), data);
    } catch (error) {
        log.error(error);
        throw error;
    }
};
