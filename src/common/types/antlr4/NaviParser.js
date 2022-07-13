// Generated from Navi.g4 by ANTLR 4.10.1
// jshint ignore: start
import antlr4 from 'antlr4';
import NaviListener from './NaviListener.js';
const serializedATN = [4,1,26,222,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,1,0,5,0,44,8,0,10,0,12,0,47,9,0,1,0,1,0,1,1,1,1,1,1,1,2,1,2,1,2,
3,2,57,8,2,1,3,1,3,1,3,1,3,3,3,63,8,3,1,4,1,4,1,4,1,4,1,4,1,4,1,4,1,4,3,
4,73,8,4,1,5,1,5,1,5,1,5,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,
1,6,1,6,3,6,93,8,6,1,7,1,7,1,7,1,7,1,7,1,7,5,7,101,8,7,10,7,12,7,104,9,7,
1,7,3,7,107,8,7,3,7,109,8,7,1,7,1,7,1,8,1,8,3,8,115,8,8,1,8,1,8,3,8,119,
8,8,1,8,1,8,1,8,1,9,1,9,1,9,1,9,1,9,1,10,1,10,3,10,131,8,10,1,11,1,11,5,
11,135,8,11,10,11,12,11,138,9,11,1,11,1,11,1,11,1,12,1,12,1,12,5,12,146,
8,12,10,12,12,12,149,9,12,1,13,1,13,1,13,5,13,154,8,13,10,13,12,13,157,9,
13,1,14,1,14,1,14,5,14,162,8,14,10,14,12,14,165,9,14,1,15,1,15,1,16,1,16,
1,16,5,16,172,8,16,10,16,12,16,175,9,16,1,16,3,16,178,8,16,3,16,180,8,16,
1,17,1,17,1,17,1,17,5,17,186,8,17,10,17,12,17,189,9,17,1,17,3,17,192,8,17,
3,17,194,8,17,1,17,1,17,1,18,1,18,1,18,1,18,1,19,1,19,1,19,1,19,5,19,206,
8,19,10,19,12,19,209,9,19,1,19,3,19,212,8,19,3,19,214,8,19,1,19,1,19,1,20,
1,20,1,20,1,20,1,20,0,0,21,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,
34,36,38,40,0,0,232,0,45,1,0,0,0,2,50,1,0,0,0,4,56,1,0,0,0,6,58,1,0,0,0,
8,64,1,0,0,0,10,74,1,0,0,0,12,92,1,0,0,0,14,94,1,0,0,0,16,114,1,0,0,0,18,
123,1,0,0,0,20,128,1,0,0,0,22,132,1,0,0,0,24,142,1,0,0,0,26,150,1,0,0,0,
28,158,1,0,0,0,30,166,1,0,0,0,32,179,1,0,0,0,34,181,1,0,0,0,36,197,1,0,0,
0,38,201,1,0,0,0,40,217,1,0,0,0,42,44,3,4,2,0,43,42,1,0,0,0,44,47,1,0,0,
0,45,43,1,0,0,0,45,46,1,0,0,0,46,48,1,0,0,0,47,45,1,0,0,0,48,49,5,0,0,1,
49,1,1,0,0,0,50,51,3,30,15,0,51,52,5,0,0,1,52,3,1,0,0,0,53,57,3,6,3,0,54,
57,3,8,4,0,55,57,3,10,5,0,56,53,1,0,0,0,56,54,1,0,0,0,56,55,1,0,0,0,57,5,
1,0,0,0,58,59,5,17,0,0,59,62,5,23,0,0,60,63,5,1,0,0,61,63,3,34,17,0,62,60,
1,0,0,0,62,61,1,0,0,0,63,7,1,0,0,0,64,65,5,14,0,0,65,66,5,23,0,0,66,72,3,
38,19,0,67,68,5,2,0,0,68,69,3,30,15,0,69,70,5,1,0,0,70,73,1,0,0,0,71,73,
3,22,11,0,72,67,1,0,0,0,72,71,1,0,0,0,73,9,1,0,0,0,74,75,5,15,0,0,75,76,
5,23,0,0,76,77,5,2,0,0,77,78,3,30,15,0,78,79,5,1,0,0,79,11,1,0,0,0,80,93,
5,19,0,0,81,93,5,20,0,0,82,93,5,21,0,0,83,93,5,22,0,0,84,93,3,14,7,0,85,
93,3,18,9,0,86,93,3,20,10,0,87,93,3,22,11,0,88,89,5,3,0,0,89,90,3,30,15,
0,90,91,5,4,0,0,91,93,1,0,0,0,92,80,1,0,0,0,92,81,1,0,0,0,92,82,1,0,0,0,
92,83,1,0,0,0,92,84,1,0,0,0,92,85,1,0,0,0,92,86,1,0,0,0,92,87,1,0,0,0,92,
88,1,0,0,0,93,13,1,0,0,0,94,95,5,16,0,0,95,96,3,30,15,0,96,108,5,5,0,0,97,
102,3,16,8,0,98,99,5,6,0,0,99,101,3,16,8,0,100,98,1,0,0,0,101,104,1,0,0,
0,102,100,1,0,0,0,102,103,1,0,0,0,103,106,1,0,0,0,104,102,1,0,0,0,105,107,
5,6,0,0,106,105,1,0,0,0,106,107,1,0,0,0,107,109,1,0,0,0,108,97,1,0,0,0,108,
109,1,0,0,0,109,110,1,0,0,0,110,111,5,7,0,0,111,15,1,0,0,0,112,115,5,18,
0,0,113,115,3,30,15,0,114,112,1,0,0,0,114,113,1,0,0,0,115,118,1,0,0,0,116,
117,5,13,0,0,117,119,5,23,0,0,118,116,1,0,0,0,118,119,1,0,0,0,119,120,1,
0,0,0,120,121,5,8,0,0,121,122,3,30,15,0,122,17,1,0,0,0,123,124,5,23,0,0,
124,125,5,3,0,0,125,126,3,32,16,0,126,127,5,4,0,0,127,19,1,0,0,0,128,130,
5,23,0,0,129,131,3,34,17,0,130,129,1,0,0,0,130,131,1,0,0,0,131,21,1,0,0,
0,132,136,5,5,0,0,133,135,3,4,2,0,134,133,1,0,0,0,135,138,1,0,0,0,136,134,
1,0,0,0,136,137,1,0,0,0,137,139,1,0,0,0,138,136,1,0,0,0,139,140,3,30,15,
0,140,141,5,7,0,0,141,23,1,0,0,0,142,147,3,12,6,0,143,144,5,9,0,0,144,146,
5,23,0,0,145,143,1,0,0,0,146,149,1,0,0,0,147,145,1,0,0,0,147,148,1,0,0,0,
148,25,1,0,0,0,149,147,1,0,0,0,150,155,3,24,12,0,151,152,5,10,0,0,152,154,
3,24,12,0,153,151,1,0,0,0,154,157,1,0,0,0,155,153,1,0,0,0,155,156,1,0,0,
0,156,27,1,0,0,0,157,155,1,0,0,0,158,163,3,26,13,0,159,160,5,11,0,0,160,
162,3,26,13,0,161,159,1,0,0,0,162,165,1,0,0,0,163,161,1,0,0,0,163,164,1,
0,0,0,164,29,1,0,0,0,165,163,1,0,0,0,166,167,3,28,14,0,167,31,1,0,0,0,168,
173,3,30,15,0,169,170,5,6,0,0,170,172,3,30,15,0,171,169,1,0,0,0,172,175,
1,0,0,0,173,171,1,0,0,0,173,174,1,0,0,0,174,177,1,0,0,0,175,173,1,0,0,0,
176,178,5,6,0,0,177,176,1,0,0,0,177,178,1,0,0,0,178,180,1,0,0,0,179,168,
1,0,0,0,179,180,1,0,0,0,180,33,1,0,0,0,181,193,5,5,0,0,182,187,3,36,18,0,
183,184,5,6,0,0,184,186,3,36,18,0,185,183,1,0,0,0,186,189,1,0,0,0,187,185,
1,0,0,0,187,188,1,0,0,0,188,191,1,0,0,0,189,187,1,0,0,0,190,192,5,6,0,0,
191,190,1,0,0,0,191,192,1,0,0,0,192,194,1,0,0,0,193,182,1,0,0,0,193,194,
1,0,0,0,194,195,1,0,0,0,195,196,5,7,0,0,196,35,1,0,0,0,197,198,5,23,0,0,
198,199,5,12,0,0,199,200,3,30,15,0,200,37,1,0,0,0,201,213,5,3,0,0,202,207,
3,40,20,0,203,204,5,6,0,0,204,206,3,40,20,0,205,203,1,0,0,0,206,209,1,0,
0,0,207,205,1,0,0,0,207,208,1,0,0,0,208,211,1,0,0,0,209,207,1,0,0,0,210,
212,5,6,0,0,211,210,1,0,0,0,211,212,1,0,0,0,212,214,1,0,0,0,213,202,1,0,
0,0,213,214,1,0,0,0,214,215,1,0,0,0,215,216,5,4,0,0,216,39,1,0,0,0,217,218,
5,23,0,0,218,219,5,12,0,0,219,220,3,30,15,0,220,41,1,0,0,0,24,45,56,62,72,
92,102,106,108,114,118,130,136,147,155,163,173,177,179,187,191,193,207,211,
213];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.PredictionContextCache();

