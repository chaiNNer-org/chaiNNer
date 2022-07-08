import { isM1 } from '../common/env';

export const downloads = {
    python: {
        linux: 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-unknown-linux-gnu-install_only-20211017T1616.tar.gz',
        darwin: isM1
            ? 'https://github.com/indygreg/python-build-standalone/releases/download/20220318/cpython-3.9.11+20220318-aarch64-apple-darwin-install_only.tar.gz'
            : 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-apple-darwin-install_only-20211017T1616.tar.gz',
        win32: 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-pc-windows-msvc-shared-install_only-20211017T1616.tar.gz',
    },
};
