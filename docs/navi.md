# Navi

ChaiNNer has its own type system called Navi. The type system has 2 main purposes:

1.  **Static validation** \
    It checks that the connections between nodes make sense. E.g. connecting a string output to an image input will cause a type error. This is done before running the chain, live inside the graph editor.

    While this might seem very simple, because of the expressiveness of Navi, we can do some very interesting things. For example, we check number ranges, image dimension, model architectures, and even file types.

    Since we can statically determine the validity of connections, the type system is also used to suggest relevant nodes to the user. This takes the form of graying out invalid handles and showing only connectable nodes in the context node selector.

2.  **Real time feedback** \
    Since the type system is evaluated and update in real time, users get instant feedback. The frontend uses types to show the value or information about the value a node will output. E.g. number and text outputs will show the value, while image outputs will show the dimensions of the image.

    This is especially useful for new users who are not familiar with chaiNNer's nodes. They don't have to guess the size of an image upscaled with a 4x model, but the type system calculates it for them. They don't have to guess what Text Append does, because they can see its output and play around with it in real time.

## Introduction

Before we start, while Navi can be somewhat complex, it should also be easy to pick up. Navi intentionally uses TypeScript/Python-like syntax, and has similar concepts. While everything works on types, the operations should feel familiar.

For example, here's a function that pads a string to a certain width:

```navi
def padRight(s: string, width: uint): string {
    let len = string::len(s);
    let fillLen = width - len;

    match fillLen {
        1.. => string::concat(s, string::repeat(" ", fillLen)),
        _ => s,
    }
}
```

This code should be understandable to most programmers. A few things to note:

- Braces! Navi uses braces for blocks, just like TypeScript. And just like TypeScript, Navi is white-space insensitive.
- Semicolons. Each `let` statement ends with a semicolon. This is required.
- Function are defined using `def`. They require type annotations for all arguments.
- There is no `return`. The last expression in a function is the return value. Here, it's the `match` expression.
- Navi supports simple pattern matching using `match`. `if` is also supported, but `match` is more powerful.
    - Number ranges are defined using the `..` syntax. E.g. `1..10` is the set of all numbers between 1 and 10, including 1 and 10, and `1..` is all numbers greater than or equal to 1.
    - `match` (and `if`) are expressions and can be used anywhere. E.g. `let x = match foo { 1..10 => 1, _ => 0 };` is valid.
- Variable are declared using `let`. This is similar to `let` in TypeScript, but the variables are immutable.
- Navi does not support `.name()` call syntax (right now). String function have to be called by their full name.

But remember, Navi is a type system, so `padRight` will operate on types. Examples:

```navi
let a = padRight("foo", 4);
// a is "foo "

// Multiple values
// (`|` is the type union operator)

let b = padRight("foo" | "food", 5);
// b is "foo  " | "food "
let c = padRight("foo", 1 | 2 | 3 | 4 | 5);
// c is "foo" | "foo " | "foo  "
```

## Navi

Navi is a set-based type system. This means that every type is a set of values. For example, the type `number` is the set of all numbers, `int` is the set of all integers, `string` is the set of all strings, and so on.

### Important types

-   `number` - the set of all numbers. This includes integers, floats, and the infinities, and NaN.
-   `int` - the set of all integers. This does **not** include the infinities, and NaN.
-   `uint` - the set of all unsigned integers. It's all `int`s ≥ 0.
-   `string` - the set of all strings.
-   `bool` - `true | false`.
-   `null` - this type is used by chaiNNer to present optional inputs. If an input is `null`, no value is given and the python function will be given `None`.
-   `any` - the set of all values. This is more of a placeholder type or theoretical construct. It's rarely used in practice.
-   `never` - the empty set. Type is typically used to present on error.
-   `0`, `1`, `2.5`, `-10`, `inf`, `-inf`, `nan` - literal numeric types. These are used to represent specific numbers. E.g. `0` is the set containing only the number 0.
-   `0..100`, `0..inf`, `-10..10` - numeric range types. These are used to represent a range of numbers. E.g. `0..100` is the set of all numbers (including non-integers) between 0 and 100, including 0 and 100.
-   `int(0..100)`, `int(0..inf)`, `int(-10..10)` - integer range types. These are used to represent a range of integers. E.g. `int(0..100)` is the set of all integers between 0 and 100, including 0 and 100. Note that integer ranges are equivalent to casting numeric ranges to `int`. E.g. `int(0..100)` is equivalent to `int & 0..100`.
-   `""`, `"foo"`, `"bar"` - literal string types. These are used to represent specific strings. E.g. `""` is the set containing only the empty string.

