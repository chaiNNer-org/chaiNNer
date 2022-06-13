# Type system

Types are sets of all their possible value.
E.g. the type `string` is the set of all possible strings (e.g. `""`, `"foo"`), and the type `number` is the set of all floating point numbers (e.g. 0, -2, 3.14, Infinity, NaN).

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

Interval types (e.g. `0..4`, `0.25..3.14`, `-Infinity..Infinity`, `0..Infinity`) are types that represent all numbers between and including their ends.
E.g. 0..4 includes all number 0 to 4 including 0 and 4.

#### Integer interval types

Integer interval types (e.g. `int(0..4)`, `int(-Infinity..Infinity)`, `int(0..Infinity)`) are types that represent all integer numbers between and including their integer ends.
E.g. `int(0..4)` includes 0, 1, 2, 3, and 4.
Importantly, the infinities are not integers, so e.g. `int(-Infinity..Infinity)` does not include infinity.

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

E.g. `struct Image { width: uint, height: uint, channels: uint }` and `struct null` are structure type definitions.

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


## Aliases

Aliases are also supported.

E.g. `uint` is an alias for `int(0..Infinity)`.

Aliases use the syntax as structure types with no fields.
However, aliases and structures can never have the same name, so there is no ambiguity.

Aliases also have definitions. E.g. `alias uint = int(0..Infinity)` is the definition for `uint`.

#### Example: boolean type

This type system intentionally does not include a boolean primitive.
This is because any type described by a finite set of variants can be represented using integer intervals or unions of other types.

A `boolean` type could be implemented like this:

```
struct false
struct true
alias boolean = false | true
```

### Generics

Aliases use the same instantiation syntax as structures and that includes fields. Fields are interpreted as generic parameters for aliases.

E.g. given the generic alias definition `alias RgbImage { width: uint, height: uint } = Image { width: width, height: height, channels: 3 }`, the instantiations `RgbImage`, `RgbImage { width: uint }`, and `RgbImage { width: uint, height: uint }` will all resolve to the type `Image { width: uint, height: uint, channels: 3 }`.

Just like with structures, all generic arguments/fields are optional and may be given in any order.

#### Example: option type

Many languages (e.g. Rust) has a explicit option type instead of `null`.
Here is how a option type would be implemented in this type system:

```
struct Some { value: any }
struct None

alias Option { value: any } = Some { value: value } | None

# Instantiation
Option { value: int } == Some { value: int } | None
Option { value: never } == None
```

#### Example: result type

Many languages (e.g. Rust) has a result type.
Here is how a result type would be implemented in this type system:

```
struct Success { value: any }
struct Error { value: any }

alias Result { success: any, error: any } = Success { value: success } | Error { value: error }

# Instantiation
Result { success: int } == Success { value: int } | Error { value: any }
Result { success: int, error: string } == Success { value: int } | Error { value: string }
Result { success: int, error: never } == Success { value: int }
```


## Built-in type definitions

### Aliases

```
alias int = int(-Infinity..Infinity)
alias uint = int(0..Infinity)
```

### Structures

```
struct null
struct Image { width: uint, height: uint, channels: int(1..Infinity) }
```