export default class NaviParser extends antlr4.Parser {

    static grammarFileName = "Navi.g4";
    static literalNames = [ null, "';'", "'='", "'('", "')'", "'{'", "','", 
                            "'}'", "'=>'", "'.'", "'&'", "'|'", "':'", "'as'", 
                            "'def'", "'let'", "'match'", "'struct'", "'_'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, "As", "Def", 
                             "Let", "Match", "Struct", "Discard", "IntInterval", 
                             "Interval", "Number", "String", "Identifier", 
                             "Space", "LineComment", "BlockComment" ];
    static ruleNames = [ "definitionDocument", "expressionDocument", "definition", 
                         "structDefinition", "functionDefinition", "variableDefinition", 
                         "primaryExpression", "matchExpression", "matchArm", 
                         "functionCall", "named", "scopeExpression", "fieldAccessExpression", 
                         "intersectionExpression", "unionExpression", "expression", 
                         "args", "fields", "field", "parameters", "parameter" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = NaviParser.ruleNames;
        this.literalNames = NaviParser.literalNames;
        this.symbolicNames = NaviParser.symbolicNames;
    }

    get atn() {
        return atn;
    }



	definitionDocument() {
	    let localctx = new DefinitionDocumentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, NaviParser.RULE_definitionDocument);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 45;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.Def) | (1 << NaviParser.Let) | (1 << NaviParser.Struct))) !== 0)) {
	            this.state = 42;
	            this.definition();
	            this.state = 47;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 48;
	        this.match(NaviParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	expressionDocument() {
	    let localctx = new ExpressionDocumentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, NaviParser.RULE_expressionDocument);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 50;
	        this.expression();
	        this.state = 51;
	        this.match(NaviParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	definition() {
	    let localctx = new DefinitionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, NaviParser.RULE_definition);
	    try {
	        this.state = 56;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.Struct:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 53;
	            this.structDefinition();
	            break;
	        case NaviParser.Def:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 54;
	            this.functionDefinition();
	            break;
	        case NaviParser.Let:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 55;
	            this.variableDefinition();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	structDefinition() {
	    let localctx = new StructDefinitionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, NaviParser.RULE_structDefinition);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 58;
	        this.match(NaviParser.Struct);
	        this.state = 59;
	        this.match(NaviParser.Identifier);
	        this.state = 62;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.T__0:
	            this.state = 60;
	            this.match(NaviParser.T__0);
	            break;
	        case NaviParser.T__4:
	            this.state = 61;
	            this.fields();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	functionDefinition() {
	    let localctx = new FunctionDefinitionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, NaviParser.RULE_functionDefinition);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 64;
	        this.match(NaviParser.Def);
	        this.state = 65;
	        this.match(NaviParser.Identifier);
	        this.state = 66;
	        this.parameters();
	        this.state = 72;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.T__1:
	            this.state = 67;
	            this.match(NaviParser.T__1);
	            this.state = 68;
	            this.expression();
	            this.state = 69;
	            this.match(NaviParser.T__0);
	            break;
	        case NaviParser.T__4:
	            this.state = 71;
	            this.scopeExpression();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	variableDefinition() {
	    let localctx = new VariableDefinitionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, NaviParser.RULE_variableDefinition);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 74;
	        this.match(NaviParser.Let);
	        this.state = 75;
	        this.match(NaviParser.Identifier);
	        this.state = 76;
	        this.match(NaviParser.T__1);
	        this.state = 77;
	        this.expression();
	        this.state = 78;
	        this.match(NaviParser.T__0);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	primaryExpression() {
	    let localctx = new PrimaryExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, NaviParser.RULE_primaryExpression);
	    try {
	        this.state = 92;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,4,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 80;
	            this.match(NaviParser.IntInterval);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 81;
	            this.match(NaviParser.Interval);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 82;
	            this.match(NaviParser.Number);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 83;
	            this.match(NaviParser.String);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 84;
	            this.matchExpression();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 85;
	            this.functionCall();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 86;
	            this.named();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 87;
	            this.scopeExpression();
	            break;

	        case 9:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 88;
	            this.match(NaviParser.T__2);
	            this.state = 89;
	            this.expression();
	            this.state = 90;
	            this.match(NaviParser.T__3);
	            break;

	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	matchExpression() {
	    let localctx = new MatchExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, NaviParser.RULE_matchExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 94;
	        this.match(NaviParser.Match);
	        this.state = 95;
	        this.expression();
	        this.state = 96;
	        this.match(NaviParser.T__4);
	        this.state = 108;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.T__2) | (1 << NaviParser.T__4) | (1 << NaviParser.Match) | (1 << NaviParser.Discard) | (1 << NaviParser.IntInterval) | (1 << NaviParser.Interval) | (1 << NaviParser.Number) | (1 << NaviParser.String) | (1 << NaviParser.Identifier))) !== 0)) {
	            this.state = 97;
	            this.matchArm();
	            this.state = 102;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,5,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 98;
	                    this.match(NaviParser.T__5);
	                    this.state = 99;
	                    this.matchArm(); 
	                }
	                this.state = 104;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,5,this._ctx);
	            }

	            this.state = 106;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__5) {
	                this.state = 105;
	                this.match(NaviParser.T__5);
	            }

	        }

	        this.state = 110;
	        this.match(NaviParser.T__6);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	matchArm() {
	    let localctx = new MatchArmContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, NaviParser.RULE_matchArm);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 114;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.Discard:
	            this.state = 112;
	            this.match(NaviParser.Discard);
	            break;
	        case NaviParser.T__2:
	        case NaviParser.T__4:
	        case NaviParser.Match:
	        case NaviParser.IntInterval:
	        case NaviParser.Interval:
	        case NaviParser.Number:
	        case NaviParser.String:
	        case NaviParser.Identifier:
	            this.state = 113;
	            this.expression();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	        this.state = 118;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.As) {
	            this.state = 116;
	            this.match(NaviParser.As);
	            this.state = 117;
	            this.match(NaviParser.Identifier);
	        }

	        this.state = 120;
	        this.match(NaviParser.T__7);
	        this.state = 121;
	        this.expression();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	functionCall() {
	    let localctx = new FunctionCallContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, NaviParser.RULE_functionCall);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 123;
	        this.match(NaviParser.Identifier);
	        this.state = 124;
	        this.match(NaviParser.T__2);
	        this.state = 125;
	        this.args();
	        this.state = 126;
	        this.match(NaviParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	named() {
	    let localctx = new NamedContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, NaviParser.RULE_named);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 128;
	        this.match(NaviParser.Identifier);
	        this.state = 130;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,10,this._ctx);
	        if(la_===1) {
	            this.state = 129;
	            this.fields();

	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	scopeExpression() {
	    let localctx = new ScopeExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, NaviParser.RULE_scopeExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 132;
	        this.match(NaviParser.T__4);
	        this.state = 136;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.Def) | (1 << NaviParser.Let) | (1 << NaviParser.Struct))) !== 0)) {
	            this.state = 133;
	            this.definition();
	            this.state = 138;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 139;
	        this.expression();
	        this.state = 140;
	        this.match(NaviParser.T__6);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	fieldAccessExpression() {
	    let localctx = new FieldAccessExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, NaviParser.RULE_fieldAccessExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 142;
	        this.primaryExpression();
	        this.state = 147;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__8) {
	            this.state = 143;
	            this.match(NaviParser.T__8);
	            this.state = 144;
	            this.match(NaviParser.Identifier);
	            this.state = 149;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	intersectionExpression() {
	    let localctx = new IntersectionExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, NaviParser.RULE_intersectionExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 150;
	        this.fieldAccessExpression();
	        this.state = 155;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__9) {
	            this.state = 151;
	            this.match(NaviParser.T__9);
	            this.state = 152;
	            this.fieldAccessExpression();
	            this.state = 157;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	unionExpression() {
	    let localctx = new UnionExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, NaviParser.RULE_unionExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 158;
	        this.intersectionExpression();
	        this.state = 163;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__10) {
	            this.state = 159;
	            this.match(NaviParser.T__10);
	            this.state = 160;
	            this.intersectionExpression();
	            this.state = 165;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	expression() {
	    let localctx = new ExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, NaviParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 166;
	        this.unionExpression();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	args() {
	    let localctx = new ArgsContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 32, NaviParser.RULE_args);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 179;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.T__2) | (1 << NaviParser.T__4) | (1 << NaviParser.Match) | (1 << NaviParser.IntInterval) | (1 << NaviParser.Interval) | (1 << NaviParser.Number) | (1 << NaviParser.String) | (1 << NaviParser.Identifier))) !== 0)) {
	            this.state = 168;
	            this.expression();
	            this.state = 173;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,15,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 169;
	                    this.match(NaviParser.T__5);
	                    this.state = 170;
	                    this.expression(); 
	                }
	                this.state = 175;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,15,this._ctx);
	            }

	            this.state = 177;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__5) {
	                this.state = 176;
	                this.match(NaviParser.T__5);
	            }

	        }

	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	fields() {
	    let localctx = new FieldsContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 34, NaviParser.RULE_fields);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 181;
	        this.match(NaviParser.T__4);
	        this.state = 193;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.Identifier) {
	            this.state = 182;
	            this.field();
	            this.state = 187;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,18,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 183;
	                    this.match(NaviParser.T__5);
	                    this.state = 184;
	                    this.field(); 
	                }
	                this.state = 189;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,18,this._ctx);
	            }

	            this.state = 191;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__5) {
	                this.state = 190;
	                this.match(NaviParser.T__5);
	            }

	        }

	        this.state = 195;
	        this.match(NaviParser.T__6);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	field() {
	    let localctx = new FieldContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 36, NaviParser.RULE_field);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 197;
	        this.match(NaviParser.Identifier);
	        this.state = 198;
	        this.match(NaviParser.T__11);
	        this.state = 199;
	        this.expression();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	parameters() {
	    let localctx = new ParametersContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 38, NaviParser.RULE_parameters);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 201;
	        this.match(NaviParser.T__2);
	        this.state = 213;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.Identifier) {
	            this.state = 202;
	            this.parameter();
	            this.state = 207;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,21,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 203;
	                    this.match(NaviParser.T__5);
	                    this.state = 204;
	                    this.parameter(); 
	                }
	                this.state = 209;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,21,this._ctx);
	            }

	            this.state = 211;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__5) {
	                this.state = 210;
	                this.match(NaviParser.T__5);
	            }

	        }

	        this.state = 215;
	        this.match(NaviParser.T__3);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	parameter() {
	    let localctx = new ParameterContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 40, NaviParser.RULE_parameter);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 217;
	        this.match(NaviParser.Identifier);
	        this.state = 218;
	        this.match(NaviParser.T__11);
	        this.state = 219;
	        this.expression();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}


}

