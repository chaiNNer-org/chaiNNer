import { HStack, Icon, Text, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BiStopwatch } from 'react-icons/bi';
import { fixRoundingError, joinEnglish } from '../../../../common/util';

interface Duration {
    seconds: number;
    minutes: number;
    hours: number;
}
const splitDuration = (duration: number): Duration => {
    const MINUTE = 60;
    const HOUR = MINUTE * 60;

    const hours = Math.floor(duration / HOUR);
    // eslint-disable-next-line no-param-reassign
    duration -= hours * HOUR;
    const minutes = Math.floor(duration / MINUTE);
    // eslint-disable-next-line no-param-reassign
    duration -= minutes * MINUTE;
    const seconds = fixRoundingError(duration);

    return { hours, minutes, seconds };
};
const shortFormat = ({ hours, minutes, seconds }: Duration): string => {
    if (hours > 0) return `${hours}h ${minutes}m`;

    const totalSeconds = fixRoundingError(minutes * 60 + seconds);
    if (totalSeconds >= 100) return `${minutes}m ${Math.floor(seconds)}s`;

    const shortestVariant = [
        totalSeconds.toPrecision(2),
        totalSeconds.toFixed(2),
        String(totalSeconds),
    ]
        .filter((s) => !s.includes('e+'))
        .sort((a, b) => a.length - b.length)[0];
    return `${shortestVariant}s`;
};

interface TimerProps {
    time: number;
}

export const Timer = memo(({ time }: TimerProps) => {
    const { t } = useTranslation();
    const displayTime = Number(Number(time.toFixed(4)).toExponential(3));

    const duration = splitDuration(displayTime);
    const { hours, minutes, seconds } = duration;

    const longParts: string[] = [];
    if (hours > 0) longParts.push(`${hours} ${t('timer.hour', { count: hours })}`);
    if (minutes > 0) longParts.push(`${minutes} ${t('timer.minute', { count: minutes })}`);
    if (hours === 0 && (longParts.length === 0 || seconds > 0))
        longParts.push(`${seconds} ${t('timer.second', { count: seconds })}`);

    return (
        <Tooltip
            hasArrow
            borderRadius={8}
            closeOnClick={false}
            gutter={24}
            label={t('timer.executionTook', 'Execution took approximately {{duration}}.', {
                duration: joinEnglish(longParts),
            })}
            openDelay={150}
            px={2}
            textAlign="center"
        >
            <HStack
                bgColor="var(--node-timer-bg)"
                borderRadius="full"
                h="full"
                margin="auto"
                px={1}
                spacing={0.5}
                width="auto"
            >
                <Icon
                    as={BiStopwatch}
                    boxSize="0.75rem"
                    color="var(--node-timer-fg)"
                />
                <Text
                    color="var(--node-timer-fg)"
                    fontSize="xx-small"
                    fontWeight="500"
                    m={0}
                    textAlign="right"
                >
                    {shortFormat(duration)}
                </Text>
            </HStack>
        </Tooltip>
    );
});
