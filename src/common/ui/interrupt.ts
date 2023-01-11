interface ActionBase<T extends string> {
    readonly type: T;
}

interface OpenUrlAction extends ActionBase<'open-url'> {
    url: string;
}

export type Action = OpenUrlAction;

export interface InteractionOption {
    title: string;
    action: Action;
}

export type InterruptType = 'critical error' | 'warning';

export interface InterruptRequest {
    type: InterruptType;
    title?: string;
    message: string;
    options?: InteractionOption[];
}
