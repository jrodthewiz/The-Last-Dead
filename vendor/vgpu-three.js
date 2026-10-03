// node_modules/vgpu/dist/three/tsl-exports.js
import { nodeObject, wgsl, wgslFn } from "./three.tsl.js";

// node_modules/vgpu/dist/three/errors.js
function adapterError(code, message) {
  return Object.assign(new Error(message), { code });
}

// node_modules/vgpu/dist/three/wgsl-tokens.js
var pairedTokens = /* @__PURE__ */ new Set([
  "->",
  "<<",
  ">>",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||"
]);
function scanWgslTokens(source) {
  const tokens = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (/\s/u.test(source[cursor])) {
      cursor++;
      continue;
    }
    if (source.startsWith("//", cursor)) {
      cursor = source.indexOf("\n", cursor + 2);
      if (cursor === -1)
        break;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      cursor = skipBlockComment(source, cursor);
      continue;
    }
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipString(source, cursor);
      continue;
    }
    const start = cursor;
    if (/[A-Za-z_]/u.test(source[cursor])) {
      cursor++;
      while (/[A-Za-z0-9_]/u.test(source[cursor] ?? ""))
        cursor++;
      tokens.push({ kind: "identifier", text: source.slice(start, cursor), start, end: cursor });
      continue;
    }
    const pair = source.slice(cursor, cursor + 2);
    cursor += pairedTokens.has(pair) ? 2 : 1;
    tokens.push({ kind: "token", text: source.slice(start, cursor), start, end: cursor });
  }
  return tokens;
}
function skipString(source, start) {
  const quote = source[start];
  let cursor = start + 1;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote)
      return cursor + 1;
    cursor++;
  }
  return cursor;
}
function skipBlockComment(source, start) {
  let cursor = start;
  let depth = 0;
  while (cursor < source.length) {
    if (source.startsWith("/*", cursor)) {
      depth++;
      cursor += 2;
      continue;
    }
    if (source.startsWith("*/", cursor)) {
      depth--;
      cursor += 2;
      if (depth === 0)
        return cursor;
      continue;
    }
    cursor++;
  }
  return cursor;
}

