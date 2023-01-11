import { InterruptRequest } from './interrupt';

export class CriticalError extends Error {
    interrupt: InterruptRequest;

    constructor(interrupt: Omit<InterruptRequest, 'type'>) {
        super(interrupt.message);
        this.interrupt = { type: 'critical error', ...interrupt };
    }
}
