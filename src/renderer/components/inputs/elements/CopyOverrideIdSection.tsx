import { MenuDivider, MenuItem } from '@chakra-ui/react';
import { clipboard } from 'electron';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy } from 'react-icons/md';
import { InputId } from '../../../../common/common-types';
import { createInputOverrideId } from '../../../../common/input-override';

interface CopyOverrideIdSectionProps {
    nodeId: string | undefined;
    inputId: InputId | undefined;
}

export const CopyOverrideIdSection = memo(({ nodeId, inputId }: CopyOverrideIdSectionProps) => {
    const { t } = useTranslation();

    if (nodeId === undefined || inputId === undefined) {
        return null;
    }

    return (
        <>
            <MenuDivider />
            <MenuItem
                icon={<MdContentCopy />}
                onClick={() => {
                    clipboard.writeText(createInputOverrideId(nodeId, inputId));
                }}
            >
                {t('inputs.copyInputOverrideId', 'Copy Input Override Id')}
            </MenuItem>
        </>
    );
});
