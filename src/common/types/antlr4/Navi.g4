grammar Navi;
options {
	language = JavaScript;
}

definitionDocument: definition* EOF;
expressionDocument: expression EOF;

// definitions
definition: aliasDefinition | structDefinition;
structDefinition: Struct Identifier fields?;
aliasDefinition: Alias Identifier fields? '=' expression;

// expression
primaryExpression:
	IntInterval
	| Interval
	| Number
	| String
	| matchExpression
	| functionCall
	| named
	| '(' expression ')';

matchExpression:
	Match expression '{' (matchArm (',' matchArm)* ','?)? '}';
matchArm: (Discard | expression) (As Identifier)? '=>' expression;
functionCall: Identifier '(' args ')';
named: Identifier fields?;

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

// keywords
Alias: 'alias';
Struct: 'struct';
Match: 'match';
As: 'as';
Discard: '_';

// literals
IntInterval: 'int' Space? '(' Space? Interval Space? ')';
Interval: Number '..' Number;
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
