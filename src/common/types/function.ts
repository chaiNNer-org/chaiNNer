import { evaluate } from './evaluate';
import { Expression } from './expression';
import { intersect } from './intersection';
import { isSubsetOf } from './relation';
import { TypeDefinitions } from './typedef';
import { StructType, Type } from './types';

const Null = new StructType('null');

const evaluateMap = <T>(
    map: ReadonlyMap<T, Expression>,
    definitions: TypeDefinitions
): Map<T, Type> => {
    return new Map(
        [...map].map(([id, expr]) => {
            return [id, evaluate(expr, definitions)];
        })
    );
};

export class FunctionDefinition {
    readonly inputs: ReadonlyMap<number, Type>;

    readonly outputs: ReadonlyMap<number, Type>;

    private readonly definitions: TypeDefinitions;

    constructor(
        inputs: ReadonlyMap<number, Expression>,
        outputs: ReadonlyMap<number, Expression>,
        definitions: TypeDefinitions
    ) {
        this.definitions = definitions;

        this.inputs = evaluateMap(inputs, definitions);
        this.outputs = evaluateMap(outputs, definitions);
    }

    canAssign(inputId: number, type: Type): boolean {
        const iType = this.inputs.get(inputId);
        if (!iType) throw new Error(`Invalid input id ${inputId}`);

        // we say that types A is assignable to type B if they are not disjoint
        const overlap = intersect(type, iType);

        return !isSubsetOf(overlap, Null);
    }
}
