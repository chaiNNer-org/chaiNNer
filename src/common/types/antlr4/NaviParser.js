// Generated from Navi.g4 by ANTLR 4.10.1
// jshint ignore: start
import antlr4 from 'antlr4';
import NaviListener from './NaviListener.js';
const serializedATN = [4,1,24,173,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,1,0,5,0,36,8,0,10,0,12,0,39,9,0,
1,0,1,0,1,1,1,1,1,1,1,2,1,2,3,2,48,8,2,1,3,1,3,1,3,3,3,53,8,3,1,4,1,4,1,
4,3,4,58,8,4,1,4,1,4,1,4,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,1,5,3,5,
74,8,5,1,6,1,6,1,6,1,6,1,6,1,6,5,6,82,8,6,10,6,12,6,85,9,6,1,6,3,6,88,8,
6,3,6,90,8,6,1,6,1,6,1,7,1,7,3,7,96,8,7,1,7,1,7,3,7,100,8,7,1,7,1,7,1,7,
1,8,1,8,1,8,1,8,1,8,1,9,1,9,3,9,112,8,9,1,10,1,10,1,10,5,10,117,8,10,10,
10,12,10,120,9,10,1,11,1,11,1,11,5,11,125,8,11,10,11,12,11,128,9,11,1,12,
1,12,1,12,5,12,133,8,12,10,12,12,12,136,9,12,1,13,1,13,1,14,1,14,1,14,5,
14,143,8,14,10,14,12,14,146,9,14,1,14,3,14,149,8,14,3,14,151,8,14,1,15,1,
15,1,15,1,15,5,15,157,8,15,10,15,12,15,160,9,15,1,15,3,15,163,8,15,3,15,
165,8,15,1,15,1,15,1,16,1,16,1,16,1,16,1,16,0,0,17,0,2,4,6,8,10,12,14,16,
18,20,22,24,26,28,30,32,0,0,181,0,37,1,0,0,0,2,42,1,0,0,0,4,47,1,0,0,0,6,
49,1,0,0,0,8,54,1,0,0,0,10,73,1,0,0,0,12,75,1,0,0,0,14,95,1,0,0,0,16,104,
1,0,0,0,18,109,1,0,0,0,20,113,1,0,0,0,22,121,1,0,0,0,24,129,1,0,0,0,26,137,
1,0,0,0,28,150,1,0,0,0,30,152,1,0,0,0,32,168,1,0,0,0,34,36,3,4,2,0,35,34,
1,0,0,0,36,39,1,0,0,0,37,35,1,0,0,0,37,38,1,0,0,0,38,40,1,0,0,0,39,37,1,
0,0,0,40,41,5,0,0,1,41,1,1,0,0,0,42,43,3,26,13,0,43,44,5,0,0,1,44,3,1,0,
0,0,45,48,3,8,4,0,46,48,3,6,3,0,47,45,1,0,0,0,47,46,1,0,0,0,48,5,1,0,0,0,
49,50,5,13,0,0,50,52,5,21,0,0,51,53,3,30,15,0,52,51,1,0,0,0,52,53,1,0,0,
0,53,7,1,0,0,0,54,55,5,12,0,0,55,57,5,21,0,0,56,58,3,30,15,0,57,56,1,0,0,
0,57,58,1,0,0,0,58,59,1,0,0,0,59,60,5,1,0,0,60,61,3,26,13,0,61,9,1,0,0,0,
62,74,5,17,0,0,63,74,5,18,0,0,64,74,5,19,0,0,65,74,5,20,0,0,66,74,3,12,6,
0,67,74,3,16,8,0,68,74,3,18,9,0,69,70,5,2,0,0,70,71,3,26,13,0,71,72,5,3,
0,0,72,74,1,0,0,0,73,62,1,0,0,0,73,63,1,0,0,0,73,64,1,0,0,0,73,65,1,0,0,
0,73,66,1,0,0,0,73,67,1,0,0,0,73,68,1,0,0,0,73,69,1,0,0,0,74,11,1,0,0,0,
75,76,5,14,0,0,76,77,3,26,13,0,77,89,5,4,0,0,78,83,3,14,7,0,79,80,5,5,0,
0,80,82,3,14,7,0,81,79,1,0,0,0,82,85,1,0,0,0,83,81,1,0,0,0,83,84,1,0,0,0,
84,87,1,0,0,0,85,83,1,0,0,0,86,88,5,5,0,0,87,86,1,0,0,0,87,88,1,0,0,0,88,
90,1,0,0,0,89,78,1,0,0,0,89,90,1,0,0,0,90,91,1,0,0,0,91,92,5,6,0,0,92,13,
1,0,0,0,93,96,5,16,0,0,94,96,3,26,13,0,95,93,1,0,0,0,95,94,1,0,0,0,96,99,
1,0,0,0,97,98,5,15,0,0,98,100,5,21,0,0,99,97,1,0,0,0,99,100,1,0,0,0,100,
101,1,0,0,0,101,102,5,7,0,0,102,103,3,26,13,0,103,15,1,0,0,0,104,105,5,21,
0,0,105,106,5,2,0,0,106,107,3,28,14,0,107,108,5,3,0,0,108,17,1,0,0,0,109,
111,5,21,0,0,110,112,3,30,15,0,111,110,1,0,0,0,111,112,1,0,0,0,112,19,1,
0,0,0,113,118,3,10,5,0,114,115,5,8,0,0,115,117,5,21,0,0,116,114,1,0,0,0,
117,120,1,0,0,0,118,116,1,0,0,0,118,119,1,0,0,0,119,21,1,0,0,0,120,118,1,
0,0,0,121,126,3,20,10,0,122,123,5,9,0,0,123,125,3,20,10,0,124,122,1,0,0,
0,125,128,1,0,0,0,126,124,1,0,0,0,126,127,1,0,0,0,127,23,1,0,0,0,128,126,
1,0,0,0,129,134,3,22,11,0,130,131,5,10,0,0,131,133,3,22,11,0,132,130,1,0,
0,0,133,136,1,0,0,0,134,132,1,0,0,0,134,135,1,0,0,0,135,25,1,0,0,0,136,134,
1,0,0,0,137,138,3,24,12,0,138,27,1,0,0,0,139,144,3,26,13,0,140,141,5,5,0,
0,141,143,3,26,13,0,142,140,1,0,0,0,143,146,1,0,0,0,144,142,1,0,0,0,144,
145,1,0,0,0,145,148,1,0,0,0,146,144,1,0,0,0,147,149,5,5,0,0,148,147,1,0,
0,0,148,149,1,0,0,0,149,151,1,0,0,0,150,139,1,0,0,0,150,151,1,0,0,0,151,
29,1,0,0,0,152,164,5,4,0,0,153,158,3,32,16,0,154,155,5,5,0,0,155,157,3,32,
16,0,156,154,1,0,0,0,157,160,1,0,0,0,158,156,1,0,0,0,158,159,1,0,0,0,159,
162,1,0,0,0,160,158,1,0,0,0,161,163,5,5,0,0,162,161,1,0,0,0,162,163,1,0,
0,0,163,165,1,0,0,0,164,153,1,0,0,0,164,165,1,0,0,0,165,166,1,0,0,0,166,
167,5,6,0,0,167,31,1,0,0,0,168,169,5,21,0,0,169,170,5,11,0,0,170,171,3,26,
13,0,171,33,1,0,0,0,20,37,47,52,57,73,83,87,89,95,99,111,118,126,134,144,
148,150,158,162,164];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.PredictionContextCache();

