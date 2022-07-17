export type SourceSpan = [start: number, end: number];
export interface Source {
    document: SourceDocument;
    span: SourceSpan;
}

export class SourceDocument {
    readonly text: string;

    readonly name: string;

    constructor(text: string, name: string) {
        this.text = text;
        this.name = name;
    }
}
