import {
    abs,
    add,
    ceil,
    concat,
    cos,
    degToRad,
    divide,
    exp,
    floor,
    log,
    maximum,
    minimum,
    modulo,
    multiply,
    negate,
    pow,
    reciprocal,
    round,
    sin,
    subtract,
    toString,
} from './builtin';
import { VariableDefinition } from './expression';
import { parseDefinitions } from './parse';
import { BuiltinFunctionDefinition, ScopeBuilder } from './scope';
import { SourceDocument } from './source';
import { AnyType, IntIntervalType, NeverType, NumberType, StringType } from './types';
import { union } from './union';

const builder = new ScopeBuilder('Global scope');

// fail-safes for primitives
builder.add(new VariableDefinition('any', AnyType.instance));
builder.add(new VariableDefinition('never', NeverType.instance));
builder.add(new VariableDefinition('number', NumberType.instance));
builder.add(new VariableDefinition('string', StringType.instance));

// builtin types
builder.add(new VariableDefinition('int', new IntIntervalType(-Infinity, Infinity)));
builder.add(new VariableDefinition('uint', new IntIntervalType(0, Infinity)));

// builtin functions
// eslint-disable-next-line @typescript-eslint/unbound-method
const { unary, binary, varArgs } = BuiltinFunctionDefinition;
builder.add(varArgs('min', minimum, NumberType.instance));
builder.add(varArgs('max', maximum, NumberType.instance));
builder.add(varArgs('abs', abs, NumberType.instance));
builder.add(unary('round', round, NumberType.instance));
builder.add(unary('floor', floor, NumberType.instance));
builder.add(unary('ceil', ceil, NumberType.instance));
builder.add(binary('mod', modulo, NumberType.instance, NumberType.instance));

builder.add(unary('degToRad', degToRad, NumberType.instance));
builder.add(unary('sin', sin, NumberType.instance));
builder.add(unary('cos', cos, NumberType.instance));

builder.add(unary('exp', exp, NumberType.instance));
builder.add(unary('log', log, NumberType.instance));
builder.add(binary('pow', pow, NumberType.instance, NumberType.instance));

builder.add(varArgs('concat', concat, StringType.instance));
builder.add(unary('toString', toString, union(StringType.instance, NumberType.instance)));

// function for syntax desugaring
builder.add(unary('ops::neg', negate, NumberType.instance));
builder.add(varArgs('ops::add', add, NumberType.instance));
builder.add(binary('ops::sub', subtract, NumberType.instance, NumberType.instance));
builder.add(varArgs('ops::mul', multiply, NumberType.instance));
builder.add(binary('ops::div', divide, NumberType.instance, NumberType.instance));
builder.add(varArgs('ops::rec', reciprocal, NumberType.instance));

// invStrSet is an interesting function, because it cannot be a built-in function.
// For correctness, all built-in functions must guarantee the following property:
//   f(A) ⊆ f(B) if A⊆B
// This is necessary for the whole type system to work.
//
// This property is also expected of functions defined in Navi,
// but functions that do not follow this property can still be non-problematic in some cases.
const code = `
def invStrSet(set: string) {
    match string { set => never, _ as inv => inv }
}
`;
const definitions = parseDefinitions(new SourceDocument(code, 'global-internal'));
for (const d of definitions) {
    builder.add(d);
}

/**
 * The global scope.
 *
 * This is Navi's top-level scope. It contains all of Navi's builtin types and functions.
 */
export const globalScope = builder.createScope();
