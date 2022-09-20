grammar Navi;
options {
	language = JavaScript;
}

definitionDocument: definition* EOF;
expressionDocument: definition* expression EOF;

// definitions
definition:
	structDefinition
	| functionDefinition
	| variableDefinition
	| enumDefinition;
structDefinition: Struct name (';' | fields);
functionDefinition:
	Def name parameters ('=' expression ';' | scopeExpression);
variableDefinition: Let name '=' expression ';';
enumDefinition:
	Enum name '{' (enumVariant (',' enumVariant)* ','?)* '}';
enumVariant: Identifier fields?;

// expression
primaryExpression:
	IntInterval
	| Interval
	| Number
	| String
	| matchExpression
	| functionCall
	| named
	| scopeExpression
	| '(' expression ')';

matchExpression:
	Match expression '{' (matchArm (',' matchArm)* ','?)? '}';
matchArm: (Discard | expression) (As Identifier)? '=>' expression;
functionCall: name '(' args ')';
named: name fields?;
scopeExpression: '{' definition* expression '}';

fieldAccessExpression: primaryExpression ('.' Identifier)*;

negateExpression: OpMinus? fieldAccessExpression;

multiplicativeExpression:
	negateExpression ((OpMult | OpDiv) negateExpression)*;

additiveExpression:
	multiplicativeExpression (
		(OpMinus | OpPlus) multiplicativeExpression
	)*;

intersectionExpression:
	additiveExpression ('&' additiveExpression)*;

unionExpression:
	intersectionExpression ('|' intersectionExpression)*;

expression: unionExpression;

// misc
args: (expression (',' expression)* ','?)?;
fields: '{' (field (',' field)* ','?)? '}';
field: Identifier ':' expression;
parameters: '(' (parameter (',' parameter)* ','?)? ')';
parameter: Identifier ':' expression;

name: Identifier ('::' Identifier)*;

// keywords
As: 'as';
Def: 'def';
Let: 'let';
Match: 'match';
Struct: 'struct';
Enum: 'enum';

Discard: '_';

// literals
IntInterval: 'int' Space? '(' Space? Interval Space? ')';
Interval: Number? '..' Number?;
Number:
	'-'? DIGITS ('.' [0-9]+)? ([eE] [+\-]? DIGITS)?
	| 'inf'
	| '-inf'
	| 'nan';
String: '"' (~[\u0000-\u001f"\\] | '\\' ~[\r\n])* '"';

fragment DIGITS: '0' | [1-9][0-9]*;
fragment HEX: [0-9a-fA-F];

// identifier
Identifier: [a-zA-Z][a-zA-Z0-9_]*;

// operators
OpMinus: '-';
OpPlus: '+';
OpPow: '**';
OpMult: '*';
OpDiv: '/';

// skip
Space: [ \t\r\n]+ -> skip;
LineComment: '//' ~[\r\n]* -> skip;
BlockComment: '/*' .*? '*/' -> skip;
