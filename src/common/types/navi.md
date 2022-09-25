# Navi

Types are sets of all their possible value.
E.g. the type `string` is the set of all possible strings (e.g. `""`, `"foo"`), and the type `number` is the set of all floating point numbers (e.g. 0, -2, 3.14, inf, NaN).

As such, set operations are as normal.
In particular, we denote set intersection as `A & B`, and set union as `A | B`.
Furthermore, proper subset, subset, proper superset, and superset are denoted as `A < B`, `A <=`, `A > B`, and `A >= B` respectively.

The empty set is a special type called `never`.

The set that contains all values is a special type called `any`.

## Primitive types

### `number`

This type represents any real number plus ±infinity and NaN.

#### Numeric literal types

Numeric literal types (e.g. `2`, `3`, `3.1415`) are types that represent their numeric value.
E.g. `2` (the type) is equal to the set that contain the number 2.

#### Interval types

Interval types (e.g. `0..4`, `0.25..3.14`, `-inf..inf`, `0..inf`) are types that represent all numbers between and including their ends.
E.g. 0..4 includes all number 0 to 4 including 0 and 4.

Note that `-inf` and `inf` can be omitted. E.g. `0..inf` = `0..` and `-inf..inf` = `..`.

#### Integer interval types

Integer interval types (e.g. `int(0..4)`, `int(-inf..inf)`, `int(0..inf)`) are types that represent all integer numbers between and including their integer ends.
E.g. `int(0..4)` includes 0, 1, 2, 3, and 4.
Importantly, the infinities are not integers, so e.g. `int(-inf..inf)` does not include infinity.

Same as with intervals, `-inf` and `inf` can be omitted. E.g. `int(0..inf)` = `int(0..)` and `int(-inf..inf)` = `int(..)`.

### `string`

This type represents any string.

#### String literal types

String literal types (e.g. `""`, `"foo"`) are types that represent their string value.
E.g. `"foo"` (the type) is equal to the set that contain the string "foo".

### Requirements for primitive types

There are a few requirements for primitive types that are necessary for the type system to work:

1. The intersection and union of any two primitives must be unique.
2. The intersection of two primitives must either the empty (`never`) or a primitive.
3. For any set that can be represented as a union of primitives, there must only be one union of primitives that represents the set.

These are properties the type system guarantees.
Users of the type system don't have to worry about this.
They only become relevant when changing the type system itself.

## Structure types

Structure types are class-like types.
They have a name and any number of fields.
Structures with no fields are constants (e.g. `null`).

E.g. `Image { width: uint, height: uint, channels: uint }` and `null` are structure types.

### Structure type definitions

Structure types also have type definitions.
These definitions specify the fields all structure types of that name have.

E.g. `struct Image { width: uint, height: uint, channels: uint }` and `struct null;` are structure type definitions.

Note that all fields are optional when instantiating a type.
So `Image`, `Image { width: uint }`, `Image { height: uint }`, and `Image { width: uint, height: uint, channels: uint }` all create the same type given the above type definition for `Image`.

### New type pattern

Structure types are only equivalent if their names are the same and all their fields are equivalent.
This means that each structure type definitions creates a new type of structure types.

### Generics

Each structure type is generic over all its field types.

### Field access

Using a field access expression, it is possible to access for type of a field a structure or union of structures.

### Set representation

This is only important for the implementation and theory behind the type system.
Users can ignore this section.

Internally, structure types are represented as a tuple `(name, field_1, field_2, ..., field_n)`.

E.g. the set representation of the above `Image` structure is `(Image, uint, uint, uint)`.

## Variable definitions

Variables definitions are a way to give a name to a specific type expression.

Example:

```
let int = int(..);
let uint = int(0..);

let a = 1;
let b = add(a, 1);
```

#### Example: boolean type

This type system intentionally does not include a boolean primitive.
This is because any type described by a finite set of variants can be represented using integer intervals or unions of other types.

A `boolean` type could be implemented like this:

```
struct false;
struct true;
let boolean = false | true;
```

### Evaluation

Variables are evaluated lazily.
If they aren't referenced, they won't be evaluated at all.

Lazy evaluation also brings the benefit that variables can be arranged in any order.

## Enum definitions

Enums are syntactic sugar to more easily create sum types (disjoint union).
Example:

```
enum bool { true, false }
```

is equivalent to:

```
let bool = bool::true | bool::false;
struct bool::true;
struct bool::false;
```

The `::` is a namespace accessor.
It allows names to be separated into groups.

Enum variants can also have fields.
Example:

