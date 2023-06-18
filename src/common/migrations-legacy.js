/* eslint-disable prefer-destructuring */
/* eslint-disable no-param-reassign */
/* eslint-disable import/prefer-default-export */
import { isEdge, isNode } from 'reactflow';
import { log } from './log';

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

export const legacyMigrations = [preAlpha, toV03, toV05, toV052, toV070];
