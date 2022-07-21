// Generated from Navi.g4 by ANTLR 4.10.1
// jshint ignore: start
import antlr4 from 'antlr4';
import NaviListener from './NaviListener.js';
const serializedATN = [4,1,27,258,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
20,7,20,2,21,7,21,2,22,7,22,1,0,5,0,48,8,0,10,0,12,0,51,9,0,1,0,1,0,1,1,
5,1,56,8,1,10,1,12,1,59,9,1,1,1,1,1,1,1,1,2,1,2,1,2,1,2,3,2,68,8,2,1,3,1,
3,1,3,1,3,3,3,74,8,3,1,4,1,4,1,4,1,4,1,4,1,4,1,4,1,4,3,4,84,8,4,1,5,1,5,
1,5,1,5,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,6,5,6,98,8,6,10,6,12,6,101,9,6,1,6,
3,6,104,8,6,5,6,106,8,6,10,6,12,6,109,9,6,1,6,1,6,1,7,1,7,3,7,115,8,7,1,
8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,3,8,129,8,8,1,9,1,9,1,9,1,
9,1,9,1,9,5,9,137,8,9,10,9,12,9,140,9,9,1,9,3,9,143,8,9,3,9,145,8,9,1,9,
1,9,1,10,1,10,3,10,151,8,10,1,10,1,10,3,10,155,8,10,1,10,1,10,1,10,1,11,
1,11,1,11,1,11,1,11,1,12,1,12,3,12,167,8,12,1,13,1,13,5,13,171,8,13,10,13,
12,13,174,9,13,1,13,1,13,1,13,1,14,1,14,1,14,5,14,182,8,14,10,14,12,14,185,
9,14,1,15,1,15,1,15,5,15,190,8,15,10,15,12,15,193,9,15,1,16,1,16,1,16,5,
16,198,8,16,10,16,12,16,201,9,16,1,17,1,17,1,18,1,18,1,18,5,18,208,8,18,
10,18,12,18,211,9,18,1,18,3,18,214,8,18,3,18,216,8,18,1,19,1,19,1,19,1,19,
5,19,222,8,19,10,19,12,19,225,9,19,1,19,3,19,228,8,19,3,19,230,8,19,1,19,
1,19,1,20,1,20,1,20,1,20,1,21,1,21,1,21,1,21,5,21,242,8,21,10,21,12,21,245,
9,21,1,21,3,21,248,8,21,3,21,250,8,21,1,21,1,21,1,22,1,22,1,22,1,22,1,22,
0,0,23,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,0,
0,272,0,49,1,0,0,0,2,57,1,0,0,0,4,67,1,0,0,0,6,69,1,0,0,0,8,75,1,0,0,0,10,
85,1,0,0,0,12,91,1,0,0,0,14,112,1,0,0,0,16,128,1,0,0,0,18,130,1,0,0,0,20,
150,1,0,0,0,22,159,1,0,0,0,24,164,1,0,0,0,26,168,1,0,0,0,28,178,1,0,0,0,
30,186,1,0,0,0,32,194,1,0,0,0,34,202,1,0,0,0,36,215,1,0,0,0,38,217,1,0,0,
0,40,233,1,0,0,0,42,237,1,0,0,0,44,253,1,0,0,0,46,48,3,4,2,0,47,46,1,0,0,
0,48,51,1,0,0,0,49,47,1,0,0,0,49,50,1,0,0,0,50,52,1,0,0,0,51,49,1,0,0,0,
52,53,5,0,0,1,53,1,1,0,0,0,54,56,3,4,2,0,55,54,1,0,0,0,56,59,1,0,0,0,57,
55,1,0,0,0,57,58,1,0,0,0,58,60,1,0,0,0,59,57,1,0,0,0,60,61,3,34,17,0,61,
62,5,0,0,1,62,3,1,0,0,0,63,68,3,6,3,0,64,68,3,8,4,0,65,68,3,10,5,0,66,68,
3,12,6,0,67,63,1,0,0,0,67,64,1,0,0,0,67,65,1,0,0,0,67,66,1,0,0,0,68,5,1,
0,0,0,69,70,5,17,0,0,70,73,5,24,0,0,71,74,5,1,0,0,72,74,3,38,19,0,73,71,
1,0,0,0,73,72,1,0,0,0,74,7,1,0,0,0,75,76,5,14,0,0,76,77,5,24,0,0,77,83,3,
42,21,0,78,79,5,2,0,0,79,80,3,34,17,0,80,81,5,1,0,0,81,84,1,0,0,0,82,84,
3,26,13,0,83,78,1,0,0,0,83,82,1,0,0,0,84,9,1,0,0,0,85,86,5,15,0,0,86,87,
5,24,0,0,87,88,5,2,0,0,88,89,3,34,17,0,89,90,5,1,0,0,90,11,1,0,0,0,91,92,
5,18,0,0,92,93,5,24,0,0,93,107,5,3,0,0,94,99,3,14,7,0,95,96,5,4,0,0,96,98,
3,14,7,0,97,95,1,0,0,0,98,101,1,0,0,0,99,97,1,0,0,0,99,100,1,0,0,0,100,103,
1,0,0,0,101,99,1,0,0,0,102,104,5,4,0,0,103,102,1,0,0,0,103,104,1,0,0,0,104,
106,1,0,0,0,105,94,1,0,0,0,106,109,1,0,0,0,107,105,1,0,0,0,107,108,1,0,0,
0,108,110,1,0,0,0,109,107,1,0,0,0,110,111,5,5,0,0,111,13,1,0,0,0,112,114,
5,24,0,0,113,115,3,38,19,0,114,113,1,0,0,0,114,115,1,0,0,0,115,15,1,0,0,
0,116,129,5,20,0,0,117,129,5,21,0,0,118,129,5,22,0,0,119,129,5,23,0,0,120,
129,3,18,9,0,121,129,3,22,11,0,122,129,3,24,12,0,123,129,3,26,13,0,124,125,
5,6,0,0,125,126,3,34,17,0,126,127,5,7,0,0,127,129,1,0,0,0,128,116,1,0,0,
0,128,117,1,0,0,0,128,118,1,0,0,0,128,119,1,0,0,0,128,120,1,0,0,0,128,121,
1,0,0,0,128,122,1,0,0,0,128,123,1,0,0,0,128,124,1,0,0,0,129,17,1,0,0,0,130,
131,5,16,0,0,131,132,3,34,17,0,132,144,5,3,0,0,133,138,3,20,10,0,134,135,
5,4,0,0,135,137,3,20,10,0,136,134,1,0,0,0,137,140,1,0,0,0,138,136,1,0,0,
0,138,139,1,0,0,0,139,142,1,0,0,0,140,138,1,0,0,0,141,143,5,4,0,0,142,141,
1,0,0,0,142,143,1,0,0,0,143,145,1,0,0,0,144,133,1,0,0,0,144,145,1,0,0,0,
145,146,1,0,0,0,146,147,5,5,0,0,147,19,1,0,0,0,148,151,5,19,0,0,149,151,
3,34,17,0,150,148,1,0,0,0,150,149,1,0,0,0,151,154,1,0,0,0,152,153,5,13,0,
0,153,155,5,24,0,0,154,152,1,0,0,0,154,155,1,0,0,0,155,156,1,0,0,0,156,157,
5,8,0,0,157,158,3,34,17,0,158,21,1,0,0,0,159,160,5,24,0,0,160,161,5,6,0,
0,161,162,3,36,18,0,162,163,5,7,0,0,163,23,1,0,0,0,164,166,5,24,0,0,165,
167,3,38,19,0,166,165,1,0,0,0,166,167,1,0,0,0,167,25,1,0,0,0,168,172,5,3,
0,0,169,171,3,4,2,0,170,169,1,0,0,0,171,174,1,0,0,0,172,170,1,0,0,0,172,
173,1,0,0,0,173,175,1,0,0,0,174,172,1,0,0,0,175,176,3,34,17,0,176,177,5,
5,0,0,177,27,1,0,0,0,178,183,3,16,8,0,179,180,5,9,0,0,180,182,5,24,0,0,181,
179,1,0,0,0,182,185,1,0,0,0,183,181,1,0,0,0,183,184,1,0,0,0,184,29,1,0,0,
0,185,183,1,0,0,0,186,191,3,28,14,0,187,188,5,10,0,0,188,190,3,28,14,0,189,
187,1,0,0,0,190,193,1,0,0,0,191,189,1,0,0,0,191,192,1,0,0,0,192,31,1,0,0,
0,193,191,1,0,0,0,194,199,3,30,15,0,195,196,5,11,0,0,196,198,3,30,15,0,197,
195,1,0,0,0,198,201,1,0,0,0,199,197,1,0,0,0,199,200,1,0,0,0,200,33,1,0,0,
0,201,199,1,0,0,0,202,203,3,32,16,0,203,35,1,0,0,0,204,209,3,34,17,0,205,
206,5,4,0,0,206,208,3,34,17,0,207,205,1,0,0,0,208,211,1,0,0,0,209,207,1,
0,0,0,209,210,1,0,0,0,210,213,1,0,0,0,211,209,1,0,0,0,212,214,5,4,0,0,213,
212,1,0,0,0,213,214,1,0,0,0,214,216,1,0,0,0,215,204,1,0,0,0,215,216,1,0,
0,0,216,37,1,0,0,0,217,229,5,3,0,0,218,223,3,40,20,0,219,220,5,4,0,0,220,
222,3,40,20,0,221,219,1,0,0,0,222,225,1,0,0,0,223,221,1,0,0,0,223,224,1,
0,0,0,224,227,1,0,0,0,225,223,1,0,0,0,226,228,5,4,0,0,227,226,1,0,0,0,227,
228,1,0,0,0,228,230,1,0,0,0,229,218,1,0,0,0,229,230,1,0,0,0,230,231,1,0,
0,0,231,232,5,5,0,0,232,39,1,0,0,0,233,234,5,24,0,0,234,235,5,12,0,0,235,
236,3,34,17,0,236,41,1,0,0,0,237,249,5,6,0,0,238,243,3,44,22,0,239,240,5,
4,0,0,240,242,3,44,22,0,241,239,1,0,0,0,242,245,1,0,0,0,243,241,1,0,0,0,
243,244,1,0,0,0,244,247,1,0,0,0,245,243,1,0,0,0,246,248,5,4,0,0,247,246,
1,0,0,0,247,248,1,0,0,0,248,250,1,0,0,0,249,238,1,0,0,0,249,250,1,0,0,0,
250,251,1,0,0,0,251,252,5,7,0,0,252,43,1,0,0,0,253,254,5,24,0,0,254,255,
5,12,0,0,255,256,3,34,17,0,256,45,1,0,0,0,29,49,57,67,73,83,99,103,107,114,
128,138,142,144,150,154,166,172,183,191,199,209,213,215,223,227,229,243,
247,249];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.PredictionContextCache();