### Type operations

Navi has a set of operations that can be used to create new types from existing types. These operations are:

-   **`&` - Intersection** \
    This operation creates a new type that is the intersection of the two types. E.g. `-100..100 & 0..200` is equivalent to `0..100`, `0..10 & 20..30` is equivalent to `never`, `any & T` is equivalent to `T`, and `never & T` is equivalent to `never`.

    Note: intersection can also be thought of as asserting that a value is of a certain type. E.g. `int & 0..100` is the set of all integers between 0 and 100, including 0 and 100. This is equivalent to casting `0..100` to `int`.

-   **`|` - Union** \
    This operation creates a new type that is the union of the two types. E.g. `-100..100 | 0..200` is equivalent to `-100..200`, `1 | 2 | 3 | 4` is equivalent to `int(1..4)`, `any | T` is equivalent to `any`, and `never | T` is equivalent to `T`.

### Structure types

In the set-theoretic sense, structure types are the cartesian product of their fields, but it's easier to think of them as C-like `struct`s. Structure types allow us to define new types from existing types.

For example, this is how chaiNNer's `Image` type is defined:

```navi
struct Image {
    width: uint,
    height: uint,
    channels: int(1..inf),
}
```

As we can see, `Image` has 3 fields: `width` and `height` are unsigned integers, and `channels` is an integer between 1 and infinity (= unsigned integer starting at 1).

It should be noted that the above code is the **type definition** of `Image`. To get a _type_, we need to **instantiate** it. This is done by providing values for the fields. For example, `Image { width: uint, height: 100, channels: 3 }` is the type of all images with a height of 100 and 3 channels.

Fields that are equivalent to their definitions can be omitted. For example, `Image { height: 100, channels: 3 }` is equivalent to `Image { width: uint, height: 100, channels: 3 }`. Taking this to the extreme, we can omit all fields to get the type of all images: `Image {}`. Since this is quite common for structure types, we can omit the braces and just write `Image`.

Set operations apply to structure types as well. For example, `Image { width: 100 } & Image { height: 100 }` is equivalent to `Image { width: 100, height: 100 }`, and `Image { width: 100 } | Image { width: 200 }` is equivalent to `Image { width: 100 | 200 }`.

#### Constants

It is possible to define structure types with no fields. These are called unit types or constants. They are a type that represent only a single value: themselves.

The best examples for constants are `true` and `false`. Here's how they are defined:

```navi
struct true;
struct false;
```

_Note:_ `struct Name;` is equivalent to `struct Name {}`.

`true` and `false` are unique types and are not assignable to each other, they are disjoint (`true & false` is equivalent to `never`).

As you might have guessed, `true` and `false` are used to define the `bool` type. The `bool` type is equivalent to `true | false`:

```navi
let bool = true | false;
```

### Type aliases

It's possible to give types names. This is done with the `let` keyword.

```navi
let Nat0 = int(0..inf);
let Nat1 = int(1..inf);
let keywords = "enum" | "let" | "struct";
```

Type aliases are used to both shorten long type names. Since everything is a type in Navi, type aliases can also be thought of as immutable variables (similar to `const` in JavaScript).

It's important to note that the order of definition does **not** matter. This means that the following code is valid:

```navi
let b = a | Foo { value: 2 };
let a = Foo { value 1 };
struct Foo { value: int }
```

### Match expressions

Match expressions are a core feature of the language and can be thought of as the opposite of type unions. While type unions allow us to combine types, match expressions allow us to split types.

A match expression consists of a match value and a set of match arms. Match arms represent conditions that the match value must satisfy. If the match value satisfies a match arm, the match arm's body is evaluated.

Example:

