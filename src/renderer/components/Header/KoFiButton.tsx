import { IconButton, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { SiKofi } from 'react-icons/si';
import { links } from '../../../common/links';
import { log } from '../../../common/log';
import { ipcRenderer } from '../../safeIpc';

export const KoFiButton = memo(() => {
    return (
        <Tooltip
            closeOnClick
            closeOnMouseDown
            borderRadius={8}
            label="Support chaiNNer on Ko-fi"
            px={2}
            py={1}
        >
            <IconButton
                aria-label="Support chaiNNer"
                icon={<SiKofi />}
                size="md"
                variant="outline"
                onClick={() => {
                    ipcRenderer.invoke('open-url', links.kofi).catch(() => {
                        log.error('Failed to open Ko-fi url');
                    });
                }}
            >
                Support chaiNNer
            </IconButton>
        </Tooltip>
    );
});
