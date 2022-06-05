/* eslint-disable import/prefer-default-export */
import log from 'electron-log';
import { isEdge, isNode } from 'react-flow-renderer';
import semver from 'semver';

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
                                // eslint-disable-next-line no-param-reassign
                                targetEdge.source = element.id;
                                // eslint-disable-next-line no-param-reassign
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
                    // eslint-disable-next-line prefer-destructuring
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
                    // eslint-disable-next-line no-param-reassign
                    edge.sourceHandle = edge.source.concat('-', newEdgeIndex);
                }
            });
        }

        // Update any connections and inputs to Save Image Node
        if (node.data.type === 'Save Image') {
            // Shift text input values >=2 down one place and set Relative Path to empty string
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData[4] = node.data.inputData[3];
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData[3] = node.data.inputData[2];
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData[2] = '';
            // Move Image Name connection if it exists
            const edges = newData.edges.filter((e) => e.target === node.id);
            edges.forEach((edge) => {
                const edgeIndex = edge.targetHandle.slice(-2);
                if (edgeIndex === '-2') {
                    // eslint-disable-next-line no-param-reassign, prefer-destructuring
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
            // eslint-disable-next-line no-param-reassign
            node.data.schemaId = newType;
            delete node.data.category; // eslint-disable-line no-param-reassign
            delete node.data.type; // eslint-disable-line no-param-reassign
            delete node.data.icon; // eslint-disable-line no-param-reassign
            delete node.data.subcategory; // eslint-disable-line no-param-reassign
        }
    });
    return data;
};

const toV080 = (data) => {
    data.nodes.forEach((node) => {
        // Convert Resize (Factor) and Average Color Fix to percentage
        if (node.data.schemaId === 'chainner:image:resize_factor') {
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData['1'] *= 100.0;
        }
        if (node.data.schemaId === 'chainner:image:average_color_fix') {
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData['2'] *= 100.0;
        }
        // Invert interpolation weight
        if (
            ['chainner:pytorch:interpolate_models', 'chainner:ncnn:interpolate_models'].includes(
                node.data.schemaId
            )
        ) {
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData['2'] = 100 - node.data.inputData['2'];
        }
    });
    return data;
};

const updateAdjustmentScale = (data) => {
    data.nodes.forEach((node) => {
        // Convert slider scales for several Adjustment nodes
        if (node.data.schemaId === 'chainner:image:hue_and_saturation') {
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData['2'] = ((node.data.inputData['2'] / 255) * 100.0).toFixed(1);
        }
        if (node.data.schemaId === 'chainner:image:brightness_and_contrast') {
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData['1'] = ((node.data.inputData['1'] / 255) * 100.0).toFixed(1);
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData['2'] = ((node.data.inputData['2'] / 255) * 100.0).toFixed(1);
        }
    });
    return data;
};

const fixBlurNode = (data) => {
    data.nodes.forEach((node) => {
        // Convert Blur Nodes to Gaussian Blur nodes
        if (node.data.schemaId === 'chainner:image:blur') {
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.schemaId = 'chainner:image:gaussian_blur';
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData['1'] =
                Math.round((1.16531 * node.data.inputData['1'] - 0.153601) * 10) / 10;
            // eslint-disable-next-line no-param-reassign, prefer-destructuring
            node.data.inputData['2'] =
                Math.round((1.16531 * node.data.inputData['2'] - 0.153601) * 10) / 10;
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
];

export const currentMigration = migrations.length;

export const migrate = (version, data, migration) => {
    // eslint-disable-next-line no-param-reassign
    version ||= '0.0.0';
    // eslint-disable-next-line no-param-reassign
    migration ??= versionToMigration(version);

    try {
        return migrations.slice(migration).reduce((current, fn) => fn(current), data);
    } catch (error) {
        log.error(error);
        throw error;
    }
};