export default class NaviParser extends antlr4.Parser {

    static grammarFileName = "Navi.g4";
    static literalNames = [ null, "';'", "'='", "'{'", "','", "'}'", "'('", 
                            "')'", "'=>'", "'.'", "'&'", "'|'", "':'", "'as'", 
                            "'def'", "'let'", "'match'", "'struct'", "'enum'", 
                            "'_'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, "As", "Def", 
                             "Let", "Match", "Struct", "Enum", "Discard", 
                             "IntInterval", "Interval", "Number", "String", 
                             "Identifier", "Space", "LineComment", "BlockComment" ];
    static ruleNames = [ "definitionDocument", "expressionDocument", "definition", 
                         "structDefinition", "functionDefinition", "variableDefinition", 
                         "enumDefinition", "enumVariant", "primaryExpression", 
                         "matchExpression", "matchArm", "functionCall", 
                         "named", "scopeExpression", "fieldAccessExpression", 
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
	        this.state = 49;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.Def) | (1 << NaviParser.Let) | (1 << NaviParser.Struct) | (1 << NaviParser.Enum))) !== 0)) {
	            this.state = 46;
	            this.definition();
	            this.state = 51;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 52;
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
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 57;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.Def) | (1 << NaviParser.Let) | (1 << NaviParser.Struct) | (1 << NaviParser.Enum))) !== 0)) {
	            this.state = 54;
	            this.definition();
	            this.state = 59;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 60;
	        this.expression();
	        this.state = 61;
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
	        this.state = 67;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.Struct:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 63;
	            this.structDefinition();
	            break;
	        case NaviParser.Def:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 64;
	            this.functionDefinition();
	            break;
	        case NaviParser.Let:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 65;
	            this.variableDefinition();
	            break;
	        case NaviParser.Enum:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 66;
	            this.enumDefinition();
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
	        this.state = 69;
	        this.match(NaviParser.Struct);
	        this.state = 70;
	        this.match(NaviParser.Identifier);
	        this.state = 73;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.T__0:
	            this.state = 71;
	            this.match(NaviParser.T__0);
	            break;
	        case NaviParser.T__2:
	            this.state = 72;
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
	        this.state = 75;
	        this.match(NaviParser.Def);
	        this.state = 76;
	        this.match(NaviParser.Identifier);
	        this.state = 77;
	        this.parameters();
	        this.state = 83;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.T__1:
	            this.state = 78;
	            this.match(NaviParser.T__1);
	            this.state = 79;
	            this.expression();
	            this.state = 80;
	            this.match(NaviParser.T__0);
	            break;
	        case NaviParser.T__2:
	            this.state = 82;
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
	        this.state = 85;
	        this.match(NaviParser.Let);
	        this.state = 86;
	        this.match(NaviParser.Identifier);
	        this.state = 87;
	        this.match(NaviParser.T__1);
	        this.state = 88;
	        this.expression();
	        this.state = 89;
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



	enumDefinition() {
	    let localctx = new EnumDefinitionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, NaviParser.RULE_enumDefinition);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 91;
	        this.match(NaviParser.Enum);
	        this.state = 92;
	        this.match(NaviParser.Identifier);
	        this.state = 93;
	        this.match(NaviParser.T__2);
	        this.state = 107;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.Identifier) {
	            this.state = 94;
	            this.enumVariant();
	            this.state = 99;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,5,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 95;
	                    this.match(NaviParser.T__3);
	                    this.state = 96;
	                    this.enumVariant(); 
	                }
	                this.state = 101;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,5,this._ctx);
	            }

	            this.state = 103;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__3) {
	                this.state = 102;
	                this.match(NaviParser.T__3);
	            }

	            this.state = 109;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 110;
	        this.match(NaviParser.T__4);
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



	enumVariant() {
	    let localctx = new EnumVariantContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, NaviParser.RULE_enumVariant);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 112;
	        this.match(NaviParser.Identifier);
	        this.state = 114;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.T__2) {
	            this.state = 113;
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



	primaryExpression() {
	    let localctx = new PrimaryExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, NaviParser.RULE_primaryExpression);
	    try {
	        this.state = 128;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,9,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 116;
	            this.match(NaviParser.IntInterval);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 117;
	            this.match(NaviParser.Interval);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 118;
	            this.match(NaviParser.Number);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 119;
	            this.match(NaviParser.String);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 120;
	            this.matchExpression();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 121;
	            this.functionCall();
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 122;
	            this.named();
	            break;

	        case 8:
	            this.enterOuterAlt(localctx, 8);
	            this.state = 123;
	            this.scopeExpression();
	            break;

	        case 9:
	            this.enterOuterAlt(localctx, 9);
	            this.state = 124;
	            this.match(NaviParser.T__5);
	            this.state = 125;
	            this.expression();
	            this.state = 126;
	            this.match(NaviParser.T__6);
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
	    this.enterRule(localctx, 18, NaviParser.RULE_matchExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 130;
	        this.match(NaviParser.Match);
	        this.state = 131;
	        this.expression();
	        this.state = 132;
	        this.match(NaviParser.T__2);
	        this.state = 144;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.T__2) | (1 << NaviParser.T__5) | (1 << NaviParser.Match) | (1 << NaviParser.Discard) | (1 << NaviParser.IntInterval) | (1 << NaviParser.Interval) | (1 << NaviParser.Number) | (1 << NaviParser.String) | (1 << NaviParser.Identifier))) !== 0)) {
	            this.state = 133;
	            this.matchArm();
	            this.state = 138;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,10,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 134;
	                    this.match(NaviParser.T__3);
	                    this.state = 135;
	                    this.matchArm(); 
	                }
	                this.state = 140;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,10,this._ctx);
	            }

	            this.state = 142;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__3) {
	                this.state = 141;
	                this.match(NaviParser.T__3);
	            }

	        }

	        this.state = 146;
	        this.match(NaviParser.T__4);
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
	    this.enterRule(localctx, 20, NaviParser.RULE_matchArm);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 150;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case NaviParser.Discard:
	            this.state = 148;
	            this.match(NaviParser.Discard);
	            break;
	        case NaviParser.T__2:
	        case NaviParser.T__5:
	        case NaviParser.Match:
	        case NaviParser.IntInterval:
	        case NaviParser.Interval:
	        case NaviParser.Number:
	        case NaviParser.String:
	        case NaviParser.Identifier:
	            this.state = 149;
	            this.expression();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	        this.state = 154;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.As) {
	            this.state = 152;
	            this.match(NaviParser.As);
	            this.state = 153;
	            this.match(NaviParser.Identifier);
	        }

	        this.state = 156;
	        this.match(NaviParser.T__7);
	        this.state = 157;
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
	    this.enterRule(localctx, 22, NaviParser.RULE_functionCall);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 159;
	        this.match(NaviParser.Identifier);
	        this.state = 160;
	        this.match(NaviParser.T__5);
	        this.state = 161;
	        this.args();
	        this.state = 162;
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



	named() {
	    let localctx = new NamedContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, NaviParser.RULE_named);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 164;
	        this.match(NaviParser.Identifier);
	        this.state = 166;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,15,this._ctx);
	        if(la_===1) {
	            this.state = 165;
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
	    this.enterRule(localctx, 26, NaviParser.RULE_scopeExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 168;
	        this.match(NaviParser.T__2);
	        this.state = 172;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.Def) | (1 << NaviParser.Let) | (1 << NaviParser.Struct) | (1 << NaviParser.Enum))) !== 0)) {
	            this.state = 169;
	            this.definition();
	            this.state = 174;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 175;
	        this.expression();
	        this.state = 176;
	        this.match(NaviParser.T__4);
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
	    this.enterRule(localctx, 28, NaviParser.RULE_fieldAccessExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 178;
	        this.primaryExpression();
	        this.state = 183;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__8) {
	            this.state = 179;
	            this.match(NaviParser.T__8);
	            this.state = 180;
	            this.match(NaviParser.Identifier);
	            this.state = 185;
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
	    this.enterRule(localctx, 30, NaviParser.RULE_intersectionExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 186;
	        this.fieldAccessExpression();
	        this.state = 191;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__9) {
	            this.state = 187;
	            this.match(NaviParser.T__9);
	            this.state = 188;
	            this.fieldAccessExpression();
	            this.state = 193;
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
	    this.enterRule(localctx, 32, NaviParser.RULE_unionExpression);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 194;
	        this.intersectionExpression();
	        this.state = 199;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===NaviParser.T__10) {
	            this.state = 195;
	            this.match(NaviParser.T__10);
	            this.state = 196;
	            this.intersectionExpression();
	            this.state = 201;
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
	    this.enterRule(localctx, 34, NaviParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 202;
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
	    this.enterRule(localctx, 36, NaviParser.RULE_args);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 215;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << NaviParser.T__2) | (1 << NaviParser.T__5) | (1 << NaviParser.Match) | (1 << NaviParser.IntInterval) | (1 << NaviParser.Interval) | (1 << NaviParser.Number) | (1 << NaviParser.String) | (1 << NaviParser.Identifier))) !== 0)) {
	            this.state = 204;
	            this.expression();
	            this.state = 209;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,20,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 205;
	                    this.match(NaviParser.T__3);
	                    this.state = 206;
	                    this.expression(); 
	                }
	                this.state = 211;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,20,this._ctx);
	            }

	            this.state = 213;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__3) {
	                this.state = 212;
	                this.match(NaviParser.T__3);
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
	    this.enterRule(localctx, 38, NaviParser.RULE_fields);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 217;
	        this.match(NaviParser.T__2);
	        this.state = 229;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.Identifier) {
	            this.state = 218;
	            this.field();
	            this.state = 223;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,23,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 219;
	                    this.match(NaviParser.T__3);
	                    this.state = 220;
	                    this.field(); 
	                }
	                this.state = 225;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,23,this._ctx);
	            }

	            this.state = 227;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__3) {
	                this.state = 226;
	                this.match(NaviParser.T__3);
	            }

	        }

	        this.state = 231;
	        this.match(NaviParser.T__4);
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
	    this.enterRule(localctx, 40, NaviParser.RULE_field);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 233;
	        this.match(NaviParser.Identifier);
	        this.state = 234;
	        this.match(NaviParser.T__11);
	        this.state = 235;
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
	    this.enterRule(localctx, 42, NaviParser.RULE_parameters);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 237;
	        this.match(NaviParser.T__5);
	        this.state = 249;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===NaviParser.Identifier) {
	            this.state = 238;
	            this.parameter();
	            this.state = 243;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,26,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 239;
	                    this.match(NaviParser.T__3);
	                    this.state = 240;
	                    this.parameter(); 
	                }
	                this.state = 245;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,26,this._ctx);
	            }

	            this.state = 247;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            if(_la===NaviParser.T__3) {
	                this.state = 246;
	                this.match(NaviParser.T__3);
	            }

	        }

	        this.state = 251;
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



	parameter() {
	    let localctx = new ParameterContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 44, NaviParser.RULE_parameter);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 253;
	        this.match(NaviParser.Identifier);
	        this.state = 254;
	        this.match(NaviParser.T__11);
	        this.state = 255;
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
NaviParser.Enum = 18;
NaviParser.Discard = 19;
NaviParser.IntInterval = 20;
NaviParser.Interval = 21;
NaviParser.Number = 22;
NaviParser.String = 23;
NaviParser.Identifier = 24;
NaviParser.Space = 25;
NaviParser.LineComment = 26;
NaviParser.BlockComment = 27;

