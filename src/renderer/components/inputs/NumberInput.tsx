import { isNumericLiteral } from '@chainner/navi';
import { HStack, MenuItem, MenuList } from '@chakra-ui/react';
import { clipboard } from 'electron';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { areApproximatelyEqual } from '../../../common/util';
import { useContextMenu } from '../../hooks/useContextMenu';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { CopyOverrideIdSection } from './elements/CopyOverrideIdSection';
import { InputProps } from './props';

export const NumberInput = memo(
    ({
        value,
        setValue,
        input,
        isLocked,
        useInputConnected,
        useInputType,
        nodeId,
    }: InputProps<'number', number>) => {
        const { def, min, max, unit, precision, controlsStep, hideTrailingZeros } = input;

        const [inputString, setInputString] = useState(String(value ?? def));

        useEffect(() => {
            setInputString((prev) => {
                const asNumber = parseFloat(prev);
                if (
                    !Number.isNaN(asNumber) &&
                    value !== undefined &&
                    !areApproximatelyEqual(asNumber, value)
                ) {
                    return String(value);
                }

                return prev;
            });
        }, [value]);

        const isInputConnected = useInputConnected();
        const inputType = useInputType();
        const typeNumberString = isNumericLiteral(inputType) ? inputType.toString() : '';
        const displayString = isInputConnected ? typeNumberString : inputString;

        const { t } = useTranslation();

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<MdContentCopy />}
                    isDisabled={!displayString}
                    onClick={() => {
                        clipboard.writeText(displayString);
                    }}
                >
                    {t('inputs.number.copyText', 'Copy Number')}
                </MenuItem>
                <MenuItem
                    icon={<MdContentPaste />}
                    onClick={() => {
                        const n = Number(clipboard.readText());
                        if (
                            !Number.isNaN(n) &&
                            (min == null || min <= n) &&
                            (max == null || max >= n)
                        ) {
                            setValue(n);
                        }
                    }}
                >
                    {t('inputs.number.paste', 'Paste')}
                </MenuItem>
                <CopyOverrideIdSection
                    inputId={input.id}
                    nodeId={nodeId}
                />
            </MenuList>
        ));

        return (
            <HStack w="full">
                <AdvancedNumberInput
                    controlsStep={controlsStep}
                    defaultValue={def}
                    hideTrailingZeros={hideTrailingZeros}
                    inputString={displayString}
                    isDisabled={isLocked || isInputConnected}
                    max={max ?? Infinity}
                    min={min ?? -Infinity}
                    precision={precision}
                    setInput={setValue}
                    setInputString={setInputString}
                    unit={unit}
                    onContextMenu={menu.onContextMenu}
                />
            </HStack>
        );
    }
);