```navi
let x = int(0..10);
let y = match x {
    0..5 => "small",
    5..10 => "big",
};
```

The value of `y` will be `"small" | "big"`. Since `x` intersects with both `0..5` and `5..10`, both match arms are evaluated and their results are unioned together.

#### Exhaustiveness & the default match arm

It is important to note that match arms must be exhaustive. This means that every possible value of the match value must be covered by at least one match arm. If this is not the case, a runtime error will be thrown.

If necessary, a default match arm can be used to cover all remaining values. This is done by using the `_` keyword as the match arm's condition.

Example:

```navi
let x = /* some arbitrary type */;
let y = match x {
    0..5 => "small",
    5..10 => "big",
    _ => "unknown",
};
```

#### The order of match arms

Match arms are evaluated in order. This is important because `match` will _remove_ (set difference) the match arm's pattern from the match value. So later match arms will see the reduced match value.

As an example, let's see how following the value of `y` changed for different values of `x`. We define 2 structs (`Small` and `Big`) as helpers to make it clear which values of `x` take which match arm.

```navi
struct Small { value: any }
struct Big { value: any }

let y = match x {
    0..5 => Small { value: x },
    5..10 => Big { value: x },
    _ => x,
};
```

Let's try a few values of `x`:

Let `x = 3`: `y` will be `Small { value: 3 }`. This result should be intuitive. `3` is in the range `0..5`, so the first match arm is evaluated. Since the first match arm completely covers the match value, no other match arms are evaluated, and the final value will be `Small { value: 3 }`.

Let `x = 3 | 7`: `y` will be `Small { value: 3 } | Big { value: 7 }`. This should also be fairly intuitive. `3` only matches the first match arm, and `7` only matches the second match arm. Both match arms are evaluated with `3` and `7` respectively, and their results are unioned together.

This brings us to an important property of `match`: `match A | B { ... }` is equivalent to `match A { ... } | match B { ... }`. This means that `match` distributes over unions.

Now, let's try `x = 5`: `y` will be `Small { value: 5 }`. This is where things get interesting. `5` matches both match arms, but only the first one will be evaluated. This is because the first match arm completely covers the match value, so the second match arm will never be evaluated. This is why `y` is `Small { value: 5 }` and not `Small { value: 5 } | Big { value: 5 }`.

Finally, let's try `x = int(0..20)`: `y` will be `Small { value: int(0..5) } | Big { value: int(6..10) } | int(11..20)`. Let's go through the match arms step by step:

1. We arrive at the first match arm with a match value of `int(0..20)`. The intersection of `int(0..20)` and `0..5` is `int(0..5)`, so this is the value used to evaluate the first match arm. The result of this match arm is `Small { value: int(0..5) }`.
2. We then _remove_ `0..5` from the match value `int(0..20)` to get `int(6..20)`. This will be the match value for the second match arm.
3. We arrive at the second match arm with a match value of `int(6..20)`. The intersection of `int(6..20)` and `5..10` is `int(6..10)`, so this is the value used to evaluate the second match arm. The result of this match arm is `Big { value: int(6..10) }`.
4. We then _remove_ `5..10` from the match value `int(6..20)` to get `int(11..20)`. This will be the match value for the third match arm.
5. We arrive at the third match arm with a match value of `int(11..20)`. Since the third match arm is the default match arm, it will be evaluated with the match value `int(11..20)`. The result of this match arm is `int(11..20)`.
6. We union the results of all match arms together to get `Small { value: int(0..5) } | Big { value: int(6..10) } | int(11..20)`.

#### Bindings

In the above example, we observed that `match` automatically narrows down the variable `x` inside each match arm. Navi is unable to do this automatically for more complex match values. E.g. struct fields, type expressions, function calls, etc. cannot be narrowed down automatically.

Example:

```navi
let x = Image { width: 100 | 200 };
let y = match x.width {
    100 => "small",
    _ => x.width,  // x.width will still be 100 | 200
};
// y = "small" | 100 | 200
```

To work around this, we can use bindings. Bindings are used to directly assign the current match value of the match arm to a variable. This variable can then be used inside the match arm. This is done by using the `as` keyword.

Example:

```navi
let x = Image { width: 100 | 200 };
let y = match x.width {
    100 => "small",
    _ as width => width,  // width will still be 200
};
// y = "small" | 200
```

#### `if`

Navi also supports `if` expression on `bool` values. This is simple syntactic sugar for `match`.

Example:

```navi
let x: bool = someFunction();
let y = if x {
    "true"
} else {
    "false"
};
```

is equivalent to:

```navi
let x: bool = someFunction();
let y = match x {
    true => "true",
    false => "false",
};
```

Note: `else` is required.

`else if` is also supported. Just like in other languages, `if { ... } else if { ... } else { ... }` is equivalent to `if { ... } else { if { ... } else { ... } }`.

### Functions

Functions can be defined using the `def` keyword and called using a C-like call syntax. Functions are very similar to functions in other programming languages, but they have one important difference: All arguments are types.

Example:

```navi
def unionInt(a: int, b: int): int {
    a | b
}

let x = unionInt(1, 2 | 3);
// x = 1 | 2 | 3
```

There are 2 syntaxes for functions: expression syntax and scope syntax.

- Expression syntax: `def unionInt(a: int, b: int): int = a | b;`
- Scope syntax: `def unionInt(a: int, b: int): int { a | b }`

The only difference is that scope syntax allows you to use multiple statements inside the function body. E.g. `let` statements, `if` statements, etc.

Example:

```navi
def unionInt(a: int, b: int): int {
    let foo = a | b;
    foo
}
```

Note: `return` is not supported. Functions always return the result of the last expression in the function body.

Note: The return type annotation is optional. However, it is recommended to always use it. It makes the code easier to read and allows Navi to detect errors.

#### Predefined functions

Navi has some predefined functions that are a standard library of sorts. This includes functions for string operations (length, slice, concatenation), number operations (addition, multiplication, rounding, etc.), and more.

All full list of all predefined functions can be found [here](https://github.com/chaiNNer-org/Navi/blob/main/src/global.navi). Note that some of these functions are `intrinsics`. This means that they are not actually implemented using Navi, but are instead implemented in JavaScript/TypeScript.

### Syntax sugar

Since arithmetic operations are commonly used in chaiNNer's Navi types, they get special syntax. You can use `+`, `-`, `*`, `/`, `>`, `>=`, `<`, `<=`, `==`, and `!=`. They will behave as expected. E.g. `1 + 2 == 3`.

Under the hood, they are syntactic sugar for predefined functions. E.g. `a + b` is equivalent to `number::add(a, b)`.

### Equality

Since there is syntax for `==` and `!=`, it is important to understand how equality works in Navi.

The result of equality is a `bool` **type**. Since types are sets of values, we define equality of 2 types $A$ and $B$ as such: $\{ a = b : a \in A, b \in B \}$ where $a = b$ return `true` or `false` depending on whether $a$ and $b$ are the same value. Type equality is the set of all pair-wise comparisons of the values in $A$ and $B$.

This means that equality has the following properties:

- `A == B` is `B == A`.
- `(A | B) == C` is `(A == C) | (B == C)`.
- `(A & B) == C` is `(A == C) & (B == C)`.
- `A == never` is `never`.
- `A == any` is `bool` (`true | false`).

Let's look at a few examples to see this in action:

- `1 == 1` is `true`.
- `1 == 2` is `false`.
- `1 | 2 == 1` is `true | false` which is `bool`.
- `1 & 2 == 1` is `true & false` which is `never`.

Lastly, `A != B` is defined as `not A == B`.

Note: When comparing values, `nan` is equal to itself. So `nan == nan` is `true`.

## Unsoundness

It is very important to note that Navi is unsound. This means that there are false statements that are accepted as true by Navi. But every true statement can be proven by Navi. This tradeoff is forced upon us by [the very nature of mathematical logic](https://en.wikipedia.org/wiki/G%C3%B6del%27s_incompleteness_theorems).

However, this is not a problem in practice, quite the opposite. It means that we 100% know that chains that do not pass the type system are invalid. But chains that pass the type system are not necessarily valid. This is a very important distinction. We can use Navi to detect errors, but we cannot use it to prove correctness.
