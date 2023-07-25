import { isNumericLiteral } from '@chainner/navi';
import { HStack, MenuItem, MenuList } from '@chakra-ui/react';
import { clipboard } from 'electron';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { areApproximatelyEqual } from '../../../common/util';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useInputRefactor } from '../../hooks/useInputRefactor';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { CopyOverrideIdSection } from './elements/CopyOverrideIdSection';
import { MaybeLabel } from './InputContainer';
import { InputProps } from './props';

export const NumberInput = memo(
    ({
        value,
        setValue,
        input,
        isConnected,
        isLocked,
        inputType,
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

        useEffect(() => {
            if (value === undefined) {
                setValue(def);
            }
        }, [value, def, setValue]);

        const typeNumberString = isNumericLiteral(inputType) ? inputType.toString() : '';
        const displayString = isConnected ? typeNumberString : inputString;

        const { t } = useTranslation();
        const refactor = useInputRefactor(nodeId, input, value, isConnected);

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
                {refactor}
                <CopyOverrideIdSection
                    inputId={input.id}
                    nodeId={nodeId}
                />
            </MenuList>
        ));

        return (
            <MaybeLabel input={input}>
                <HStack w="full">
                    <AdvancedNumberInput
                        controlsStep={controlsStep}
                        defaultValue={def}
                        hideTrailingZeros={hideTrailingZeros}
                        inputString={displayString}
                        isDisabled={isLocked || isConnected}
                        max={max ?? Infinity}
                        min={min ?? -Infinity}
                        precision={precision}
                        setInput={setValue}
                        setInputString={setInputString}
                        unit={unit}
                        onContextMenu={menu.onContextMenu}
                    />
                </HStack>
            </MaybeLabel>
        );
    }
);
