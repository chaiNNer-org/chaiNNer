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
structDefinition: Struct Identifier (';' | fields);
functionDefinition:
	Def Identifier parameters (
		'=' expression ';'
		| scopeExpression
	);
variableDefinition: Let Identifier '=' expression ';';
enumDefinition:
	Enum Identifier '{' (enumVariant (',' enumVariant)* ','?)* '}';
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
functionCall: Identifier '(' args ')';
named: Identifier fields?;
scopeExpression: '{' definition* expression '}';

fieldAccessExpression: primaryExpression ('.' Identifier)*;

intersectionExpression:
	fieldAccessExpression ('&' fieldAccessExpression)*;

unionExpression:
	intersectionExpression ('|' intersectionExpression)*;

expression: unionExpression;

// misc
args: (expression (',' expression)* ','?)?;
fields: '{' (field (',' field)* ','?)? '}';
field: Identifier ':' expression;
parameters: '(' (parameter (',' parameter)* ','?)? ')';
parameter: Identifier ':' expression;

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

// skip
Space: [ \t\r\n]+ -> skip;
LineComment: '//' ~[\r\n]* -> skip;
BlockComment: '/*' .*? '*/' -> skip;
