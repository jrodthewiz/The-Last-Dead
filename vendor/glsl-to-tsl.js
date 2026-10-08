// node_modules/three/examples/jsm/transpiler/Linker.js
var Block = class {
  constructor(node, parent = null) {
    this.node = node;
    this.parent = parent;
    this.properties = {};
  }
  setProperty(name, value) {
    this.properties[name] = value;
  }
  getProperty(name) {
    let value = this.properties[name];
    if (value === void 0 && this.parent !== null) {
      value = this.parent.getProperty(name);
    }
    return value;
  }
};
var Linker = class {
  constructor() {
    this.block = null;
  }
  addBlock(node) {
    this.block = new Block(node, this.block);
  }
  removeBlock(node) {
    if (this.block === null || this.block.node !== node) {
      throw new Error("No block to remove or block mismatch.");
    }
    this.block = this.block.parent;
  }
  processVariables(node) {
    this.block.setProperty(node.name, node);
    if (node.value) {
      this.processExpression(node.value);
    }
  }
  processUniform(node) {
    this.block.setProperty(node.name, node);
  }
  processVarying(node) {
    this.block.setProperty(node.name, node);
  }
  evalProperty(node) {
    let property = "";
    if (node.isAccessor) {
      property += node.property;
    }
    return property;
  }
  processExpression(node) {
    if (node.isAccessor) {
      const property = this.block.getProperty(this.evalProperty(node));
      if (property) {
        node.linker.reference = property;
        property.linker.accesses.push(node);
      }
    } else if (node.isNumber || node.isString) {
    } else if (node.isOperator) {
      this.processExpression(node.left);
      this.processExpression(node.right);
      if (node.isAssignment) {
        const property = this.block.getProperty(this.evalProperty(node.left));
        if (property) {
          property.linker.assignments.push(node);
        }
      }
    } else if (node.isFunctionCall) {
      for (const param of node.params) {
        this.processExpression(param);
      }
    } else if (node.isReturn) {
      if (node.value) this.processExpression(node.value);
    } else if (node.isDiscard || node.isBreak || node.isContinue) {
    } else if (node.isAccessorElements) {
      this.processExpression(node.object);
      for (const element of node.elements) {
        this.processExpression(element.value);
      }
    } else if (node.isDynamicElement || node.isStaticElement) {
      this.processExpression(node.value);
    } else if (node.isFor || node.isWhile) {
      this.processForWhile(node);
    } else if (node.isSwitch) {
      this.processSwitch(node);
    } else if (node.isVariableDeclaration) {
      this.processVariables(node);
    } else if (node.isUniform) {
      this.processUniform(node);
    } else if (node.isVarying) {
      this.processVarying(node);
    } else if (node.isTernary) {
      this.processExpression(node.cond);
      this.processExpression(node.left);
      this.processExpression(node.right);
    } else if (node.isConditional) {
      this.processConditional(node);
    } else if (node.isUnary) {
      this.processExpression(node.expression);
      if (node.isAssignment) {
        if (node.parent.hasAssignment !== true) {
          node.after = false;
        }
        const property = this.block.getProperty(this.evalProperty(node.expression));
        if (property) {
          property.linker.assignments.push(node);
        }
      }
    }
  }
  processBody(body) {
    for (const statement of body) {
      this.processExpression(statement);
    }
  }
  processConditional(node) {
    this.processExpression(node.cond);
    this.processBody(node.body);
    let current = node;
    while (current.elseConditional) {
      if (current.elseConditional.cond) {
        this.processExpression(current.elseConditional.cond);
      }
      this.processBody(current.elseConditional.body);
      current = current.elseConditional;
    }
  }
  processForWhile(node) {
    if (node.initialization) this.processExpression(node.initialization);
    if (node.condition) this.processExpression(node.condition);
    if (node.afterthought) this.processExpression(node.afterthought);
    this.processBody(node.body);
  }
  processSwitch(switchNode) {
    this.processExpression(switchNode.discriminant);
    for (const switchCase of switchNode.cases) {
      if (switchCase.isDefault !== true) {
        for (const condition of switchCase.conditions) {
          this.processExpression(condition);
        }
      }
      this.processBody(switchCase.body);
    }
  }
  processFunction(node) {
    this.addBlock(node);
    for (const param of node.params) {
      this.block.setProperty(param.name, param);
    }
    this.processBody(node.body);
    this.removeBlock(node);
  }
  process(ast) {
    this.addBlock(ast);
    for (const statement of ast.body) {
      if (statement.isFunctionDeclaration) {
        this.processFunction(statement);
      } else {
        this.processExpression(statement);
      }
    }
    this.removeBlock(ast);
  }
};
var Linker_default = Linker;

// node_modules/three/examples/jsm/transpiler/Transpiler.js
var Transpiler = class {
  /**
   * Constructs a new transpiler.
   *
   * @param {GLSLDecoder} decoder - The GLSL decoder.
   * @param {TSLEncoder} encoder - The TSL encoder.
   */
  constructor(decoder, encoder) {
    this.decoder = decoder;
    this.encoder = encoder;
    this.linker = new Linker_default();
  }
  /**
   * Parses the given GLSL source and returns TSL syntax.
   *
   * @param {string} source - The GLSL source.
   * @return {string} The TSL code.
   */
  parse(source) {
    const ast = this.decoder.parse(source);
    this.linker.process(ast);
    return this.encoder.emit(ast);
  }
};
var Transpiler_default = Transpiler;

// node_modules/three/examples/jsm/transpiler/TranspilerUtils.js
function isExpression(st) {
  return st.isFunctionDeclaration !== true && st.isFor !== true && st.isWhile !== true && st.isConditional !== true && st.isSwitch !== true && st.isStructDefinition !== true;
}
function isPrimitive(value) {
  return /^(true|false|-?(\d|\.\d))/.test(value);
}
function isBuiltinType(str) {
  return /^(void|bool|float|u?int|mat[234]|mat[234]x[234]|(u|i|b)?vec[234])$/.test(str);
}
function toFloatType(type) {
  if (/^(i?int)$/.test(type)) return "float";
  const vecMatch = /^(i|u)?vec([234])$/.exec(type);
  if (vecMatch) return "vec" + vecMatch[2];
  return type;
}