// node_modules/vgpu/dist/three/function-signature.js
function readFunctionSignature(source, name, metadataIsAuthoritative) {
  const tokens = scanWgslTokens(source);
  const declarations = findFunctionDeclarations(tokens, name, metadataIsAuthoritative);
  if (declarations.length === 0) {
    const code = metadataIsAuthoritative ? "VGPU-THREE-TSL-SOURCE-INVALID" : "VGPU-THREE-TSL-EXPORT-NOT-FOUND";
    throw adapterError(code, `WGSL module has no function named ${name}.`);
  }
  if (declarations.length > 1) {
    const code = metadataIsAuthoritative ? "VGPU-THREE-TSL-SOURCE-INVALID" : "VGPU-THREE-TSL-EXPORT-AMBIGUOUS";
    throw adapterError(code, `WGSL module has multiple functions answering to ${name}.`);
  }
  const declaration = declarations[0];
  if (hasShaderStageAttribute(tokens, declaration.fnIndex)) {
    throw adapterError("VGPU-THREE-TSL-SIGNATURE-UNSUPPORTED", `WGSL function ${name} cannot be forwarded through Three TSL.`);
  }
  const parametersOpen = declaration.parametersOpen;
  const parametersClose = matchingToken(tokens, parametersOpen, "(", ")");
  if (parametersClose === -1) {
    throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL function ${name} has an unbalanced parameter list.`);
  }
  const returnType = readReturnType(tokens, parametersClose + 1, name);
  const parameters = readParameters(tokens, parametersOpen + 1, parametersClose, name);
  return { name: declaration.name, parameters, returnType };
}
function findFunctionDeclarations(tokens, requestedName, metadataIsAuthoritative) {
  const declarations = [];
  let depth = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.text === "{") {
      depth++;
      continue;
    }
    if (token.text === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0 || token.text !== "fn")
      continue;
    const declaredName = tokens[index + 1];
    if (declaredName?.kind !== "identifier" || tokens[index + 2]?.text !== "(")
      continue;
    if (!answersTo(declaredName.text, requestedName, metadataIsAuthoritative))
      continue;
    declarations.push({
      name: declaredName.text,
      fnIndex: index,
      parametersOpen: index + 2
    });
  }
  return declarations;
}
function answersTo(declaredName, requestedName, exact) {
  if (declaredName === requestedName)
    return true;
  if (exact)
    return false;
  const legacyPrefix = /^_vgsl_[0-9a-f]{8}__/u.exec(declaredName)?.[0];
  return legacyPrefix !== void 0 && declaredName.slice(legacyPrefix.length) === requestedName;
}
function readReturnType(tokens, start, functionName) {
  let cursor = start;
  if (tokens[cursor]?.text === "{") {
    throw adapterError("VGPU-THREE-TSL-SIGNATURE-UNSUPPORTED", `WGSL function ${functionName} does not return a value.`);
  }
  if (tokens[cursor]?.text !== "->") {
    throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL function ${functionName} has a malformed return type or no body.`);
  }
  cursor++;
  if (tokens[cursor]?.text === "@") {
    throw adapterError("VGPU-THREE-TSL-SIGNATURE-UNSUPPORTED", `WGSL function ${functionName} cannot be forwarded through Three TSL.`);
  }
  const typeStart = cursor;
  if (tokens[typeStart]?.kind !== "identifier") {
    throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL function ${functionName} has a malformed return type.`);
  }
  cursor++;
  if (tokens[cursor]?.text === "<") {
    const templateEnd = matchingTemplate(tokens, cursor);
    if (templateEnd === -1) {
      throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL function ${functionName} has a malformed return type.`);
    }
    cursor = templateEnd + 1;
  }
  const bodyStart = tokens[cursor];
  if (bodyStart?.text !== "{") {
    throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL function ${functionName} has a malformed return type or no body.`);
  }
  return normalizedTokenText(tokens.slice(typeStart, cursor));
}
function readParameters(tokens, start, end, functionName) {
  if (start === end)
    return [];
  const segments = [];
  let segmentStart = start;
  const nesting = [];
  for (let cursor = start; cursor < end; cursor++) {
    if (!updateNesting(nesting, tokens, cursor)) {
      throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL function ${functionName} has malformed parameters.`);
    }
    if (tokens[cursor]?.text === "," && nesting.length === 0) {
      segments.push([segmentStart, cursor]);
      segmentStart = cursor + 1;
    }
  }
  if (nesting.length !== 0) {
    throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL function ${functionName} has malformed parameters.`);
  }
  if (segmentStart < end)
    segments.push([segmentStart, end]);
  return segments.map(([segmentStart2, segmentEnd]) => {
    let colonIndex = segmentStart2;
    while (colonIndex < segmentEnd && tokens[colonIndex]?.text !== ":")
      colonIndex++;
    const nameToken = tokens[colonIndex - 1];
    const name = nameToken?.kind === "identifier" && colonIndex > segmentStart2 ? nameToken.text : "";
    const type = colonIndex === segmentEnd ? "" : normalizedTokenText(tokens.slice(colonIndex + 1, segmentEnd));
    if (name === "" || type === "") {
      throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL function ${functionName} has malformed parameters.`);
    }
    return { name, type };
  });
}
function normalizedTokenText(tokens) {
  const first = tokens[0];
  if (first === void 0)
    return "";
  let result = first.text;
  for (let index = 1; index < tokens.length; index++) {
    const previous = tokens[index - 1];
    const current = tokens[index];
    if (current.start > previous.end)
      result += " ";
    result += current.text;
  }
  return result;
}
function matchingToken(tokens, openAt, open, close) {
  let depth = 0;
  for (let cursor = openAt; cursor < tokens.length; cursor++) {
    if (tokens[cursor]?.text === open)
      depth++;
    else if (tokens[cursor]?.text === close && --depth === 0)
      return cursor;
  }
  return -1;
}
function matchingTemplate(tokens, openAt) {
  const nesting = [];
  for (let cursor = openAt; cursor < tokens.length; cursor++) {
    if (!updateNesting(nesting, tokens, cursor))
      return -1;
    if (nesting.length === 0)
      return cursor;
  }
  return -1;
}
function updateNesting(nesting, tokens, cursor) {
  const text = tokens[cursor].text;
  if (text === "(" || text === "[") {
    nesting.push(text);
    return true;
  }
  if (opensTemplate(nesting, tokens, cursor)) {
    nesting.push(text);
    return true;
  }
  if (text === ")")
    return popExpected(nesting, "(");
  if (text === "]")
    return popExpected(nesting, "[");
  if (text === ">" && nesting.at(-1) === "<") {
    nesting.pop();
    return true;
  }
  if (text === ">>" && nesting.at(-1) === "<" && nesting.at(-2) === "<") {
    nesting.pop();
    nesting.pop();
  }
  return true;
}
function opensTemplate(nesting, tokens, cursor) {
  if (tokens[cursor]?.text !== "<" || tokens[cursor - 1]?.kind !== "identifier")
    return false;
  const enclosing = nesting.at(-1);
  return enclosing !== "(" && enclosing !== "[";
}
function popExpected(nesting, expected) {
  if (nesting.at(-1) !== expected)
    return false;
  nesting.pop();
  return true;
}
function hasShaderStageAttribute(tokens, fnIndex) {
  for (let index = fnIndex - 1; index >= 0; index--) {
    const text = tokens[index].text;
    if (text === ";" || text === "{" || text === "}")
      return false;
    if (["vertex", "fragment", "compute"].includes(text) && tokens[index - 1]?.text === "@") {
      return true;
    }
  }
  return false;
}