```
enum Option { Some { value: any }, None }
```

is equivalent to:

```
let Option = Option::Some | Option::None;
struct Option::Some { value: any }
struct Option::None;
```

## Function definitions

User-defined functions are supported.
While they cannot be used as values, they can be used to factor out common functionality and to create abstraction boundaries.

Functions can have any number of parameters and must always return a value.

Example:

```
def inc(n: number) = add(n, 1);
```

Functions can also contain definitions using a scope:

```
def inc(n: number) = { let result = add(n, 1); result };
```

Since scopes and functions are often used together, there a short-hand notation:

```
def inc(n: number) {
    let result = add(n, 1);
    result
}
```

### Generics

Just like how structs are generic over all their fields, functions are generic over all their parameters.
This property can be used to create types.

#### Example: option type

Many languages (e.g. Rust) has a explicit option type instead of `null`.
Here is how a option type would be implemented in Navi:

```
struct Some { value: any };
struct None;

def Option(value: any) = Some { value: value } | None;

# Instantiation
Option(int) == Some { value: int } | None
Option(never) == None
```

#### Example: result type

Many languages (e.g. Rust) has a result type.
Here is how a result type would be implemented in this type system:

```
struct Success { value: any };
struct Error { value: any };

def Result(success: any, error: any) = Success { value: success } | Error { value: error };

# Instantiation
Result(int, string) == Success { value: int } | Error { value: string }
Result(int, never) == Success { value: int }
```

## Built-in type definitions

```
let int = int(..);
let uint = int(0..);
```

More types are defined by Chainner.

## Built-in functions

Built-in functions are functions that takes types are positional arguments and return a type.
The behave just like user-defined functions, but they are not implemented with Navi but in the host language (in this case TypeScript).

The following built-in functions are supported:

-   `number::add(...numbers: number) -> number`

    Takes any number of numbers and returns their sum.

-   `number::sub(a: number, b: number) -> number`

    Takes 2 number types and returns the type that represents `a - b`.

-   `number::mul(...numbers: number) -> number`

    Takes any number of numbers and returns their product.

-   `number::div(a: number, b: number) -> number`

    Takes 2 number types and returns the type that represents `a / b`.

-   `number::neg(a: number) -> number`

    Takes a number type and returns the type that represents `-a`.

-   `round(a: number) -> number`

    Takes a number type and returns the type that represents the nearest whole numbers to the given numbers. The behavior is consistent with JavaScript's `Math.round(a)`.

-   `minimum(...numbers: number) -> number`

    Takes any number of numbers and returns their minimum. The behavior is consistent with JavaScript's `Math.min(a, b)`.

-   `maximum(...numbers: number) -> number`

    Takes any number of numbers and returns their maximum. The behavior is consistent with JavaScript's `Math.max(a, b)`.

-   `concat(...segments: string) -> string`

    Takes any number of strings and returns their concatenation.

### Syntax sugar

Special syntax is available for all `number::*` functions.
This includes the following operators:

- Unary operators: `-a` for `number::neg`.
- Binary operators: `a + b`, `a - b`, `a * b`, and `a / b` for the respective functions.

Operator precedence is as you would expect it to be.
E.g. `a + b * c` de-sugars to `number::add(a, number::mul(b, c))`.

## `match`

`match` expressions enable conditional types.
A `match` expressions consists of an input type and any number of arms.
A match arm consists of a pattern, an optional binding, and an expression the matching type will be mapped to.

Example:

```
match 1 | 3 {
    1 => 1,
    _ as x => add(x, 1)
}
```

This match expression evaluates to `1 | 4`.
It behaves as "if the given number is 1, return 1, else return the given number plus 1."

`1` and `_` are both match patterns.
`1` matches the numeric literal 1.
`_` matches any type.
`as x` is a binding and means that the part of the type that matches the pattern of the arm will be assigned to this variable.
The variable is only available in the arm's expression.

Arms are matched in order and parts of the input type matched by previous arms will not be matched again.
I.e. the `_ as x => add(x, 1)` arm did not match the `1` in `1 | 3` because it was already matched by `1 => 1`.

### Patterns

Every match arm has a pattern that describes which parts of the input type the arm handles.
A pattern is just a type, so `1`, `1 | 4`, `-inf..0 | int(1..10) | inf`, `number`, `"foo"`, `string`, `Image { width: 128 }` are all valid patterns.

Note that an arm with a `never` pattern will never be evaluated.

### Binding

Like in the example above (`as x`), the currently matched value can be assigned to a variable that is available to the expression of the arm.
