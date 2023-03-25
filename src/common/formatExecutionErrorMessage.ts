import { BackendEventMap } from './Backend';
import { SchemaMap } from './SchemaMap';

const defaultListItem = (label: string, value: string) => `- ${label}: ${value}`;

export const formatExecutionErrorMessage = (
    { exception, source }: BackendEventMap['execution-error'],
    schemata: SchemaMap,
    formatListItem: (label: string, value: string) => string = defaultListItem
): string => {
    if (!source) return exception;

    const schema = schemata.get(source.schemaId);
    let { name } = schema;
    if (!schemata.hasUniqueName(source.schemaId)) {
        // make the name unique using the category of the schema
        name = `${schema.category} ${schema.name}`;
    }

    const inputs = schema.inputs.flatMap((i) => {
        const value = source.inputs[i.id];
        if (value === undefined) return [];

        let valueStr: string;
        const option = i.kind === 'dropdown' && i.options.find((o) => o.value === value);
        if (option) {
            valueStr = option.option;
        } else if (value === null) {
            valueStr = 'None';
        } else if (typeof value === 'number') {
            valueStr = String(value);
            if ((i.kind === 'number' || i.kind === 'slider') && i.unit) {
                valueStr += i.unit;
            }
        } else if (typeof value === 'string') {
            valueStr = JSON.stringify(value);
        } else {
            let type = 'Image';
            if (value.channels === 1) type = 'Grayscale image';
            if (value.channels === 3) type = 'RGB image';
            if (value.channels === 4) type = 'RGBA image';
            valueStr = `${type} ${value.width}x${value.height}`;
        }

        return [formatListItem(i.label, valueStr)];
    });
    const partial = inputs.length === schema.inputs.length;
    const inputsInfo =
        inputs.length === 0
            ? ''
            : `Input values${partial ? '' : ' (partial)'}:\n${inputs.join('\n')}`;

    return `An error occurred in a ${name} node:\n\n${exception.trim()}\n\n${inputsInfo}`;
};