// node_modules/three/examples/jsm/transpiler/AST.js
var ASTNode = class {
  constructor() {
    this.isASTNode = true;
    this.linker = {
      reference: null,
      accesses: [],
      assignments: []
    };
    this.parent = null;
  }
  get isNumericExpression() {
    return false;
  }
  get hasAssignment() {
    if (this.isAssignment === true) {
      return true;
    }
    if (this.parent === null) {
      return false;
    }
    return this.parent.hasAssignment;
  }
  getType() {
    return this.type || null;
  }
  getProgram() {
    let current = this;
    while (current.parent !== null) {
      current = current.parent;
    }
    return current.isProgram === true ? current : null;
  }
  getParent(parents = []) {
    if (this.parent === null) {
      return parents;
    }
    parents.push(this.parent);
    return this.parent.getParent(parents);
  }
  initialize() {
    for (const key in this) {
      if (this[key] && this[key].isASTNode) {
        this[key].parent = this;
      } else if (Array.isArray(this[key])) {
        const array = this[key];
        for (const item of array) {
          if (item && item.isASTNode) {
            item.parent = this;
          }
        }
      }
    }
  }
};
var Comment = class extends ASTNode {
  constructor(comment) {
    super();
    this.comment = comment;
    this.isComment = true;
    this.initialize();
  }
};
var Program = class extends ASTNode {
  constructor(body = []) {
    super();
    this.body = body;
    this.structTypes = /* @__PURE__ */ new Map();
    this.isProgram = true;
    this.initialize();
  }
};
var VariableDeclaration = class extends ASTNode {
  constructor(type, name, value = null, next = null, immutable = false) {
    super();
    this.type = type;
    this.name = name;
    this.value = value;
    this.next = next;
    this.immutable = immutable;
    this.isVariableDeclaration = true;
    this.initialize();
  }
  get isAssignment() {
    return this.value !== null;
  }
};
var Uniform = class extends ASTNode {
  constructor(type, name) {
    super();
    this.type = type;
    this.name = name;
    this.isUniform = true;
    this.initialize();
  }
};
var Varying = class extends ASTNode {
  constructor(type, name) {
    super();
    this.type = type;
    this.name = name;
    this.isVarying = true;
    this.initialize();
  }
};
var FunctionParameter = class extends ASTNode {
  constructor(type, name, qualifier = null, immutable = true) {
    super();
    this.type = type;
    this.name = name;
    this.qualifier = qualifier;
    this.immutable = immutable;
    this.isFunctionParameter = true;
    this.initialize();
  }
};
var FunctionDeclaration = class extends ASTNode {
  constructor(type, name, params = [], body = []) {
    super();
    this.type = type;
    this.name = name;
    this.params = params;
    this.body = body;
    this.isFunctionDeclaration = true;
    this.initialize();
  }
};
var Ternary = class extends ASTNode {
  constructor(cond, left, right) {
    super();
    this.cond = cond;
    this.left = left;
    this.right = right;
    this.isTernary = true;
    this.initialize();
  }
};
var Operator = class extends ASTNode {
  constructor(type, left, right) {
    super();
    this.type = type;
    this.left = left;
    this.right = right;
    this.isOperator = true;
    this.initialize();
  }
  get isAssignment() {
    return /^(=|\+=|-=|\*=|\/=|%=|<<=|>>=|>>>=|&=|\^=|\|=)$/.test(this.type);
  }
  get isNumericExpression() {
    if (this.left.isNumericExpression && this.right.isNumericExpression) {
      return true;
    }
    return false;
  }
  getType() {
    const leftType = this.left.getType();
    const rightType = this.right.getType();
    if (leftType === rightType) {
      return leftType;
    } else if (toFloatType(leftType) === toFloatType(rightType)) {
      return toFloatType(leftType);
    }
    return null;
  }
};
var Unary = class extends ASTNode {
  constructor(type, expression, after = false) {
    super();
    this.type = type;
    this.expression = expression;
    this.after = after;
    this.isUnary = true;
    this.initialize();
  }
  get isAssignment() {
    return /^(\+\+|--)$/.test(this.type);
  }
  get isNumericExpression() {
    if (this.expression.isNumber) {
      return true;
    }
    return false;
  }
};
var Number = class extends ASTNode {
  constructor(value, type = "float") {
    super();
    this.type = type;
    this.value = value;
    this.isNumber = true;
    this.initialize();
  }
  get isNumericExpression() {
    return true;
  }
};
var String = class extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
    this.isString = true;
    this.initialize();
  }
};
var Conditional = class extends ASTNode {
  constructor(cond = null, body = []) {
    super();
    this.cond = cond;
    this.body = body;
    this.elseConditional = null;
    this.isConditional = true;
    this.initialize();
  }
};
var FunctionCall = class extends ASTNode {
  constructor(name, params = []) {
    super();
    this.name = name;
    this.params = params;
    this.isFunctionCall = true;
    this.initialize();
  }
};
var Return = class extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
    this.isReturn = true;
    this.initialize();
  }
};
var Discard = class extends ASTNode {
  constructor() {
    super();
    this.isDiscard = true;
    this.initialize();
  }
};
var Continue = class extends ASTNode {
  constructor() {
    super();
    this.isContinue = true;
    this.initialize();
  }
};
var Break = class extends ASTNode {
  constructor() {
    super();
    this.isBreak = true;
    this.initialize();
  }
};
var Accessor = class extends ASTNode {
  constructor(property) {
    super();
    this.property = property;
    this.isAccessor = true;
    this.initialize();
  }
  getType() {
    if (this.linker.reference) {
      return this.linker.reference.getType();
    }
    return super.getType();
  }
};
var StaticElement = class extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
    this.isStaticElement = true;
    this.initialize();
  }
};
var DynamicElement = class extends ASTNode {
  constructor(value) {
    super();
    this.value = value;
    this.isDynamicElement = true;
    this.initialize();
  }
};
var AccessorElements = class extends ASTNode {
  constructor(object, elements = []) {
    super();
    this.object = object;
    this.elements = elements;
    this.isAccessorElements = true;
    this.initialize();
  }
};
var For = class extends ASTNode {
  constructor(initialization, condition, afterthought, body = []) {
    super();
    this.initialization = initialization;
    this.condition = condition;
    this.afterthought = afterthought;
    this.body = body;
    this.isFor = true;
    this.initialize();
  }
};
var While = class extends ASTNode {
  constructor(condition, body = []) {
    super();
    this.condition = condition;
    this.body = body;
    this.isWhile = true;
    this.initialize();
  }
};
var Switch = class extends ASTNode {
  constructor(discriminant, cases) {
    super();
    this.discriminant = discriminant;
    this.cases = cases;
    this.isSwitch = true;
    this.initialize();
  }
};
var SwitchCase = class extends ASTNode {
  constructor(body, conditions = null) {
    super();
    this.body = body;
    this.conditions = conditions;
    this.isDefault = conditions === null ? true : false;
    this.isSwitchCase = true;
    this.initialize();
  }
};
var StructMember = class {
  constructor(type, name) {
    this.type = type;
    this.name = name;
    this.isStructMember = true;
  }
};
var StructDefinition = class extends ASTNode {
  constructor(name, members = []) {
    super();
    this.name = name;
    this.members = members;
    this.isStructDefinition = true;
    this.initialize();
  }
};