// node_modules/@vgpu/wgsl/dist/runtime/wgsl-identifier-rules.js
var WGSL_SPEC_KEYWORDS = /* @__PURE__ */ new Set([
  "alias",
  "break",
  "case",
  "const",
  "const_assert",
  "continue",
  "continuing",
  "default",
  "diagnostic",
  "discard",
  "else",
  "enable",
  "false",
  "fn",
  "for",
  "if",
  "let",
  "loop",
  "override",
  "requires",
  "return",
  "struct",
  "switch",
  "true",
  "var",
  "while"
]);
var VGPU_MODULE_KEYWORDS = /* @__PURE__ */ new Set(["import", "export", "from", "as"]);
var WGSL_KEYWORDS = /* @__PURE__ */ new Set([...WGSL_SPEC_KEYWORDS, ...VGPU_MODULE_KEYWORDS]);
var WGSL_RESERVED_WORDS = /* @__PURE__ */ new Set([
  "NULL",
  "Self",
  "abstract",
  "active",
  "alignas",
  "alignof",
  "as",
  "asm",
  "asm_fragment",
  "async",
  "attribute",
  "auto",
  "await",
  "become",
  "cast",
  "catch",
  "class",
  "co_await",
  "co_return",
  "co_yield",
  "coherent",
  "column_major",
  "common",
  "compile",
  "compile_fragment",
  "concept",
  "const_cast",
  "consteval",
  "constexpr",
  "constinit",
  "crate",
  "debugger",
  "decltype",
  "delete",
  "demote",
  "demote_to_helper",
  "do",
  "dynamic_cast",
  "enum",
  "explicit",
  "export",
  "extends",
  "extern",
  "external",
  "fallthrough",
  "filter",
  "final",
  "finally",
  "friend",
  "from",
  "fxgroup",
  "get",
  "goto",
  "groupshared",
  "highp",
  "impl",
  "implements",
  "import",
  "inline",
  "instanceof",
  "interface",
  "layout",
  "lowp",
  "macro",
  "macro_rules",
  "match",
  "mediump",
  "meta",
  "mod",
  "module",
  "move",
  "mut",
  "mutable",
  "namespace",
  "new",
  "nil",
  "noexcept",
  "noinline",
  "nointerpolation",
  "non_coherent",
  "noncoherent",
  "noperspective",
  "null",
  "nullptr",
  "of",
  "operator",
  "package",
  "packoffset",
  "partition",
  "pass",
  "patch",
  "pixelfragment",
  "precise",
  "precision",
  "premerge",
  "priv",
  "protected",
  "pub",
  "public",
  "readonly",
  "ref",
  "regardless",
  "register",
  "reinterpret_cast",
  "require",
  "resource",
  "restrict",
  "self",
  "set",
  "shared",
  "sizeof",
  "smooth",
  "snorm",
  "static",
  "static_assert",
  "static_cast",
  "std",
  "subroutine",
  "super",
  "target",
  "template",
  "this",
  "thread_local",
  "throw",
  "trait",
  "try",
  "type",
  "typedef",
  "typeid",
  "typename",
  "typeof",
  "union",
  "unless",
  "unorm",
  "unsafe",
  "unsized",
  "use",
  "using",
  "varying",
  "virtual",
  "volatile",
  "wgsl",
  "where",
  "with",
  "writeonly",
  "yield"
]);
var WGSL_LEGACY_RESERVED_WORDS = /* @__PURE__ */ new Set(["binding_array"]);
function isWgslDeclarationIdentifier(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) && name !== "_" && !name.startsWith("__") && !WGSL_KEYWORDS.has(name) && !WGSL_RESERVED_WORDS.has(name) && !WGSL_LEGACY_RESERVED_WORDS.has(name);
}

// node_modules/@vgpu/wgsl/dist/shader-function-export.js
function isShaderFunctionExport(value) {
  if (typeof value !== "object" || value === null)
    return false;
  try {
    const { name, resolvedName, parameterNames } = value;
    return isIdentifier(name) && isIdentifier(resolvedName) && areValidParameterNames(parameterNames);
  } catch {
    return false;
  }
}
function isIdentifier(value) {
  return typeof value === "string" && isWgslDeclarationIdentifier(value);
}
function areValidParameterNames(value) {
  if (!Array.isArray(value))
    return false;
  const names = /* @__PURE__ */ new Set();
  for (let index = 0; index < value.length; index++) {
    const parameterName = value[index];
    if (!isIdentifier(parameterName) || names.has(parameterName))
      return false;
    names.add(parameterName);
  }
  return true;
}

