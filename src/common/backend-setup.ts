export type SetupStage =
    | 'init'
    | 'checking-port'
    | 'checking-python'
    | 'downloading-python'
    | 'extracting-python'
    | 'checking-ffmpeg'
    | 'downloading-ffmpeg'
    | 'extracting-ffmpeg'
    | 'checking-deps'
    | 'updating-deps'
    | 'installing-deps'
    | 'spawning-backend'
    | 'done';
