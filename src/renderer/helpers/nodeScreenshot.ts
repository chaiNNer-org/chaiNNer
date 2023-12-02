import { clipboard, nativeImage } from 'electron';
import { toPng } from 'html-to-image';
import { Node, ReactFlowInstance } from 'reactflow';
import { EdgeData, NodeData } from '../../common/common-types';
import { delay } from '../../common/util';

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const getNodesBoundingBox = (nodes: readonly Node<NodeData>[]): Rect | undefined => {
    if (nodes.length === 0) return undefined;

    const minX = Math.min(...nodes.map((n) => n.position.x));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxX = Math.max(...nodes.map((n) => n.position.x + (n.width ?? 0)));
    const maxY = Math.max(...nodes.map((n) => n.position.y + (n.height ?? 0)));

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
};

export type PngDataUrl = string & { readonly __PngDataUrl: never };

export const takeScreenshot = async (
    currentFlowWrapper: HTMLElement,
    reactFlow: ReactFlowInstance<NodeData, EdgeData>,
    padding: number,
): Promise<PngDataUrl> => {
    const oldViewport = reactFlow.getViewport();

    const rfElement = (currentFlowWrapper.firstElementChild ?? currentFlowWrapper) as HTMLElement;
    const oldBorderRadius = rfElement.style.borderRadius;

    const reactFlowViewport = currentFlowWrapper.getBoundingClientRect();
    const nodes = reactFlow.getNodes();
    const nodesBoundingBox = getNodesBoundingBox(nodes) ?? { x: 0, y: 0, width: 0, height: 0 };

    const paddedBoundingBox = {
        x: nodesBoundingBox.x - padding,
        y: nodesBoundingBox.y - padding,
        width: nodesBoundingBox.width + padding * 2,
        height: nodesBoundingBox.height + padding * 2,
    };

    const exportZoom = Math.min(
        reactFlowViewport.width / paddedBoundingBox.width,
        reactFlowViewport.height / paddedBoundingBox.height,
    );

    try {
        reactFlow.setViewport({
            x: paddedBoundingBox.x * -1 * exportZoom,
            y: paddedBoundingBox.y * -1 * exportZoom,
            zoom: exportZoom,
        });
        rfElement.style.borderRadius = '0';

        // wait for the viewport to be updated
        await delay(10);

        const dataUrl = await toPng(rfElement, {
            style: {
                padding: '0',
                margin: '0',
                pointerEvents: 'none',
            },
            pixelRatio: 1 / exportZoom,
            width: paddedBoundingBox.width * exportZoom,
            height: paddedBoundingBox.height * exportZoom,
            backgroundColor: getComputedStyle(rfElement).backgroundColor,
            filter: (node: unknown) => {
                if (
                    node instanceof HTMLElement &&
                    (node.classList.contains('react-flow__minimap') ||
                        node.classList.contains('react-flow__controls'))
                ) {
                    return false;
                }

                return true;
            },
        });
        return dataUrl as PngDataUrl;
    } finally {
        reactFlow.setViewport(oldViewport);
        rfElement.style.borderRadius = oldBorderRadius;
    }
};

const downloadImage = (dataUrl: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

export const saveDataUrlAsFile = (dataUrl: PngDataUrl, fileName: string) => {
    downloadImage(dataUrl, fileName);
};

export const writeDataUrlToClipboard = (dataUrl: PngDataUrl) => {
    const image = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(image);
};