NaviParser.RULE_definitionDocument = 0;
NaviParser.RULE_expressionDocument = 1;
NaviParser.RULE_definition = 2;
NaviParser.RULE_structDefinition = 3;
NaviParser.RULE_functionDefinition = 4;
NaviParser.RULE_variableDefinition = 5;
NaviParser.RULE_enumDefinition = 6;
NaviParser.RULE_enumVariant = 7;
NaviParser.RULE_primaryExpression = 8;
NaviParser.RULE_matchExpression = 9;
NaviParser.RULE_matchArm = 10;
NaviParser.RULE_functionCall = 11;
NaviParser.RULE_named = 12;
NaviParser.RULE_scopeExpression = 13;
NaviParser.RULE_fieldAccessExpression = 14;
NaviParser.RULE_intersectionExpression = 15;
NaviParser.RULE_unionExpression = 16;
NaviParser.RULE_expression = 17;
NaviParser.RULE_args = 18;
NaviParser.RULE_fields = 19;
NaviParser.RULE_field = 20;
NaviParser.RULE_parameters = 21;
NaviParser.RULE_parameter = 22;

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

	enumDefinition() {
	    return this.getTypedRuleContext(EnumDefinitionContext,0);
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



class EnumDefinitionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_enumDefinition;
    }

	Enum() {
	    return this.getToken(NaviParser.Enum, 0);
	};

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	enumVariant = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(EnumVariantContext);
	    } else {
	        return this.getTypedRuleContext(EnumVariantContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterEnumDefinition(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitEnumDefinition(this);
		}
	}


}



class EnumVariantContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = NaviParser.RULE_enumVariant;
    }

	Identifier() {
	    return this.getToken(NaviParser.Identifier, 0);
	};

	fields() {
	    return this.getTypedRuleContext(FieldsContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.enterEnumVariant(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof NaviListener ) {
	        listener.exitEnumVariant(this);
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
NaviParser.EnumDefinitionContext = EnumDefinitionContext; 
NaviParser.EnumVariantContext = EnumVariantContext; 
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
