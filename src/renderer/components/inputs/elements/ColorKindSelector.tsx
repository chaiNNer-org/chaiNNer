import { Button, ButtonGroup } from '@chakra-ui/react';
import { memo, useMemo } from 'react';
import { ColorKind } from '../../../../common/common-types';

const KIND_ORDER: readonly ColorKind[] = ['grayscale', 'rgb', 'rgba'];
const KIND_LABEL: Readonly<Record<ColorKind, string>> = {
    grayscale: 'Gray',
    rgb: 'RGB',
    rgba: 'RGBA',
};

interface ColorKindSelectorProps {
    kinds: ReadonlySet<ColorKind>;
    current: ColorKind;
    onSelect: (kind: ColorKind) => void;
}
export const ColorKindSelector = memo(({ kinds, current, onSelect }: ColorKindSelectorProps) => {
    const kindArray = useMemo(() => {
        return [...kinds].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
    }, [kinds]);

    return (
        <ButtonGroup
            isAttached
            size="sm"
            w="full"
        >
            {kindArray.map((k) => {
                return (
                    <Button
                        borderRadius="lg"
                        key={k}
                        variant={current === k ? 'solid' : 'ghost'}
                        w="full"
                        onClick={() => onSelect(k)}
                    >
                        {KIND_LABEL[k]}
                    </Button>
                );
            })}
        </ButtonGroup>
    );
});