NaviParser.EOF = antlr4.Token.EOF;
NaviParser.T__0 = 1;
NaviParser.T__1 = 2;
NaviParser.T__2 = 3;
NaviParser.T__3 = 4;
NaviParser.T__4 = 5;
NaviParser.T__5 = 6;
NaviParser.T__6 = 7;
NaviParser.T__7 = 8;
NaviParser.T__8 = 9;
NaviParser.T__9 = 10;
NaviParser.T__10 = 11;
NaviParser.T__11 = 12;
NaviParser.As = 13;
NaviParser.Def = 14;
NaviParser.Let = 15;
NaviParser.Match = 16;
NaviParser.Struct = 17;
NaviParser.Discard = 18;
NaviParser.IntInterval = 19;
NaviParser.Interval = 20;
NaviParser.Number = 21;
NaviParser.String = 22;
NaviParser.Identifier = 23;
NaviParser.Space = 24;
NaviParser.LineComment = 25;
NaviParser.BlockComment = 26;

NaviParser.RULE_definitionDocument = 0;
NaviParser.RULE_expressionDocument = 1;
NaviParser.RULE_definition = 2;
NaviParser.RULE_structDefinition = 3;
NaviParser.RULE_functionDefinition = 4;
NaviParser.RULE_variableDefinition = 5;
NaviParser.RULE_primaryExpression = 6;
NaviParser.RULE_matchExpression = 7;
NaviParser.RULE_matchArm = 8;
NaviParser.RULE_functionCall = 9;
NaviParser.RULE_named = 10;
NaviParser.RULE_scopeExpression = 11;
NaviParser.RULE_fieldAccessExpression = 12;
NaviParser.RULE_intersectionExpression = 13;
NaviParser.RULE_unionExpression = 14;
NaviParser.RULE_expression = 15;
NaviParser.RULE_args = 16;
NaviParser.RULE_fields = 17;
NaviParser.RULE_field = 18;
NaviParser.RULE_parameters = 19;
NaviParser.RULE_parameter = 20;

class DefinitionDocumentContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_definitionDocument;
    }

	EOF() {
	    return this.getToken(NaviParser.EOF, 0);
	};

	definition = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DefinitionContext);
	    } else {
	        return this.getTypedRuleContext(DefinitionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterDefinitionDocument(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitDefinitionDocument(this);
		}
	}


}



class ExpressionDocumentContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_expressionDocument;
    }

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	EOF() {
	    return this.getToken(NaviParser.EOF, 0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterExpressionDocument(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitExpressionDocument(this);
		}
	}


}



class DefinitionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_definition;
    }

	structDefinition() {
	    return this.getTypedRuleContext(StructDefinitionContext,0);
	};

	functionDefinition() {
	    return this.getTypedRuleContext(FunctionDefinitionContext,0);
	};

	variableDefinition() {
	    return this.getTypedRuleContext(VariableDefinitionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterDefinition(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitDefinition(this);
		}
	}


}



class StructDefinitionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_structDefinition;
    }

	Struct() {
	    return this.getToken(NaviParser.Struct, 0);
	};

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	fields() {
	    return this.getTypedRuleContext(FieldsContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterStructDefinition(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitStructDefinition(this);
		}
	}


}



class FunctionDefinitionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_functionDefinition;
    }

	Def() {
	    return this.getToken(NaviParser.Def, 0);
	};

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	parameters() {
	    return this.getTypedRuleContext(ParametersContext,0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	scopeExpression() {
	    return this.getTypedRuleContext(ScopeExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterFunctionDefinition(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitFunctionDefinition(this);
		}
	}


}



class VariableDefinitionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_variableDefinition;
    }

	Let() {
	    return this.getToken(NaviParser.Let, 0);
	};

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterVariableDefinition(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitVariableDefinition(this);
		}
	}


}



class PrimaryExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_primaryExpression;
    }

	IntInterval() {
	    return this.getToken(NaviParser.IntInterval, 0);
	};

	Interval() {
	    return this.getToken(NaviParser.Interval, 0);
	};

	Number() {
	    return this.getToken(NaviParser.Number, 0);
	};

	String() {
	    return this.getToken(NaviParser.String, 0);
	};

	matchExpression() {
	    return this.getTypedRuleContext(MatchExpressionContext,0);
	};

	functionCall() {
	    return this.getTypedRuleContext(FunctionCallContext,0);
	};

	named() {
	    return this.getTypedRuleContext(NamedContext,0);
	};

	scopeExpression() {
	    return this.getTypedRuleContext(ScopeExpressionContext,0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterPrimaryExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitPrimaryExpression(this);
		}
	}


}



class MatchExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_matchExpression;
    }

	Match() {
	    return this.getToken(NaviParser.Match, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	matchArm = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MatchArmContext);
	    } else {
	        return this.getTypedRuleContext(MatchArmContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterMatchExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitMatchExpression(this);
		}
	}


}



class MatchArmContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_matchArm;
    }

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	Discard() {
	    return this.getToken(NaviParser.Discard, 0);
	};

	As() {
	    return this.getToken(NaviParser.As, 0);
	};

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterMatchArm(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitMatchArm(this);
		}
	}


}



class FunctionCallContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_functionCall;
    }

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	args() {
	    return this.getTypedRuleContext(ArgsContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterFunctionCall(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitFunctionCall(this);
		}
	}


}



class NamedContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_named;
    }

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	fields() {
	    return this.getTypedRuleContext(FieldsContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterNamed(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitNamed(this);
		}
	}


}



class ScopeExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_scopeExpression;
    }

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	definition = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(DefinitionContext);
	    } else {
	        return this.getTypedRuleContext(DefinitionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterScopeExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitScopeExpression(this);
		}
	}


}



class FieldAccessExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_fieldAccessExpression;
    }

	primaryExpression() {
	    return this.getTypedRuleContext(PrimaryExpressionContext,0);
	};

	Identifier = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(NaviParser.Identifier);
	    } else {
	        return this.getToken(NaviParser.Identifier, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterFieldAccessExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitFieldAccessExpression(this);
		}
	}


}



class IntersectionExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_intersectionExpression;
    }

	fieldAccessExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FieldAccessExpressionContext);
	    } else {
	        return this.getTypedRuleContext(FieldAccessExpressionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterIntersectionExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitIntersectionExpression(this);
		}
	}


}



class UnionExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_unionExpression;
    }

	intersectionExpression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(IntersectionExpressionContext);
	    } else {
	        return this.getTypedRuleContext(IntersectionExpressionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterUnionExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitUnionExpression(this);
		}
	}


}



class ExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_expression;
    }

	unionExpression() {
	    return this.getTypedRuleContext(UnionExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitExpression(this);
		}
	}


}



class ArgsContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_args;
    }

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterArgs(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitArgs(this);
		}
	}


}



class FieldsContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_fields;
    }

	field = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(FieldContext);
	    } else {
	        return this.getTypedRuleContext(FieldContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterFields(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitFields(this);
		}
	}


}



class FieldContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_field;
    }

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterField(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitField(this);
		}
	}


}



class ParametersContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_parameters;
    }

	parameter = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ParameterContext);
	    } else {
	        return this.getTypedRuleContext(ParameterContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterParameters(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitParameters(this);
		}
	}


}



class ParameterContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_parameter;
    }

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterParameter(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitParameter(this);
		}
	}


}




NaviParser.DefinitionDocumentContext = DefinitionDocumentContext; 
NaviParser.ExpressionDocumentContext = ExpressionDocumentContext; 
NaviParser.DefinitionContext = DefinitionContext; 
NaviParser.StructDefinitionContext = StructDefinitionContext; 
NaviParser.FunctionDefinitionContext = FunctionDefinitionContext; 
NaviParser.VariableDefinitionContext = VariableDefinitionContext; 
NaviParser.PrimaryExpressionContext = PrimaryExpressionContext; 
NaviParser.MatchExpressionContext = MatchExpressionContext; 
NaviParser.MatchArmContext = MatchArmContext; 
NaviParser.FunctionCallContext = FunctionCallContext; 
NaviParser.NamedContext = NamedContext; 
NaviParser.ScopeExpressionContext = ScopeExpressionContext; 
NaviParser.FieldAccessExpressionContext = FieldAccessExpressionContext; 
NaviParser.IntersectionExpressionContext = IntersectionExpressionContext; 
NaviParser.UnionExpressionContext = UnionExpressionContext; 
NaviParser.ExpressionContext = ExpressionContext; 
NaviParser.ArgsContext = ArgsContext; 
NaviParser.FieldsContext = FieldsContext; 
NaviParser.FieldContext = FieldContext; 
NaviParser.ParametersContext = ParametersContext; 
NaviParser.ParameterContext = ParameterContext; 