// node_modules/three/examples/jsm/transpiler/GLSLDecoder.js
var unaryOperators = [
  "+",
  "-",
  "~",
  "!",
  "++",
  "--"
];
var arithmeticOperators = [
  "*",
  "/",
  "%",
  "+",
  "-",
  "<<",
  ">>"
];
var precedenceOperators = [
  [","],
  ["=", "+=", "-=", "*=", "/=", "%=", "^=", "&=", "|=", "<<=", ">>="],
  ["?"],
  ["||"],
  ["^^"],
  ["&&"],
  ["|"],
  ["^"],
  ["&"],
  ["==", "!="],
  ["<", ">", "<=", ">="],
  ["<<", ">>"],
  ["+", "-"],
  ["*", "/", "%"]
];
var associativityRightToLeft = [
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "^=",
  "&=",
  "|=",
  "<<=",
  ">>=",
  ",",
  "?",
  ":"
];
var glslToTSL = {
  inversesqrt: "inverseSqrt"
};
var samplers = ["sampler1D", "sampler2D", "sampler2DArray", "sampler2DShadow", "sampler2DArrayShadow", "isampler2D", "isampler2DArray", "usampler2D", "usampler2DArray"];
var samplersCube = ["samplerCube", "samplerCubeShadow", "usamplerCube", "isamplerCube"];
var samplers3D = ["sampler3D", "isampler3D", "usampler3D"];
var spaceRegExp = /^((\t| )\n*)+/;
var lineRegExp = /^\n+/;
var commentRegExp = /^\/\*[\s\S]*?\*\//;
var inlineCommentRegExp = /^\/\/.*?(?=\n|$)/;
var numberRegExp = /^((0x\w+)|(\.?\d+\.?\d*((e-?\d+)|\w)?))/;
var stringDoubleRegExp = /^(\"((?:[^"\\]|\\.)*)\")/;
var stringSingleRegExp = /^(\'((?:[^'\\]|\\.)*)\')/;
var literalRegExp = /^[A-Za-z](\w|\.)*/;
var operatorsRegExp = new RegExp("^(\\" + [
  "<<=",
  ">>=",
  "++",
  "--",
  "<<",
  ">>",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "^^",
  "^=",
  "|=",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ".",
  ",",
  ";",
  "!",
  "=",
  "~",
  "*",
  "/",
  "%",
  "+",
  "-",
  "<",
  ">",
  "&",
  "^",
  "|",
  "?",
  ":",
  "#"
].join("$").split("").join("\\").replace(/\\\$/g, "|") + ")");
function getFunctionName(str) {
  return glslToTSL[str] || str;
}
function getGroupDelta(str) {
  if (str === "(" || str === "[" || str === "{") return 1;
  if (str === ")" || str === "]" || str === "}") return -1;
  return 0;
}
var Token = class _Token {
  constructor(tokenizer, type, str, pos) {
    this.tokenizer = tokenizer;
    this.type = type;
    this.str = str;
    this.pos = pos;
    this.isTag = false;
    this.tags = null;
  }
  get endPos() {
    return this.pos + this.str.length;
  }
  get isNumber() {
    return this.type === _Token.NUMBER;
  }
  get isString() {
    return this.type === _Token.STRING;
  }
  get isLiteral() {
    return this.type === _Token.LITERAL;
  }
  get isOperator() {
    return this.type === _Token.OPERATOR;
  }
};
Token.LINE = "line";
Token.COMMENT = "comment";
Token.NUMBER = "number";
Token.STRING = "string";
Token.LITERAL = "literal";
Token.OPERATOR = "operator";
var TokenParserList = [
  { type: Token.LINE, regexp: lineRegExp, isTag: true },
  { type: Token.COMMENT, regexp: commentRegExp, isTag: true },
  { type: Token.COMMENT, regexp: inlineCommentRegExp, isTag: true },
  { type: Token.NUMBER, regexp: numberRegExp },
  { type: Token.STRING, regexp: stringDoubleRegExp, group: 2 },
  { type: Token.STRING, regexp: stringSingleRegExp, group: 2 },
  { type: Token.LITERAL, regexp: literalRegExp },
  { type: Token.OPERATOR, regexp: operatorsRegExp }
];
var Tokenizer = class {
  constructor(source) {
    this.source = source;
    this.position = 0;
    this.tokens = [];
  }
  tokenize() {
    let token = this.readToken();
    while (token) {
      this.tokens.push(token);
      token = this.readToken();
    }
    return this;
  }
  skip(...params) {
    let remainingCode = this.source.slice(this.position);
    let i = params.length;
    while (i--) {
      const skip = params[i].exec(remainingCode);
      const skipLength = skip ? skip[0].length : 0;
      if (skipLength > 0) {
        this.position += skipLength;
        remainingCode = this.source.slice(this.position);
        i = params.length;
      }
    }
    return remainingCode;
  }
  nextToken() {
    const remainingCode = this.skip(spaceRegExp);
    for (var i = 0; i < TokenParserList.length; i++) {
      const parser = TokenParserList[i];
      const result = parser.regexp.exec(remainingCode);
      if (result) {
        const token = new Token(this, parser.type, result[parser.group || 0], this.position);
        token.isTag = parser.isTag;
        this.position += result[0].length;
        return token;
      }
    }
  }
  readToken() {
    let token = this.nextToken();
    if (token && token.isTag) {
      const tags = [];
      while (token.isTag) {
        tags.push(token);
        token = this.nextToken();
        if (!token) return;
      }
      token.tags = tags;
    }
    return token;
  }
};
var GLSLDecoder = class {
  constructor() {
    this.index = 0;
    this.tokenizer = null;
    this.keywords = [];
    this.structTypes = /* @__PURE__ */ new Map();
    this.addPolyfill("gl_FragCoord", "vec3 gl_FragCoord = vec3( screenCoordinate.x, screenCoordinate.y.oneMinus(), screenCoordinate.z );");
  }
  addPolyfill(name, polyfill) {
    this.keywords.push({ name, polyfill });
    return this;
  }
  get tokens() {
    return this.tokenizer.tokens;
  }
  readToken() {
    return this.tokens[this.index++];
  }
  getToken(offset = 0) {
    return this.tokens[this.index + offset];
  }
  getTokensUntil(str, tokens, offset = 0) {
    const output = [];
    let groupIndex = 0;
    for (let i = offset; i < tokens.length; i++) {
      const token = tokens[i];
      groupIndex += getGroupDelta(token.str);
      output.push(token);
      if (groupIndex === 0 && token.str === str) {
        break;
      }
    }
    return output;
  }
  readTokensUntil(str) {
    const tokens = this.getTokensUntil(str, this.tokens, this.index);
    this.index += tokens.length;
    return tokens;
  }
  parseExpressionFromTokens(tokens) {
    if (tokens.length === 0) return null;
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    let groupIndex = 0;
    for (const operators of precedenceOperators) {
      const parseToken = (i, inverse = false) => {
        const token = tokens[i];
        groupIndex += getGroupDelta(token.str);
        if (!token.isOperator || i === 0 || i === tokens.length - 1) return;
        if (inverse && arithmeticOperators.includes(tokens[i - 1].str)) {
          return;
        }
        if (groupIndex === 0 && operators.includes(token.str)) {
          const operator = token.str;
          if (operator === "?") {
            const conditionTokens = tokens.slice(0, i);
            const leftTokens = this.getTokensUntil(":", tokens, i + 1).slice(0, -1);
            const rightTokens = tokens.slice(i + leftTokens.length + 2);
            const condition = this.parseExpressionFromTokens(conditionTokens);
            const left = this.parseExpressionFromTokens(leftTokens);
            const right = this.parseExpressionFromTokens(rightTokens);
            return new Ternary(condition, left, right);
          } else {
            const left = this.parseExpressionFromTokens(tokens.slice(0, i));
            const right = this.parseExpressionFromTokens(tokens.slice(i + 1, tokens.length));
            return new Operator(operator, left, right);
          }
        }
        if (inverse) {
          if (groupIndex > 0) {
            return this.parseExpressionFromTokens(tokens.slice(i));
          }
        } else {
          if (groupIndex < 0) {
            return this.parseExpressionFromTokens(tokens.slice(0, i));
          }
        }
      };
      const isRightAssociative = operators.some((op) => associativityRightToLeft.includes(op));
      if (isRightAssociative) {
        for (let i = 0; i < tokens.length; i++) {
          const result = parseToken(i);
          if (result) return result;
        }
      } else {
        for (let i = tokens.length - 1; i >= 0; i--) {
          const result = parseToken(i, true);
          if (result) return result;
        }
      }
    }
    if (firstToken.isOperator) {
      for (const operator of unaryOperators) {
        if (firstToken.str === operator) {
          const right = this.parseExpressionFromTokens(tokens.slice(1));
          return new Unary(operator, right);
        }
      }
    }
    if (lastToken.isOperator) {
      for (const operator of unaryOperators) {
        if (lastToken.str === operator) {
          const left = this.parseExpressionFromTokens(tokens.slice(0, tokens.length - 1));
          return new Unary(operator, left, true);
        }
      }
    }
    if (firstToken.str === "(") {
      const leftTokens = this.getTokensUntil(")", tokens);
      const left = this.parseExpressionFromTokens(leftTokens.slice(1, leftTokens.length - 1));
      const operator = tokens[leftTokens.length];
      if (operator) {
        const rightTokens = tokens.slice(leftTokens.length + 1);
        const right = this.parseExpressionFromTokens(rightTokens);
        return new Operator(operator.str, left, right);
      }
      return left;
    }
    if (firstToken.isNumber) {
      let type;
      const isHex = /^(0x)/.test(firstToken.str);
      if (isHex) type = "int";
      else if (/u$|U$/.test(firstToken.str)) type = "uint";
      else if (/f|e|\./.test(firstToken.str)) type = "float";
      else type = "int";
      let str = firstToken.str.replace(/u|U|i$/, "");
      if (isHex === false) {
        str = str.replace(/f$/, "");
      }
      return new Number(str, type);
    } else if (firstToken.isString) {
      return new String(firstToken.str);
    } else if (firstToken.isLiteral) {
      if (firstToken.str === "return") {
        return new Return(this.parseExpressionFromTokens(tokens.slice(1)));
      } else if (firstToken.str === "discard") {
        return new Discard();
      } else if (firstToken.str === "continue") {
        return new Continue();
      } else if (firstToken.str === "break") {
        return new Break();
      }
      const secondToken = tokens[1];
      if (secondToken) {
        if (secondToken.str === "(") {
          const internalTokens = this.getTokensUntil(")", tokens, 1).slice(1, -1);
          const paramsTokens = this.parseFunctionParametersFromTokens(internalTokens);
          const functionCall = new FunctionCall(getFunctionName(firstToken.str), paramsTokens);
          const accessTokens = tokens.slice(3 + internalTokens.length);
          if (accessTokens.length > 0) {
            const elements = this.parseAccessorElementsFromTokens(accessTokens);
            return new AccessorElements(functionCall, elements);
          }
          return functionCall;
        } else if (secondToken.str === "[") {
          const elements = this.parseAccessorElementsFromTokens(tokens.slice(1));
          return new AccessorElements(new Accessor(firstToken.str), elements);
        }
      }
      return new Accessor(firstToken.str);
    }
  }
  parseAccessorElementsFromTokens(tokens) {
    const elements = [];
    let currentTokens = tokens;
    while (currentTokens.length > 0) {
      const token = currentTokens[0];
      if (token.str === "[") {
        const accessorTokens = this.getTokensUntil("]", currentTokens);
        const element = this.parseExpressionFromTokens(accessorTokens.slice(1, accessorTokens.length - 1));
        currentTokens = currentTokens.slice(accessorTokens.length);
        elements.push(new DynamicElement(element));
      } else if (token.str === ".") {
        const accessorTokens = currentTokens.slice(1, 2);
        const element = this.parseExpressionFromTokens(accessorTokens);
        currentTokens = currentTokens.slice(2);
        elements.push(new StaticElement(element));
      } else {
        console.error("Unknown accessor expression", token);
        break;
      }
    }
    return elements;
  }
  parseFunctionParametersFromTokens(tokens) {
    if (tokens.length === 0) return [];
    const expression = this.parseExpressionFromTokens(tokens);
    const params = [];
    let current = expression;
    while (current.type === ",") {
      params.push(current.left);
      current = current.right;
    }
    params.push(current);
    return params;
  }
  parseExpression() {
    const tokens = this.readTokensUntil(";");
    const exp = this.parseExpressionFromTokens(tokens.slice(0, tokens.length - 1));
    return exp;
  }
  parseFunctionParams(tokens) {
    const params = [];
    for (let i = 0; i < tokens.length; i++) {
      const immutable = tokens[i].str === "const";
      if (immutable) i++;
      let qualifier = tokens[i].str;
      if (/^(in|out|inout)$/.test(qualifier)) {
        i++;
      } else {
        qualifier = null;
      }
      const type = tokens[i++].str;
      const name = tokens[i++].str;
      params.push(new FunctionParameter(type, name, qualifier, immutable));
      if (tokens[i] && tokens[i].str !== ",") throw new Error('Expected ","');
    }
    return params;
  }
  parseFunction() {
    const type = this.readToken().str;
    const name = this.readToken().str;
    const paramsTokens = this.readTokensUntil(")");
    const params = this.parseFunctionParams(paramsTokens.slice(1, paramsTokens.length - 1));
    const body = this.parseBlock();
    const func = new FunctionDeclaration(type, name, params, body);
    return func;
  }
  parseVariablesFromToken(tokens, type) {
    let index = 0;
    const immutable = tokens[0].str === "const";
    if (immutable) index++;
    type = type || tokens[index++].str;
    const name = tokens[index++].str;
    const token = tokens[index];
    let init = null;
    let next = null;
    if (token) {
      const initTokens = this.getTokensUntil(",", tokens, index);
      if (initTokens[0].str === "=") {
        const expressionTokens = initTokens.slice(1);
        if (expressionTokens[expressionTokens.length - 1].str === ",") expressionTokens.pop();
        init = this.parseExpressionFromTokens(expressionTokens);
      }
      const nextTokens = tokens.slice(initTokens.length + (index - 1));
      if (nextTokens[0] && nextTokens[0].str === ",") {
        next = this.parseVariablesFromToken(nextTokens.slice(1), type);
      }
    }
    const variable = new VariableDeclaration(type, name, init, next, immutable);
    return variable;
  }
  parseVariables() {
    const tokens = this.readTokensUntil(";");
    return this.parseVariablesFromToken(tokens.slice(0, tokens.length - 1));
  }
  parseUniform() {
    const tokens = this.readTokensUntil(";");
    let type = tokens[1].str;
    const name = tokens[2].str;
    if (samplers.includes(type)) type = "texture";
    else if (samplersCube.includes(type)) type = "cubeTexture";
    else if (samplers3D.includes(type)) type = "texture3D";
    return new Uniform(type, name);
  }
  parseVarying() {
    const tokens = this.readTokensUntil(";");
    const type = tokens[1].str;
    const name = tokens[2].str;
    return new Varying(type, name);
  }
  parseStructDefinition() {
    const tokens = this.readTokensUntil(";");
    const structName = tokens[1].str;
    if (tokens[2].str !== "{") {
      throw new Error("Expected '{' after struct name ");
    }
    const structMembers = [];
    for (let i = 3; i < tokens.length - 2; i += 3) {
      const typeToken = tokens[i];
      const nameToken = tokens[i + 1];
      if (typeToken.type != "literal" || nameToken.type != "literal") {
        throw new Error("Invalid struct declaration");
      }
      if (tokens[i + 2].str !== ";") {
        throw new Error("Missing ';' after struct member name");
      }
      const member = new StructMember(typeToken.str, nameToken.str);
      structMembers.push(member);
    }
    if (tokens[tokens.length - 2].str !== "}") {
      throw new Error("Missing closing '}' for struct " + structName);
    }
    const definition = new StructDefinition(structName, structMembers);
    this.structTypes.set(structName, definition);
    return definition;
  }
  parseReturn() {
    this.readToken();
    const expression = this.parseExpression();
    return new Return(expression);
  }
  parseWhile() {
    this.readToken();
    const conditionTokens = this.readTokensUntil(")").slice(1, -1);
    const condition = this.parseExpressionFromTokens(conditionTokens);
    let body;
    if (this.getToken().str === "{") {
      body = this.parseBlock();
    } else {
      body = [this.parseExpression()];
    }
    const statement = new While(condition, body);
    return statement;
  }
  parseFor() {
    this.readToken();
    const forTokens = this.readTokensUntil(")").slice(1, -1);
    const initializationTokens = this.getTokensUntil(";", forTokens, 0).slice(0, -1);
    const conditionTokens = this.getTokensUntil(";", forTokens, initializationTokens.length + 1).slice(0, -1);
    const afterthoughtTokens = forTokens.slice(initializationTokens.length + conditionTokens.length + 2);
    let initialization;
    const firstToken = initializationTokens[0];
    if (firstToken && (isBuiltinType(firstToken.str) || this.structTypes.has(firstToken.str))) {
      initialization = this.parseVariablesFromToken(initializationTokens);
    } else {
      initialization = this.parseExpressionFromTokens(initializationTokens);
    }
    const condition = this.parseExpressionFromTokens(conditionTokens);
    const afterthought = this.parseExpressionFromTokens(afterthoughtTokens);
    let body;
    if (this.getToken().str === "{") {
      body = this.parseBlock();
    } else {
      body = [this.parseExpression()];
    }
    const statement = new For(initialization, condition, afterthought, body);
    return statement;
  }
  parseSwitch() {
    this.readToken();
    const switchDeterminantTokens = this.readTokensUntil(")");
    const discriminant = this.parseExpressionFromTokens(switchDeterminantTokens.slice(1, -1));
    if (this.getToken().str !== "{") {
      throw new Error("Expected '{' after switch(...) ");
    }
    this.readToken();
    const cases = this.parseSwitchCases();
    const switchStatement = new Switch(discriminant, cases);
    return switchStatement;
  }
  parseSwitchCases() {
    const cases = [];
    let token = this.getToken();
    let conditions = null;
    const isCase = (token2) => token2.str === "case" || token2.str === "default";
    while (isCase(token)) {
      this.readToken();
      if (token.str === "case") {
        const caseTokens = this.readTokensUntil(":");
        const caseStatement = this.parseExpressionFromTokens(caseTokens.slice(0, -1));
        conditions = conditions || [];
        conditions.push(caseStatement);
      } else {
        this.readTokensUntil(":");
        conditions = null;
      }
      token = this.getToken();
      if (isCase(token)) {
        continue;
      }
      cases.push(new SwitchCase(this.parseBlock(), conditions));
      token = this.getToken();
      conditions = null;
    }
    return cases;
  }
  parseIf() {
    const parseIfExpression = () => {
      this.readToken();
      const condTokens = this.readTokensUntil(")");
      return this.parseExpressionFromTokens(condTokens.slice(1, condTokens.length - 1));
    };
    const parseIfBlock = () => {
      let body;
      if (this.getToken().str === "{") {
        body = this.parseBlock();
      } else {
        body = [this.parseExpression()];
      }
      return body;
    };
    const conditional = new Conditional(parseIfExpression(), parseIfBlock());
    let current = conditional;
    while (this.getToken() && this.getToken().str === "else") {
      this.readToken();
      const previous = current;
      let expression = null;
      if (this.getToken().str === "if") {
        expression = parseIfExpression();
      }
      current = new Conditional(expression, parseIfBlock());
      current.parent = previous;
      previous.elseConditional = current;
    }
    return conditional;
  }
  parseBlock() {
    const body = [];
    const firstToken = this.getToken();
    if (firstToken.str === "{") {
      this.readToken();
    }
    let groupIndex = 0;
    while (this.index < this.tokens.length) {
      const token = this.getToken();
      let statement = null;
      groupIndex += getGroupDelta(token.str);
      if (groupIndex === 0 && (token.str === "case" || token.str === "default")) {
        return body;
      } else if (groupIndex < 0) {
        this.readToken();
        return body;
      }
      if (token.tags) {
        let lastStatement = null;
        for (const tag of token.tags) {
          if (tag.type === Token.COMMENT) {
            const str = tag.str.replace(/\t/g, "");
            if (!lastStatement || lastStatement.isComment !== true) {
              lastStatement = new Comment(str);
              body.push(lastStatement);
            } else {
              lastStatement.comment += "\n" + str;
            }
          }
        }
      }
      if (token.isLiteral || token.isOperator) {
        if (token.str === "const") {
          statement = this.parseVariables();
        } else if (token.str === "uniform") {
          statement = this.parseUniform();
        } else if (token.str === "varying") {
          statement = this.parseVarying();
        } else if (token.str === "struct") {
          statement = this.parseStructDefinition();
        } else if (isBuiltinType(token.str) || this.structTypes.has(token.str)) {
          if (this.getToken(2).str === "(") {
            statement = this.parseFunction();
          } else {
            statement = this.parseVariables();
          }
        } else if (token.str === "return") {
          statement = this.parseReturn();
        } else if (token.str === "if") {
          statement = this.parseIf();
        } else if (token.str === "for") {
          statement = this.parseFor();
        } else if (token.str === "while") {
          statement = this.parseWhile();
        } else if (token.str === "switch") {
          statement = this.parseSwitch();
        } else {
          statement = this.parseExpression();
        }
      }
      if (statement) {
        body.push(statement);
      } else {
        this.index++;
      }
    }
    return body;
  }
  parse(source) {
    let polyfill = "";
    for (const keyword of this.keywords) {
      if (new RegExp(`(^|\\b)${keyword.name}($|\\b)`, "gm").test(source)) {
        polyfill += keyword.polyfill + "\n";
      }
    }
    if (polyfill) {
      polyfill = "// Polyfills\n\n" + polyfill + "\n";
    }
    this.index = 0;
    this.tokenizer = new Tokenizer(polyfill + source).tokenize();
    const body = this.parseBlock();
    const program = new Program(body);
    program.structTypes = this.structTypes;
    return program;
  }
};
var GLSLDecoder_default = GLSLDecoder;

