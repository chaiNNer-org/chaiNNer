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
    round,
    sin,
    subtract,
    toString,
} from './builtin';
import { VariableDefinition } from './expression';
import { BuiltinFunctionDefinition, ScopeBuilder } from './scope';
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
builder.add(varArgs('add', add, NumberType.instance));
builder.add(binary('subtract', subtract, NumberType.instance, NumberType.instance));
builder.add(varArgs('multiply', multiply, NumberType.instance));
builder.add(binary('divide', divide, NumberType.instance, NumberType.instance));
builder.add(varArgs('min', minimum, NumberType.instance));
builder.add(varArgs('max', maximum, NumberType.instance));
builder.add(varArgs('abs', abs, NumberType.instance));
builder.add(unary('negate', negate, NumberType.instance));
builder.add(unary('round', round, NumberType.instance));
builder.add(unary('floor', floor, NumberType.instance));
builder.add(unary('ceil', ceil, NumberType.instance));
builder.add(binary('mod', modulo, NumberType.instance, NumberType.instance));

builder.add(unary('degToRad', degToRad, NumberType.instance));
builder.add(unary('sin', sin, NumberType.instance));
builder.add(unary('cos', cos, NumberType.instance));

builder.add(unary('exp', exp, NumberType.instance));
builder.add(unary('log', log, NumberType.instance));

builder.add(varArgs('concat', concat, StringType.instance));
builder.add(unary('toString', toString, union(StringType.instance, NumberType.instance)));

/**
 * The global scope.
 *
 * This is Navi's top-level scope. It contains all of Navi's builtin types and functions.
 */
export const globalScope = builder.createScope();
