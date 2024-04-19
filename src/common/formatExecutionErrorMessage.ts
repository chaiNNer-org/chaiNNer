import { BackendEventMap } from './Backend';
import { SchemaMap } from './SchemaMap';

const defaultListItem = (label: string, value: string) => `- ${label}: ${value}`;

export const formatExecutionErrorMessage = (
    { exception, source }: Pick<BackendEventMap['execution-error'], 'exception' | 'source'>,
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

    const inputs = schema.inputs.map((i) => {
        const inputValue = source.inputs[i.id];

        let valueStr: string;
        if (inputValue === undefined) {
            valueStr = '*unknown*';
        } else if (inputValue.type === 'formatted') {
            valueStr = inputValue.formatString;
        } else if (inputValue.type === 'unknown') {
            valueStr = `Value of type '${inputValue.typeModule}.${inputValue.typeName}'`;
        } else if (inputValue.type === 'pending') {
            valueStr = `Pending. The value hasn't been computed.`;
        } else {
            const { value } = inputValue;

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
                // just in case
                valueStr = String(value);
            }
        }

        return formatListItem(i.label, valueStr);
    });

    const inputsInfo = inputs.length === 0 ? '' : `Input values:\n${inputs.join('\n')}`;

    return `An error occurred in a ${name} node:\n\n${exception.trim()}\n\n${inputsInfo}`;
};
