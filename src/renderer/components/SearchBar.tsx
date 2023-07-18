import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import { Input, InputGroup, InputLeftElement, InputRightElement } from '@chakra-ui/react';
import { ChangeEventHandler, memo } from 'react';

interface SearchBarProps {
    value: string;
    onChange: ChangeEventHandler<HTMLInputElement>;
    onClose: () => void;
    onClick: () => void;
}

export const SearchBar = memo(({ value, onChange, onClose, onClick }: SearchBarProps) => (
    <InputGroup borderRadius={0}>
        <InputLeftElement
            color="var(--fg-300)"
            pointerEvents="none"
        >
            <SearchIcon />
        </InputLeftElement>
        <Input
            borderRadius={0}
            placeholder="Search..."
            spellCheck={false}
            type="text"
            value={value}
            variant="filled"
            onChange={onChange}
            onClick={onClick}
        />
        <InputRightElement
            _hover={{ color: 'var(--fg-000)' }}
            style={{
                color: 'var(--fg-300)',
                cursor: 'pointer',
                display: value ? undefined : 'none',
                fontSize: '66%',
            }}
            onClick={onClose}
        >
            <CloseIcon />
        </InputRightElement>
    </InputGroup>
));
