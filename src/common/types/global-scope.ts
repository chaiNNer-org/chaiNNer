import {
    abs,
    add,
    ceil,
    concat,
    cos,
    degToRad,
    divide,
    floor,
    maximum,
    minimum,
    multiply,
    negate,
    round,
    sin,
    subtract,
    toString,
} from './builtin';
import { VariableDefinition } from './expression';
import { BuiltinFunctionDefinition, ReadonlyScope, Scope } from './scope';
import { AnyType, IntIntervalType, NeverType, NumberType, StringType } from './types';
import { union } from './union';

const scope = new Scope('Global scope');

// fail-safes for primitives
scope.add(new VariableDefinition('any', AnyType.instance));
scope.add(new VariableDefinition('never', NeverType.instance));
scope.add(new VariableDefinition('number', NumberType.instance));
scope.add(new VariableDefinition('string', StringType.instance));

// builtin types
scope.add(new VariableDefinition('int', new IntIntervalType(-Infinity, Infinity)));
scope.add(new VariableDefinition('uint', new IntIntervalType(0, Infinity)));

// builtin functions
// eslint-disable-next-line @typescript-eslint/unbound-method
const { unary, binary, varArgs } = BuiltinFunctionDefinition;
scope.add(varArgs('add', add, NumberType.instance));
scope.add(binary('subtract', subtract, NumberType.instance, NumberType.instance));
scope.add(varArgs('multiply', multiply, NumberType.instance));
scope.add(binary('divide', divide, NumberType.instance, NumberType.instance));
scope.add(varArgs('min', minimum, NumberType.instance));
scope.add(varArgs('max', maximum, NumberType.instance));
scope.add(varArgs('abs', abs, NumberType.instance));
scope.add(unary('negate', negate, NumberType.instance));
scope.add(unary('round', round, NumberType.instance));
scope.add(unary('floor', floor, NumberType.instance));
scope.add(unary('ceil', ceil, NumberType.instance));

scope.add(unary('degToRad', degToRad, NumberType.instance));
scope.add(unary('sin', sin, NumberType.instance));
scope.add(unary('cos', cos, NumberType.instance));

scope.add(varArgs('concat', concat, StringType.instance));
scope.add(unary('toString', toString, union(StringType.instance, NumberType.instance)));

/**
 * The global scope.
 *
 * This is Navi's top-level scope. It contains all of Navi's builtin types and functions.
 */
export const globalScope: ReadonlyScope = scope;
