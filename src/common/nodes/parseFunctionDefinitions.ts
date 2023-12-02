/* eslint-disable no-continue */
import { ScopeBuilder, SourceDocument, parseDefinitions } from '@chainner/navi';
import { NodeSchema, SchemaId } from '../common-types';
import { getChainnerScope } from '../types/chainner-scope';
import { FunctionDefinition } from '../types/function';

export const parseFunctionDefinitions = (
    nodes: readonly NodeSchema[],
): Map<SchemaId, FunctionDefinition> => {
    const errors: string[] = [];

    const parentScope = getChainnerScope();
    const scopeBuilder = new ScopeBuilder('main scope', parentScope);

    const processedDeclarations = new Set<string>();
    for (const schema of nodes) {
        for (const input of schema.inputs) {
            const { typeDefinitions } = input;
            if (typeDefinitions) {
                if (processedDeclarations.has(typeDefinitions)) {
                    continue;
                }
                processedDeclarations.add(typeDefinitions);

                try {
                    const definitions = parseDefinitions(
                        new SourceDocument(typeDefinitions, `${schema.schemaId} ${input.id}`),
                    );
                    for (const d of definitions) {
                        if (parentScope.has(d.name)) {
                            errors.push(
                                `Duplicate type definitions for ${d.name} in ${schema.schemaId} > ${input.label} (id: ${input.id}). The type definition is already defined in chainner scope (see "src/common/types/chainner-scope.ts")`,
                            );
                            continue;
                        }
                        if (d.underlying === 'declaration') {
                            errors.push(`Intrinsic function definitions are not allowed.`);
                            continue;
                        }
                        scopeBuilder.add(d);
                    }
                } catch (error) {
                    errors.push(
                        `Unable to add type definitions of ${schema.schemaId} > ${input.label} (id: ${input.id}):` +
                            `\nError: ${String(error)}` +
                            `\nType definitions: ${typeDefinitions}`,
                    );
                }
            }
        }
    }

    if (errors.length) {
        throw new Error(errors.join('\n\n'));
    }

    const scope = scopeBuilder.createScope();
    const functionDefinitions = new Map<SchemaId, FunctionDefinition>();

    for (const schema of nodes) {
        try {
            functionDefinitions.set(schema.schemaId, FunctionDefinition.fromSchema(schema, scope));
        } catch (error) {
            errors.push(String(error));
        }
    }

    if (errors.length) {
        throw new Error(errors.join('\n\n'));
    }

    return functionDefinitions;
};
