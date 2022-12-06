import {
    Button,
    Center,
    Image,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    useDisclosure,
} from '@chakra-ui/react';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { createContext } from 'use-context-selector';
import { useMemoObject } from '../hooks/useMemo';

interface ImagePreview {
    showImage: (path: string) => void;
}

export const ImagePreviewContext = createContext<Readonly<ImagePreview>>({} as ImagePreview);

export const ImagePreviewProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    const [imgPath, setImgPath] = useState('');
    const showImage = useCallback(
        (path: string) => {
            setImgPath(path);
            onOpen();
        },
        [onOpen]
    );

    const [hash, setHash] = useState(0);
    useEffect(() => {
        if (isOpen) {
            setHash(Date.now());
        }
    }, [isOpen]);

    useEffect(() => {
        return () => {
            setImgPath('');
        };
    }, []);

    const value = useMemoObject<ImagePreview>({ showImage });

    const modalBodyRef = useRef<HTMLDivElement>(null);

    return (
        <ImagePreviewContext.Provider value={value}>
            <Modal
                blockScrollOnMount
                isCentered
                isOpen={isOpen}
                returnFocusOnClose={false}
                scrollBehavior="inside"
                size="full"
                onClose={onClose}
            >
                <ModalOverlay />
                <ModalContent bgColor="var(--chain-editor-bg)">
                    <ModalHeader>Image Preview</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody
                        overflow="hidden"
                        ref={modalBodyRef}
                    >
                        <TransformWrapper initialScale={1}>
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    {/* <HStack className="tools">
                                            <Button onClick={() => zoomIn()}>+</Button>
                                            <Button onClick={() => zoomOut()}>-</Button>
                                            <Button onClick={() => resetTransform()}>x</Button>
                                        </HStack> */}
                                    <TransformComponent
                                        contentStyle={{
                                            width: modalBodyRef.current?.clientWidth,
                                            height: modalBodyRef.current?.clientHeight,
                                        }}
                                        wrapperStyle={{
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    >
                                        <Center
                                            h="100%"
                                            w="100%"
                                        >
                                            {imgPath ? (
                                                <Image
                                                    alt="Preview"
                                                    background="repeating-conic-gradient(#CDCDCD 0% 25%, #FFFFFF 0% 50%) 50% / 20px 20px"
                                                    loading="eager"
                                                    src={`${imgPath}?${hash}`}
                                                    sx={{
                                                        imageRendering: 'pixelated',
                                                    }}
                                                />
                                            ) : (
                                                <div>Image not found</div>
                                            )}
                                        </Center>
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            colorScheme="blue"
                            mr={3}
                            variant="solid"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            {children}
        </ImagePreviewContext.Provider>
    );
});