// node_modules/three/examples/jsm/transpiler/TSLEncoder.js
import { REVISION } from "./three.webgpu.js";
import * as TSL from "./three.tsl.js";
var opLib = {
  "=": "assign",
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
  "%": "remainder",
  "<": "lessThan",
  ">": "greaterThan",
  "<=": "lessThanEqual",
  ">=": "greaterThanEqual",
  "==": "equal",
  "!=": "notEqual",
  "&&": "and",
  "||": "or",
  "^^": "xor",
  "&": "bitAnd",
  "|": "bitOr",
  "^": "bitXor",
  "<<": "shiftLeft",
  ">>": "shiftRight",
  "+=": "addAssign",
  "-=": "subAssign",
  "*=": "mulAssign",
  "/=": "divAssign",
  "%=": "remainderAssign",
  "^=": "bitXorAssign",
  "&=": "bitAndAssign",
  "|=": "bitOrAssign",
  "<<=": "shiftLeftAssign",
  ">>=": "shiftRightAssign"
};
var unaryLib = {
  "+": "",
  // positive
  "-": "negate",
  "~": "bitNot",
  "!": "not",
  "++": "increment",
  // incrementBefore
  "--": "decrement"
  // decrementBefore
};
var textureLookupFunctions = ["texture", "texture2D", "texture3D", "textureCube", "textureLod", "texelFetch", "textureGrad"];
var TSLEncoder = class {
  constructor() {
    this.tab = "";
    this.imports = /* @__PURE__ */ new Set();
    this.global = /* @__PURE__ */ new Set();
    this.overloadings = /* @__PURE__ */ new Map();
    this.iife = false;
    this.reference = false;
    this.block = null;
  }
  addImport(name) {
    name = name.split(".")[0];
    if (TSL[name] !== void 0 && this.global.has(name) === false) {
      this.imports.add(name);
    }
  }
  emitUniform(node) {
    let code = `const ${node.name} = `;
    this.global.add(node.name);
    if (this.reference === true) {
      this.addImport("reference");
      code += `reference( 'value', '${node.type}', uniforms[ '${node.name}' ] )`;
    } else {
      if (node.type === "texture") {
        this.addImport("texture");
        code += "texture( /* <THREE.Texture> */ )";
      } else if (node.type === "cubeTexture") {
        this.addImport("cubeTexture");
        code += "cubeTexture( /* <THREE.CubeTexture> */ )";
      } else if (node.type === "texture3D") {
        this.addImport("texture3D");
        code += "texture3D( /* <THREE.Data3DTexture> */ )";
      } else {
        this.addImport("uniform");
        code += `uniform( '${node.type}' )`;
      }
    }
    return code;
  }
  emitExpression(node, output = null) {
    let code;
    if (node.isAccessor) {
      if (node.linker.reference === null) {
        this.addImport(node.property);
      }
      code = node.property;
    } else if (node.isNumber) {
      code = node.value;
    } else if (node.isString) {
      code = "'" + node.value + "'";
    } else if (node.isOperator) {
      const opFn = opLib[node.type] || node.type;
      const left = this.emitExpression(node.left, output);
      const right = this.emitExpression(node.right, output);
      if (node.isNumericExpression) {
        return left + " " + node.type + " " + right;
      }
      if (isPrimitive(left)) {
        code = opFn + "( " + left + ", " + right + " )";
        this.addImport(opFn);
      } else if (opFn === ".") {
        code = left + opFn + right;
      } else {
        code = left + "." + opFn + "( " + right + " )";
      }
    } else if (node.isFunctionCall) {
      const params = [];
      for (const parameter of node.params) {
        params.push(this.emitExpression(parameter));
      }
      if (textureLookupFunctions.includes(node.name)) {
        code = `${params[0]}.sample( ${params[1]} )`;
        if (node.name === "texture" || node.name === "texture2D" || node.name === "texture3D" || node.name === "textureCube") {
          if (params.length === 3) {
            code += `.bias( ${params[2]} )`;
          }
        } else if (node.name === "textureLod") {
          code += `.level( ${params[2]} )`;
        } else if (node.name === "textureGrad") {
          code += `.grad( ${params[2]}, ${params[3]} )`;
        } else if (node.name === "texelFetch") {
          code += ".setSampler( false )";
        }
      } else {
        this.addImport(node.name);
        const paramsStr = params.length > 0 ? " " + params.join(", ") + " " : "";
        code = `${node.name}(${paramsStr})`;
      }
    } else if (node.isReturn) {
      code = "return";
      if (node.value) {
        code += " " + this.emitExpression(node.value);
      }
    } else if (node.isDiscard) {
      this.addImport("Discard");
      code = "Discard()";
    } else if (node.isBreak) {
      this.addImport("Break");
      code = "Break()";
    } else if (node.isContinue) {
      this.addImport("Continue");
      code = "Continue()";
    } else if (node.isAccessorElements) {
      code = this.emitExpression(node.object);
      for (const element of node.elements) {
        if (element.isStaticElement) {
          code += "." + this.emitExpression(element.value);
        } else if (element.isDynamicElement) {
          const value = this.emitExpression(element.value);
          if (isPrimitive(value)) {
            code += `[ ${value} ]`;
          } else {
            code += `.element( ${value} )`;
          }
        }
      }
    } else if (node.isDynamicElement) {
      code = this.emitExpression(node.value);
    } else if (node.isStaticElement) {
      code = this.emitExpression(node.value);
    } else if (node.isFor) {
      code = this.emitFor(node);
    } else if (node.isWhile) {
      code = this.emitWhile(node);
    } else if (node.isSwitch) {
      code = this.emitSwitch(node);
    } else if (node.isVariableDeclaration) {
      code = this.emitVariables(node);
    } else if (node.isUniform) {
      code = this.emitUniform(node);
    } else if (node.isVarying) {
      code = this.emitVarying(node);
    } else if (node.isStructDefinition) {
      code = this.emitStructDefinition(node);
    } else if (node.isTernary) {
      code = this.emitTernary(node);
    } else if (node.isConditional) {
      code = this.emitConditional(node);
    } else if (node.isUnary && node.expression.isNumber && node.type === "-") {
      code = "- " + node.expression.value;
      if (node.expression.type !== "float") {
        code = node.expression.type + "( " + code + " )";
        this.addImport(node.expression.type);
      }
    } else if (node.isUnary) {
      let type = unaryLib[node.type];
      if (node.hasAssignment) {
        if (node.after === false && (node.type === "++" || node.type === "--")) {
          type += "Before";
        }
      }
      const exp = this.emitExpression(node.expression);
      if (isPrimitive(exp)) {
        this.addImport(type);
        code = type + "( " + exp + " )";
      } else {
        code = exp + "." + type + "()";
      }
    } else {
      console.warn("Unknown node type", node);
    }
    if (!code) code = "/* unknown statement */";
    return code;
  }
  emitBody(body) {
    let code = "";
    this.tab += "	";
    for (const statement of body) {
      code += this.emitExtraLine(statement, body);
      if (statement.isComment) {
        code += this.emitComment(statement, body);
        continue;
      }
      if (this.block && this.block.isSwitchCase) {
        if (statement.isBreak) continue;
      }
      code += this.tab + this.emitExpression(statement);
      if (code.slice(-1) !== "}") code += ";";
      code += "\n";
    }
    code = code.slice(0, -1);
    this.tab = this.tab.slice(0, -1);
    return code;
  }
  emitTernary(node) {
    const condStr = this.emitExpression(node.cond);
    const leftStr = this.emitExpression(node.left);
    const rightStr = this.emitExpression(node.right);
    this.addImport("select");
    return `select( ${condStr}, ${leftStr}, ${rightStr} )`;
  }
  emitConditional(node) {
    const condStr = this.emitExpression(node.cond);
    const bodyStr = this.emitBody(node.body);
    let ifStr = `If( ${condStr}, () => {

${bodyStr}

${this.tab}} )`;
    let current = node;
    while (current.elseConditional) {
      const elseBodyStr = this.emitBody(current.elseConditional.body);
      if (current.elseConditional.cond) {
        const elseCondStr = this.emitExpression(current.elseConditional.cond);
        ifStr += `.ElseIf( ${elseCondStr}, () => {

${elseBodyStr}

${this.tab}} )`;
      } else {
        ifStr += `.Else( () => {

${elseBodyStr}

${this.tab}} )`;
      }
      current = current.elseConditional;
    }
    this.imports.add("If");
    return ifStr;
  }
  emitLoop(node) {
    const start = this.emitExpression(node.initialization.value);
    const end = this.emitExpression(node.condition.right);
    const name = node.initialization.name;
    const type = node.initialization.type;
    const condition = node.condition.type;
    const nameParam = name !== "i" ? `, name: '${name}'` : "";
    const typeParam = type !== "int" ? `, type: '${type}'` : "";
    const conditionParam = condition !== "<" ? `, condition: '${condition}'` : "";
    let updateParam = "";
    if (node.afterthought.isUnary) {
      if (node.afterthought.type !== "++") {
        updateParam = `, update: '${node.afterthought.type}'`;
      }
    } else if (node.afterthought.isOperator) {
      if (node.afterthought.right.isAccessor || node.afterthought.right.isNumber) {
        updateParam = `, update: ${this.emitExpression(node.afterthought.right)}`;
      } else {
        updateParam = `, update: ( { i } ) => ${this.emitExpression(node.afterthought)}`;
      }
    }
    let loopStr = `Loop( { start: ${start}, end: ${end + nameParam + typeParam + conditionParam + updateParam} }, ( { ${name} } ) => {

`;
    loopStr += this.emitBody(node.body) + "\n\n";
    loopStr += this.tab + "} )";
    this.imports.add("Loop");
    return loopStr;
  }
  emitSwitch(switchNode) {
    const discriminantString = this.emitExpression(switchNode.discriminant);
    this.tab += "	";
    let switchString = `Switch( ${discriminantString} )
${this.tab}`;
    const previousBlock = this.block;
    for (const switchCase of switchNode.cases) {
      this.block = switchCase;
      let caseBodyString;
      if (!switchCase.isDefault) {
        const caseConditions = [];
        for (const condition of switchCase.conditions) {
          caseConditions.push(this.emitExpression(condition));
        }
        caseBodyString = this.emitBody(switchCase.body);
        switchString += `.Case( ${caseConditions.join(", ")}, `;
      } else {
        caseBodyString = this.emitBody(switchCase.body);
        switchString += ".Default( ";
      }
      switchString += `() => {

${caseBodyString}

${this.tab}} )`;
    }
    this.block = previousBlock;
    this.tab = this.tab.slice(0, -1);
    this.imports.add("Switch");
    return switchString;
  }
  emitFor(node) {
    const { initialization, condition, afterthought } = node;
    if (initialization && initialization.isVariableDeclaration && initialization.next === null && (condition && condition.left.isAccessor && condition.left.property === initialization.name) && (afterthought && (afterthought.isUnary && initialization.name === afterthought.expression.property || afterthought.isOperator && initialization.name === afterthought.left.property))) {
      return this.emitLoop(node);
    }
    return this.emitForWhile(node);
  }
  emitForWhile(node) {
    const initialization = this.emitExpression(node.initialization);
    const condition = this.emitExpression(node.condition);
    const afterthought = this.emitExpression(node.afterthought);
    this.tab += "	";
    let forStr = "{\n\n" + this.tab + initialization + ";\n\n";
    forStr += `${this.tab}Loop( ${condition}, () => {

`;
    forStr += this.emitBody(node.body) + "\n\n";
    forStr += this.tab + "	" + afterthought + ";\n\n";
    forStr += this.tab + "} )\n\n";
    this.tab = this.tab.slice(0, -1);
    forStr += this.tab + "}";
    this.imports.add("Loop");
    return forStr;
  }
  emitWhile(node) {
    const condition = this.emitExpression(node.condition);
    let whileStr = `Loop( ${condition}, () => {

`;
    whileStr += this.emitBody(node.body) + "\n\n";
    whileStr += this.tab + "} )";
    this.imports.add("Loop");
    return whileStr;
  }
  emitVariables(node, isRoot = true) {
    const { name, type, value, next } = node;
    let varStr = isRoot ? "const " : "";
    varStr += name;
    if (value) {
      let valueStr = this.emitExpression(value);
      if (value.isNumericExpression) {
        valueStr = `${type}( ${valueStr} )`;
        this.addImport(type);
      }
      varStr += " = " + valueStr;
    } else {
      const program = node.getProgram();
      if (program.structTypes.has(type)) {
        varStr += ` = ${type}()`;
      } else {
        varStr += ` = property( '${type}' )`;
        this.addImport("property");
      }
    }
    if (next) {
      varStr += ", " + this.emitVariables(next, false);
    }
    if (node.needsToVar) {
      varStr = varStr + ".toVar()";
    }
    return varStr;
  }
  emitVarying(node) {
    const { name, type } = node;
    this.addImport("varying");
    this.addImport(type);
    return `const ${name} = varying( ${type}(), '${name}' )`;
  }
  emitStructDefinition(node) {
    const { name, members } = node;
    this.addImport("struct");
    let structString = `const ${name} = struct( {
`;
    for (let i = 0; i < members.length; i += 1) {
      const member = members[i];
      structString += `${this.tab}	${member.name}: '${member.type}'`;
      if (i != members.length - 1) {
        structString += ",\n";
      }
    }
    structString += `
${this.tab}}, '${name}' )`;
    return structString;
  }
  emitOverloadingFunction(nodes) {
    const { name } = nodes[0];
    this.addImport("overloadingFn");
    const prefix = this.iife === false ? "export " : "";
    return `${prefix}const ${name} = /*@__PURE__*/ overloadingFn( [ ${nodes.map((node) => node.name + "_" + nodes.indexOf(node)).join(", ")} ] );
`;
  }
  emitFunction(node) {
    const { name, type } = node;
    const params = [];
    const inputs = [];
    const mutableParams = [];
    let hasPointer = false;
    for (const param of node.params) {
      let name2 = param.name;
      if (param.linker.assignments.length > 0) {
        name2 = name2 + "_immutable";
        mutableParams.push(param);
      }
      if (param.qualifier) {
        if (param.qualifier === "inout" || param.qualifier === "out") {
          hasPointer = true;
        }
      }
      inputs.push(param.name + ": '" + param.type + "'");
      params.push(name2);
    }
    for (const param of mutableParams) {
      const mutableParam = new VariableDeclaration(param.type, param.name, new Accessor(param.name + "_immutable"), null, true);
      mutableParam.parent = param.parent;
      mutableParam.linker.assignments.push(mutableParam);
      mutableParam.needsToVar = true;
      node.body.unshift(mutableParam);
    }
    const paramsStr = params.length > 0 ? " [ " + params.join(", ") + " ] " : "";
    const bodyStr = this.emitBody(node.body);
    let fnName = name;
    let overloadingNodes = null;
    if (this.overloadings.has(name)) {
      const overloadings = this.overloadings.get(name);
      if (overloadings.length > 1) {
        const index = overloadings.indexOf(node);
        fnName += "_" + index;
        if (index === overloadings.length - 1) {
          overloadingNodes = overloadings;
        }
      }
    }
    const prefix = this.iife === false ? "export " : "";
    let funcStr = `${prefix}const ${fnName} = /*@__PURE__*/ Fn( (${paramsStr}) => {

${bodyStr}

${this.tab}}`;
    if (node.layout !== false && hasPointer === false) {
      const inputsStr = inputs.length > 0 ? inputs.join(", ") + ", " : "";
      funcStr += ", { " + inputsStr + "return: '" + type + "' }";
    }
    funcStr += " );\n";
    this.imports.add("Fn");
    this.global.add(node.name);
    if (overloadingNodes !== null) {
      funcStr += "\n" + this.emitOverloadingFunction(overloadingNodes);
    }
    return funcStr;
  }
  emitComment(statement, body) {
    const index = body.indexOf(statement);
    const previous = body[index - 1];
    const next = body[index + 1];
    let output = "";
    if (previous && isExpression(previous)) {
      output += "\n";
    }
    output += this.tab + statement.comment.replace(/\n/g, "\n" + this.tab) + "\n";
    if (next && isExpression(next)) {
      output += "\n";
    }
    return output;
  }
  emitExtraLine(statement, body) {
    const index = body.indexOf(statement);
    const previous = body[index - 1];
    if (previous === void 0) return "";
    if (statement.isReturn) return "\n";
    const lastExp = isExpression(previous);
    const currExp = isExpression(statement);
    if (lastExp !== currExp || !lastExp && !currExp) return "\n";
    return "";
  }
  emit(ast) {
    let code = "\n";
    if (this.iife) this.tab += "	";
    const overloadings = this.overloadings;
    for (const statement of ast.body) {
      if (statement.isFunctionDeclaration) {
        if (overloadings.has(statement.name) === false) {
          overloadings.set(statement.name, []);
        }
        overloadings.get(statement.name).push(statement);
      }
    }
    for (const statement of ast.body) {
      code += this.emitExtraLine(statement, ast.body);
      if (statement.isComment) {
        code += this.emitComment(statement, ast.body);
        continue;
      }
      if (statement.isFunctionDeclaration) {
        code += this.tab + this.emitFunction(statement);
      } else {
        code += this.tab + this.emitExpression(statement) + ";\n";
      }
    }
    const imports = [...this.imports];
    const exports = [...this.global];
    let header = "// Three.js Transpiler r" + REVISION + "\n\n";
    let footer = "";
    if (this.iife) {
      header += "( function ( TSL, uniforms ) {\n\n";
      header += imports.length > 0 ? "	const { " + imports.join(", ") + " } = TSL;\n" : "";
      footer += exports.length > 0 ? "	return { " + exports.join(", ") + " };\n" : "";
      footer += "\n} );";
    } else {
      header += imports.length > 0 ? "import { " + imports.join(", ") + " } from 'three/tsl';\n" : "";
    }
    return header + code + footer;
  }
};
var TSLEncoder_default = TSLEncoder;
export {
  GLSLDecoder_default as GLSLDecoder,
  TSLEncoder_default as TSLEncoder,
  Transpiler_default as Transpiler
};