export default class NaviParser extends antlr4.Parser {

    static grammarFileName = "Navi.g4";
    static literalNames = [ null, "'='", "'('", "')'", "'{'", "','", "'}'", 
                            "'=>'", "'.'", "'&'", "'|'", "':'", "'alias'", 
                            "'struct'", "'match'", "'as'", "'_'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, "Alias", "Struct", 
                             "Match", "As", "Discard", "IntInterval", "Interval", 
                             "Number", "String", "Identifier", "Space", 
                             "LineComment", "BlockComment" ];
    static ruleNames = [ "definitionDocument", "expressionDocument", "definition", 
                         "structDefinition", "aliasDefinition", "primaryExpression", 
                         "matchExpression", "matchArm", "functionCall", 
                         "named", "fieldAccessExpression", "intersectionExpression", 
                         "unionExpression", "expression", "args", "fields", 
                         "field" ];

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
	        this.state = 37;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.Alias || _la===NaviParser.Struct) {
	            this.state = 34;
	            this.definition();
	            this.state = 39;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 40;
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
	        this.state = 42;
	        this.expression();
	        this.state = 43;
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
	        this.state = 47;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.Alias:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 45;
	            this.aliasDefinition();
	            break;
	        case NaviParser.Struct:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 46;
	            this.structDefinition();
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
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 49;
	        this.match(NaviParser.Struct);
	        this.state = 50;
	        this.match(NaviParser.Identifier);
	        this.state = 52;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.T__3) {
	            this.state = 51;
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



	aliasDefinition() {
	    let localctx = new AliasDefinitionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, NaviParser.RULE_aliasDefinition);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 54;
	        this.match(NaviParser.Alias);
	        this.state = 55;
	        this.match(NaviParser.Identifier);
	        this.state = 57;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.T__3) {
	            this.state = 56;
	            this.fields();
	        }

	        this.state = 59;
	        this.match(NaviParser.T__0);
	        this.state = 60;
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



	primaryExpression() {
	    let localctx = new PrimaryExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, NaviParser.RULE_primaryExpression);
	    try {
	        this.state = 73;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,4,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 62;
	            this.match(NaviParser.IntInterval);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 63;
	            this.match(NaviParser.Interval);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 64;
	            this.match(NaviParser.Number);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 65;
	            this.match(NaviParser.String);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 66;
	            this.matchExpression();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 67;
	            this.functionCall();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 68;
	            this.named();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 69;
	            this.match(NaviParser.T__1);
	            this.state = 70;
	            this.expression();
	            this.state = 71;
	            this.match(NaviParser.T__2);
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
	    this.enterRule(localctx, 12, NaviParser.RULE_matchExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 75;
	        this.match(NaviParser.Match);
	        this.state = 76;
	        this.expression();
	        this.state = 77;
	        this.match(NaviParser.T__3);
	        this.state = 89;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.T__1) | (1 << NaviParser.Match) | (1 << NaviParser.Discard) | (1 << NaviParser.IntInterval) | (1 << NaviParser.Interval) | (1 << NaviParser.Number) | (1 << NaviParser.String) | (1 << NaviParser.Identifier))) !== 0)) {
	            this.state = 78;
	            this.matchArm();
	            this.state = 83;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,5,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 79;
	                    this.match(NaviParser.T__4);
	                    this.state = 80;
	                    this.matchArm(); 
	                }
	                this.state = 85;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,5,this._ctx);
	            }

	            this.state = 87;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__4) {
	                this.state = 86;
	                this.match(NaviParser.T__4);
	            }

	        }

	        this.state = 91;
	        this.match(NaviParser.T__5);
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
	    this.enterRule(localctx, 14, NaviParser.RULE_matchArm);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 95;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.Discard:
	            this.state = 93;
	            this.match(NaviParser.Discard);
	            break;
	        case NaviParser.T__1:
	        case NaviParser.Match:
	        case NaviParser.IntInterval:
	        case NaviParser.Interval:
	        case NaviParser.Number:
	        case NaviParser.String:
	        case NaviParser.Identifier:
	            this.state = 94;
	            this.expression();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	        this.state = 99;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.As) {
	            this.state = 97;
	            this.match(NaviParser.As);
	            this.state = 98;
	            this.match(NaviParser.Identifier);
	        }

	        this.state = 101;
	        this.match(NaviParser.T__6);
	        this.state = 102;
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
	    this.enterRule(localctx, 16, NaviParser.RULE_functionCall);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 104;
	        this.match(NaviParser.Identifier);
	        this.state = 105;
	        this.match(NaviParser.T__1);
	        this.state = 106;
	        this.args();
	        this.state = 107;
	        this.match(NaviParser.T__2);
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
	    this.enterRule(localctx, 18, NaviParser.RULE_named);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 109;
	        this.match(NaviParser.Identifier);
	        this.state = 111;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,10,this._ctx);
	        if(la_===1) {
	            this.state = 110;
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



	fieldAccessExpression() {
	    let localctx = new FieldAccessExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, NaviParser.RULE_fieldAccessExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 113;
	        this.primaryExpression();
	        this.state = 118;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__7) {
	            this.state = 114;
	            this.match(NaviParser.T__7);
	            this.state = 115;
	            this.match(NaviParser.Identifier);
	            this.state = 120;
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
	    this.enterRule(localctx, 22, NaviParser.RULE_intersectionExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 121;
	        this.fieldAccessExpression();
	        this.state = 126;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__8) {
	            this.state = 122;
	            this.match(NaviParser.T__8);
	            this.state = 123;
	            this.fieldAccessExpression();
	            this.state = 128;
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
	    this.enterRule(localctx, 24, NaviParser.RULE_unionExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 129;
	        this.intersectionExpression();
	        this.state = 134;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__9) {
	            this.state = 130;
	            this.match(NaviParser.T__9);
	            this.state = 131;
	            this.intersectionExpression();
	            this.state = 136;
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
	    this.enterRule(localctx, 26, NaviParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 137;
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
	    this.enterRule(localctx, 28, NaviParser.RULE_args);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 150;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.T__1) | (1 << NaviParser.Match) | (1 << NaviParser.IntInterval) | (1 << NaviParser.Interval) | (1 << NaviParser.Number) | (1 << NaviParser.String) | (1 << NaviParser.Identifier))) !== 0)) {
	            this.state = 139;
	            this.expression();
	            this.state = 144;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,14,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 140;
	                    this.match(NaviParser.T__4);
	                    this.state = 141;
	                    this.expression(); 
	                }
	                this.state = 146;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,14,this._ctx);
	            }

	            this.state = 148;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__4) {
	                this.state = 147;
	                this.match(NaviParser.T__4);
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
	    this.enterRule(localctx, 30, NaviParser.RULE_fields);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 152;
	        this.match(NaviParser.T__3);
	        this.state = 164;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.Identifier) {
	            this.state = 153;
	            this.field();
	            this.state = 158;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,17,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 154;
	                    this.match(NaviParser.T__4);
	                    this.state = 155;
	                    this.field(); 
	                }
	                this.state = 160;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,17,this._ctx);
	            }

	            this.state = 162;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__4) {
	                this.state = 161;
	                this.match(NaviParser.T__4);
	            }

	        }

	        this.state = 166;
	        this.match(NaviParser.T__5);
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
	    this.enterRule(localctx, 32, NaviParser.RULE_field);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 168;
	        this.match(NaviParser.Identifier);
	        this.state = 169;
	        this.match(NaviParser.T__10);
	        this.state = 170;
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
NaviParser.Alias = 12;
NaviParser.Struct = 13;
NaviParser.Match = 14;
NaviParser.As = 15;
NaviParser.Discard = 16;
NaviParser.IntInterval = 17;
NaviParser.Interval = 18;
NaviParser.Number = 19;
NaviParser.String = 20;
NaviParser.Identifier = 21;
NaviParser.Space = 22;
NaviParser.LineComment = 23;
NaviParser.BlockComment = 24;