// node_modules/vgpu/dist/three/source-exports.js
function selectFunction(source, name) {
  if (typeof source === "string" || !("functionExports" in source)) {
    const signature = readFunctionSignature(typeof source === "string" ? source : source.wgsl, name, false);
    return {
      name,
      resolvedName: signature.name,
      parameterNames: signature.parameters.map((parameter) => parameter.name)
    };
  }
  if (!Array.isArray(source.functionExports)) {
    throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", "functionExports must be an array when present.");
  }
  if (!source.functionExports.every(isShaderFunctionExport)) {
    throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", "functionExports contains malformed metadata.");
  }
  const matches = source.functionExports.filter((item) => item.name === name);
  if (matches.length === 0) {
    throw adapterError("VGPU-THREE-TSL-EXPORT-NOT-FOUND", `WGSL module has no direct export named ${name}.`);
  }
  if (matches.length > 1) {
    throw adapterError("VGPU-THREE-TSL-EXPORT-AMBIGUOUS", `WGSL module has multiple direct exports named ${name}.`);
  }
  return matches[0];
}

// node_modules/vgpu/dist/three/source-validation.js
var privateNamespacePrefix = "_vgpu_three_";
var moduleDirectives = ["diagnostic", "enable", "requires"];
var namedDeclarationKinds = /* @__PURE__ */ new Set(["alias", "const", "fn", "override", "struct", "var"]);
function assertSourceSupported(source) {
  const tokens = scanWgslTokens(source);
  let nestingDepth = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if ("([{".includes(token.text)) {
      nestingDepth++;
      continue;
    }
    if (")]}".includes(token.text)) {
      nestingDepth = Math.max(0, nestingDepth - 1);
      continue;
    }
    if (nestingDepth > 0)
      continue;
    if (moduleDirectives.includes(token.text) && tokens[index - 1]?.text !== "@") {
      throw adapterError("VGPU-THREE-TSL-SIGNATURE-UNSUPPORTED", `Three TSL cannot place '${token.text}' before declarations.`);
    }
    if (!namedDeclarationKinds.has(token.text))
      continue;
    const name = declarationName(tokens, index);
    if (name?.text.startsWith(privateNamespacePrefix)) {
      throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `WGSL declaration ${name.text} uses the private ${privateNamespacePrefix} namespace.`);
    }
  }
}
function declarationName(tokens, kindIndex) {
  let index = kindIndex + 1;
  if (tokens[kindIndex]?.text === "var" && tokens[index]?.text === "<") {
    index = afterAngleList(tokens, index);
  }
  return tokens[index]?.kind === "identifier" ? tokens[index] : void 0;
}
function afterAngleList(tokens, start) {
  let depth = 0;
  for (let index = start; index < tokens.length; index++) {
    if (tokens[index]?.text === "<")
      depth++;
    else if (tokens[index]?.text === ">" && --depth === 0)
      return index + 1;
  }
  return tokens.length;
}

// node_modules/vgpu/dist/three/tsl-exports.js
var nextWrapperId = 0;
function tslExports(source) {
  const moduleWgsl = typeof source === "string" ? source : source.wgsl;
  assertSourceSupported(moduleWgsl);
  const include = wgsl(moduleWgsl);
  const allocateWrapperName = wrapperNameAllocator(moduleWgsl);
  const select = (...names) => {
    const result = /* @__PURE__ */ Object.create(null);
    for (const name of names) {
      const selected = selectFunction(source, name);
      const signature = readFunctionSignature(moduleWgsl, selected.resolvedName, typeof source !== "string" && "functionExports" in source);
      if (signature.parameters.length !== selected.parameterNames.length) {
        throw adapterError("VGPU-THREE-TSL-SOURCE-INVALID", `Export metadata for ${name} has ${selected.parameterNames.length} parameters but ${selected.resolvedName} declares ${signature.parameters.length}.`);
      }
      const positionalNames = signature.parameters.map((_, index) => `${privateNamespacePrefix}arg_${index}`);
      const call = `${signature.name}(${positionalNames.join(", ")})`;
      const parameters = signature.parameters.map((parameter, index) => `${positionalNames[index]}: ${parameter.type}`).join(", ");
      const wrapper = `fn ${allocateWrapperName()}(${parameters}) -> ${signature.returnType} { return ${call}; }`;
      const positional = wgslFn(wrapper, [include]);
      result[name] = (inputs) => positional(...selected.parameterNames.map((parameterName) => nodeObject(inputs[parameterName])));
    }
    return result;
  };
  return select;
}
function wrapperNameAllocator(source) {
  const unavailable = new Set(source.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
  return () => {
    let candidate;
    do {
      candidate = `${privateNamespacePrefix}${nextWrapperId++}`;
    } while (unavailable.has(candidate));
    unavailable.add(candidate);
    return candidate;
  };
}
export {
  tslExports
};
