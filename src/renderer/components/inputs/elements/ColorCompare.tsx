import { Button, ButtonGroup, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { getCssBackground, getTextColor } from '../../../../common/color-json-util';
import { ColorJson } from '../../../../common/common-types';

interface ColorCompareProps {
    oldColor: ColorJson;
    newColor: ColorJson;
    onOldClick: () => void;
    onNewClick: () => void;
}
export const ColorCompare = memo(
    ({ oldColor, newColor, onOldClick, onNewClick }: ColorCompareProps) => {
        const { t } = useTranslation();
        return (
            <ButtonGroup
                isAttached
                display="flex"
                variant="unstyled"
                w="full"
            >
                <Tooltip
                    closeOnClick
                    closeOnPointerDown
                    hasArrow
                    borderRadius={8}
                    label={t('color.resetToOld', 'Reset to old color')}
                    openDelay={1000}
                >
                    <Button
                        background={getCssBackground(oldColor)}
                        borderRadius="lg"
                        color={getTextColor(oldColor)}
                        h="3rem"
                        style={{ backgroundPositionX: '100%' }}
                        transitionProperty="none"
                        w="full"
                        onClick={onOldClick}
                    >
                        {t('inputs.colorCompare.old')}
                    </Button>
                </Tooltip>
                <Tooltip
                    closeOnClick
                    closeOnPointerDown
                    hasArrow
                    borderRadius={8}
                    label={t('color.acceptNew', 'Accept new color')}
                    openDelay={1000}
                >
                    <Button
                        background={getCssBackground(newColor)}
                        borderRadius="lg"
                        color={getTextColor(newColor)}
                        h="3rem"
                        transitionProperty="none"
                        w="full"
                        onClick={onNewClick}
                    >
                        {t('inputs.colorCompare.new')}
                    </Button>
                </Tooltip>
            </ButtonGroup>
        );
    }
);