NaviParser.RULE_definitionDocument = 0;
NaviParser.RULE_expressionDocument = 1;
NaviParser.RULE_definition = 2;
NaviParser.RULE_structDefinition = 3;
NaviParser.RULE_aliasDefinition = 4;
NaviParser.RULE_primaryExpression = 5;
NaviParser.RULE_matchExpression = 6;
NaviParser.RULE_matchArm = 7;
NaviParser.RULE_functionCall = 8;
NaviParser.RULE_named = 9;
NaviParser.RULE_fieldAccessExpression = 10;
NaviParser.RULE_intersectionExpression = 11;
NaviParser.RULE_unionExpression = 12;
NaviParser.RULE_expression = 13;
NaviParser.RULE_args = 14;
NaviParser.RULE_fields = 15;
NaviParser.RULE_field = 16;

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

	aliasDefinition() {
	    return this.getTypedRuleContext(AliasDefinitionContext,0);
	};

	structDefinition() {
	    return this.getTypedRuleContext(StructDefinitionContext,0);
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



class AliasDefinitionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_aliasDefinition;
    }

	Alias() {
	    return this.getToken(NaviParser.Alias, 0);
	};

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	fields() {
	    return this.getTypedRuleContext(FieldsContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterAliasDefinition(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitAliasDefinition(this);
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




NaviParser.DefinitionDocumentContext = DefinitionDocumentContext; 
NaviParser.ExpressionDocumentContext = ExpressionDocumentContext; 
NaviParser.DefinitionContext = DefinitionContext; 
NaviParser.StructDefinitionContext = StructDefinitionContext; 
NaviParser.AliasDefinitionContext = AliasDefinitionContext; 
NaviParser.PrimaryExpressionContext = PrimaryExpressionContext; 
NaviParser.MatchExpressionContext = MatchExpressionContext; 
NaviParser.MatchArmContext = MatchArmContext; 
NaviParser.FunctionCallContext = FunctionCallContext; 
NaviParser.NamedContext = NamedContext; 
NaviParser.FieldAccessExpressionContext = FieldAccessExpressionContext; 
NaviParser.IntersectionExpressionContext = IntersectionExpressionContext; 
NaviParser.UnionExpressionContext = UnionExpressionContext; 
NaviParser.ExpressionContext = ExpressionContext; 
NaviParser.ArgsContext = ArgsContext; 
NaviParser.FieldsContext = FieldsContext; 
NaviParser.FieldContext = FieldContext; 
