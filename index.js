/**
 * oxlint-plugin-react-google-translate
 *
 * Flags JSX patterns that crash React when the Google Translate browser
 * extension is active. Translate replaces text nodes with `<font>` wrappers;
 * when React then tries to remove/reorder a *conditionally rendered* text node
 * that has siblings, `removeChild`/`insertBefore` throws `NotFoundError` and the
 * app white-screens (https://github.com/facebook/react/issues/11538).
 *
 * Ported from `eslint-plugin-react-google-translate` (getcouped, MIT) to the
 * oxlint JS-plugin API. oxlint's plugin context has no TypeScript type-checker,
 * so the original's type-driven checks (inferring a variable is `string`) are
 * omitted; the syntactic checks below still catch the common dangerous patterns.
 *
 * Fix: wrap the conditionally rendered text in an element, e.g.
 *   {cond ? 'foo' : 'bar'} <span>x</span>
 *   -> {cond ? <span>foo</span> : <span>bar</span>} <span>x</span>
 */

const DOCS_BASE =
  "https://github.com/Faithfinder/react-google-translate-oxlint/blob/main/docs/rules";

const startOf = (node) => (node.range ? node.range[0] : node.start);

const rangeOf = (node) => (node.range ? node.range : [node.start, node.end]);

const isWhitespace = (node) =>
  (node.type === "Literal" &&
    typeof node.value === "string" &&
    node.value !== "" &&
    node.value.trim() === "") ||
  (node.type === "JSXText" &&
    typeof node.value === "string" &&
    node.value !== "" &&
    node.value.trim() === "");

const isConditionallyRendered = (node) =>
  node.parent &&
  (node.parent.type === "ConditionalExpression" ||
    node.parent.type === "LogicalExpression");

const isChildOfJSXExpressionContainer = (node) =>
  node.parent && node.parent.type === "JSXExpressionContainer";

// A fragment holds children exactly as an element does, so `<>{cond ? 'a' :
// 'b'}<span/></>` is the same hazard as the element form. Checking only
// JSXElement here left every fragment-rooted component unexamined.
const isChildOfJSXParent = (node) =>
  node.parent &&
  (node.parent.type === "JSXElement" || node.parent.type === "JSXFragment");

const hasSiblings = (node) =>
  node.parent &&
  node.parent.children &&
  node.parent.children.length > 1 &&
  node.parent.children.some(
    (child) => !Object.is(child, node) && !isWhitespace(child)
  );

// Climb through nested conditionals so `a ? b : (c ? d : e)` reports against the
// outermost expression that actually sits in the JSX tree.
const getOutermostConditional = (node) => {
  let current = node;
  while (
    current.parent &&
    (current.parent.type === "ConditionalExpression" ||
      current.parent.type === "LogicalExpression")
  ) {
    current = current.parent;
  }
  return current;
};

const isProblematicConditional = (node) => {
  if (!isConditionallyRendered(node)) return false;
  const outermost = getOutermostConditional(node);
  return (
    isChildOfJSXExpressionContainer(outermost) &&
    isChildOfJSXParent(outermost.parent) &&
    hasSiblings(outermost.parent)
  );
};

// A static JSX text node is unsafe when a conditional expression precedes it as
// a sibling — Translate wraps the text, and React's update to the conditional
// sibling then trips over the wrapper.
const conditionalSiblingsPrecedeNode = (node) =>
  node.parent &&
  node.parent.children &&
  node.parent.children
    .filter((child) => startOf(child) < startOf(node) && !isWhitespace(child))
    .some(
      (child) =>
        child.type === "JSXExpressionContainer" &&
        child.expression &&
        (child.expression.type === "ConditionalExpression" ||
          child.expression.type === "LogicalExpression")
    );

// True when `node` is the *test* of a conditional (e.g. `a` in `a && b`), which
// is evaluated, not rendered — so it must never be flagged.
const isCondition = (node) => {
  let current = node;
  while (current.parent && current.parent.type === "LogicalExpression") {
    if (Object.is(current.parent.left, current)) return true;
    current = current.parent;
  }
  if (current.parent && current.parent.type === "ConditionalExpression") {
    return Object.is(current.parent.test, current);
  }
  return false;
};

const isBinaryExpression = (node) =>
  node.parent && node.parent.type === "BinaryExpression"
    ? isCondition(node.parent)
    : false;

const containsBareText = (node) =>
  node.children.some(
    (child) => child.type === "JSXText" && !isWhitespace(child)
  );

// Every child is itself JSX, so nothing here renders as bare text. An
// expression container disqualifies the fragment: without types its value may
// well be a string.
const rendersOnlyElements = (node) =>
  node.children.every(
    (child) =>
      isWhitespace(child) ||
      child.type === "JSXElement" ||
      (child.type === "JSXFragment" && rendersOnlyElements(child))
  );

// `''` creates no text node -- the reconciler's guard is `newChild !== ''` -- so
// it is only ever worth reporting as a stand-in for the branch opposite it,
// which without a type checker may well render text we cannot identify. The
// stand-in is redundant only once that branch is accounted for: an element
// renders no bare text, a fragment of elements renders none either, and a
// fragment holding bare text is reported on the fragment itself. A fragment
// wrapping an expression container is none of those, so the `''` still stands.
const isInertEmptyString = (node) => {
  if (node.type !== "Literal" || node.value !== "") return false;
  const parent = node.parent;
  if (!parent || parent.type !== "ConditionalExpression") return false;
  const other = Object.is(parent.consequent, node)
    ? parent.alternate
    : parent.consequent;
  if (!other) return false;
  if (other.type === "JSXElement") return true;
  return (
    other.type === "JSXFragment" &&
    (rendersOnlyElements(other) || containsBareText(other))
  );
};

const isJsx = (node) =>
  !!node && (node.type === "JSXElement" || node.type === "JSXFragment");

// `t(...)`, `intl.formatMessage(...)` and `i18n.t(...)` all name the helper in
// the final identifier of the callee, so match on that rather than insisting on
// a bare identifier — a member callee is the more common shape in practice.
const calleeName = (callee) => {
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed) {
    return callee.property && callee.property.type === "Identifier"
      ? callee.property.name
      : null;
  }
  return null;
};

// `items?.map((i) => <li />)` builds a ReactElement[], never a bare text node.
// Only claimed when the callback demonstrably returns JSX, so `items?.map(String)`
// stays reported.
const returnsJsxForEachItem = (node) => {
  const call = node.expression;
  if (!call || call.type !== "CallExpression") return false;
  const callee = call.callee;
  if (!callee || callee.type !== "MemberExpression") return false;
  const name = callee.property && callee.property.name;
  if (name !== "map" && name !== "flatMap") return false;
  const fn = call.arguments && call.arguments[0];
  if (!fn) return false;
  if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression")
    return false;
  if (fn.body && fn.body.type !== "BlockStatement") return isJsx(fn.body);
  const returns = [];
  const walk = (n) => {
    if (!n || typeof n.type !== "string") return;
    if (
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression"
    )
      return;
    if (n.type === "ReturnStatement") return returns.push(n);
    for (const k of Object.keys(n)) {
      if (k === "parent") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v.type === "string") walk(v);
    }
  };
  walk(fn.body);
  return returns.length > 0 && returns.every((r) => isJsx(r.argument));
};

/* -------------------------------------------------------------------------- */
/* options                                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_I18N_FUNCTIONS = ["t", "formatMessage"];
const DEFAULT_WRAP_WITH = "span";

const optionsOf = (context) =>
  (context.options && context.options[0]) || Object.create(null);

const i18nFunctionsOf = (context) => {
  const configured = optionsOf(context).i18nFunctions;
  return Array.isArray(configured) ? configured : DEFAULT_I18N_FUNCTIONS;
};

const wrapWithOf = (context) => {
  const configured = optionsOf(context).wrapWith;
  return typeof configured === "string" && configured.trim()
    ? configured.trim()
    : DEFAULT_WRAP_WITH;
};

const WRAP_WITH_SCHEMA = {
  type: "string",
  description: "Element name the suggested fix wraps text in.",
};

/* -------------------------------------------------------------------------- */
/* suggestions                                                                 */
/* -------------------------------------------------------------------------- */

const SUGGEST_WRAP = "wrap-in-element";
const SUGGEST_WRAP_MESSAGE = "Wrap it in a `<{{tag}}>`.";

// JSX does not parse in a `.ts`/`.mts`/`.cts` file, so a wrapper suggested there
// would not compile. `.tsx`, `.jsx` and `.js` are all fine.
const acceptsJsx = (context) => !/\.[cm]?ts$/.test(context.filename || "");

const buildWrapFix = (fixer, context, node, tag) => {
  if (node.type === "JSXFragment") {
    // Rewriting the delimiters keeps the children exactly as written, where
    // wrapping the whole fragment would nest it pointlessly inside the element.
    return [
      fixer.replaceTextRange(node.openingFragment.range, `<${tag}>`),
      fixer.replaceTextRange(node.closingFragment.range, `</${tag}>`),
    ];
  }
  const source = context.sourceCode.getText(node);
  if (node.type === "JSXText") {
    // Leave the surrounding whitespace outside the wrapper: JSX collapses it at
    // line boundaries, so pulling it inside would change what renders.
    const leading = source.length - source.trimStart().length;
    const trailing = source.length - source.trimEnd().length;
    const [start, end] = rangeOf(node);
    return fixer.replaceTextRange(
      [start + leading, end - trailing],
      `<${tag}>${source.trim()}</${tag}>`
    );
  }
  return fixer.replaceText(node, `<${tag}>{${source}}</${tag}>`);
};

// Offered as a suggestion rather than applied by `--fix`: wrapping is the
// correct repair for the crash, but it adds a DOM node that CSS can notice
// (`> *` selectors, flex/grid child counts), so it stays opt-in behind
// `--fix-suggestions`.
const wrapSuggestion = (context, node) => {
  if (!node || !acceptsJsx(context)) return undefined;
  const tag = wrapWithOf(context);
  return [
    {
      messageId: SUGGEST_WRAP,
      data: { tag },
      fix: (fixer) => buildWrapFix(fixer, context, node, tag),
    },
  ];
};

/* -------------------------------------------------------------------------- */
/* no-conditional-text-nodes-with-siblings                                     */
/* -------------------------------------------------------------------------- */

const CONDITIONAL_TEXT_NODE = "conditional-text-node";
const TEXT_NODE_PRECEDED_BY_CONDITIONAL = "text-node-preceded-by-conditional";

const noConditionalTextNodesWithSiblings = {
  meta: {
    type: "problem",
    hasSuggestions: true,
    docs: {
      description:
        "Conditionally rendered text nodes with siblings should be wrapped in an element (e.g. a `<span>`), otherwise Google Translate can crash React.",
      url: `${DOCS_BASE}/no-conditional-text-nodes-with-siblings.md`,
    },
    schema: [
      {
        type: "object",
        properties: {
          i18nFunctions: {
            type: "array",
            items: { type: "string" },
            description:
              "Names of helpers that return translated text. Matched against the final identifier of the callee, so `formatMessage` covers `intl.formatMessage(...)`.",
          },
          wrapWith: WRAP_WITH_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
    messages: {
      [CONDITIONAL_TEXT_NODE]:
        "Conditionally rendered text node with siblings. Wrap it in an element (e.g. `<span>`) so Google Translate can't crash React by reparenting the bare text node.",
      [TEXT_NODE_PRECEDED_BY_CONDITIONAL]:
        "Static text node preceded by a conditionally rendered sibling. Wrap it in an element (e.g. `<span>`) so Google Translate can't crash React.",
      [SUGGEST_WRAP]: SUGGEST_WRAP_MESSAGE,
    },
  },
  create(context) {
    const i18nFunctions = i18nFunctionsOf(context);
    const report = (node, messageId) =>
      context.report({
        node,
        messageId,
        suggest: wrapSuggestion(context, node),
      });

    return {
      Literal(node) {
        if (
          node.value !== null &&
          typeof node.value !== "boolean" &&
          !isInertEmptyString(node) &&
          !isWhitespace(node) &&
          isProblematicConditional(node)
        ) {
          report(node, CONDITIONAL_TEXT_NODE);
        }
      },
      // conditionally rendered fragments whose children include bare text
      JSXFragment(node) {
        if (containsBareText(node) && isProblematicConditional(node)) {
          report(node, CONDITIONAL_TEXT_NODE);
        }
      },
      TemplateLiteral(node) {
        if (!isWhitespace(node) && isProblematicConditional(node)) {
          report(node, CONDITIONAL_TEXT_NODE);
        }
      },
      JSXText(node) {
        if (
          !isWhitespace(node) &&
          hasSiblings(node) &&
          conditionalSiblingsPrecedeNode(node)
        ) {
          report(node, TEXT_NODE_PRECEDED_BY_CONDITIONAL);
        }
      },
      MemberExpression(node) {
        if (isCondition(node) || isBinaryExpression(node)) return;
        if (isProblematicConditional(node)) {
          report(node, CONDITIONAL_TEXT_NODE);
        }
      },
      ChainExpression(node) {
        if (isCondition(node) || isBinaryExpression(node)) return;
        if (returnsJsxForEachItem(node)) return;
        if (isProblematicConditional(node)) {
          report(node, CONDITIONAL_TEXT_NODE);
        }
      },
      CallExpression(node) {
        // Without type info, only flag well-known i18n helpers that return text.
        if (
          !i18nFunctions.includes(calleeName(node.callee)) ||
          node.arguments.length === 0
        ) {
          return;
        }
        if (isProblematicConditional(node)) {
          report(node, CONDITIONAL_TEXT_NODE);
        } else if (
          isChildOfJSXParent(node.parent) &&
          hasSiblings(node.parent) &&
          conditionalSiblingsPrecedeNode(node.parent)
        ) {
          report(node, TEXT_NODE_PRECEDED_BY_CONDITIONAL);
        }
      },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* no-return-text-nodes                                                        */
/* -------------------------------------------------------------------------- */

const RETURN_VALUE_IS_TEXT_NODE = "return-value-is-text-node";

// `memo(...)` and `forwardRef(...)` mark their first argument as a component
// whatever it is bound to, which makes them worth following even when the result
// is exported anonymously.
const COMPONENT_WRAPPERS = new Set(["memo", "forwardRef"]);
const REACT_BASE_CLASSES = new Set(["Component", "PureComponent"]);

// `_foo`, `$foo` and `1foo` all satisfy `x[0] === x[0].toUpperCase()`, so test
// for an actual capital instead.
const isComponentName = (name) =>
  typeof name === "string" && /^[A-Z]/.test(name);

// A conditional returns text down at least one path, and that path is the
// dangerous one — `() => cond ? 'a' : 'b'` is as stale-prone as `() => 'a'`.
const returnsText = (argument) => {
  if (!argument) return false;
  if (argument.type === "TemplateLiteral") return true;
  if (argument.type === "Literal") {
    return (
      typeof argument.value === "string" || typeof argument.value === "number"
    );
  }
  if (argument.type === "ConditionalExpression") {
    return returnsText(argument.consequent) || returnsText(argument.alternate);
  }
  if (argument.type === "LogicalExpression") {
    // The left of `&&` is the test, not a rendered value.
    return (
      returnsText(argument.right) ||
      (argument.operator !== "&&" && returnsText(argument.left))
    );
  }
  return false;
};

const isComponentWrapperCall = (node) =>
  !!node &&
  node.type === "CallExpression" &&
  COMPONENT_WRAPPERS.has(calleeName(node.callee)) &&
  node.arguments.length > 0;

// `memo(forwardRef(fn))` nests, so unwrap to the innermost function once rather
// than reporting from each layer.
const unwrapComponentFactory = (node) => {
  let current = node;
  while (isComponentWrapperCall(current)) current = current.arguments[0];
  return current;
};

const isNestedInComponentFactory = (node) =>
  node.parent &&
  isComponentWrapperCall(node.parent) &&
  Object.is(node.parent.arguments[0], node);

const noReturnTextNodes = {
  meta: {
    type: "problem",
    hasSuggestions: true,
    docs: {
      description:
        "React components should not return a bare string/number. Google Translate can keep displaying a stale value after state changes, with no error — very hard to debug.",
      url: `${DOCS_BASE}/no-return-text-nodes.md`,
    },
    schema: [
      {
        type: "object",
        properties: { wrapWith: WRAP_WITH_SCHEMA },
        additionalProperties: false,
      },
    ],
    messages: {
      [RETURN_VALUE_IS_TEXT_NODE]:
        "React component returns a bare text node. Wrap it in an element (e.g. `<span>{value}</span>`) so Google Translate can't strand a stale value after re-renders.",
      [SUGGEST_WRAP]: SUGGEST_WRAP_MESSAGE,
    },
  },
  create(context) {
    // Reported against the statement so the message points at the `return`, but
    // fixed against the value, which is what actually needs wrapping.
    const report = (node, value) =>
      context.report({
        node,
        messageId: RETURN_VALUE_IS_TEXT_NODE,
        suggest: wrapSuggestion(context, value),
      });

    // Walk every path that can return from the component body.
    const reportReturns = (node) => {
      if (!node) return;
      if (node.type === "ReturnStatement") {
        if (returnsText(node.argument)) report(node, node.argument);
        return;
      }
      if (node.type === "BlockStatement") {
        for (const child of node.body || []) reportReturns(child);
      } else if (node.type === "IfStatement") {
        reportReturns(node.consequent);
        reportReturns(node.alternate);
      } else if (
        node.type === "ForOfStatement" ||
        node.type === "ForInStatement" ||
        node.type === "ForStatement" ||
        node.type === "WhileStatement" ||
        node.type === "DoWhileStatement"
      ) {
        reportReturns(node.body);
      } else if (node.type === "SwitchStatement") {
        for (const switchCase of node.cases) {
          for (const consequent of switchCase.consequent) {
            reportReturns(consequent);
          }
        }
      } else if (node.type === "TryStatement") {
        reportReturns(node.block);
        if (node.handler) reportReturns(node.handler.body);
        if (node.finalizer) reportReturns(node.finalizer);
      }
    };

    const reportFunctionBody = (fn) => {
      if (!fn) return;
      if (
        fn.type !== "ArrowFunctionExpression" &&
        fn.type !== "FunctionExpression"
      )
        return;
      // a concise arrow body is itself the return value
      if (fn.body && fn.body.type !== "BlockStatement") {
        if (returnsText(fn.body)) report(fn.body, fn.body);
        return;
      }
      reportReturns(fn.body);
    };

    // `render()` and `render = () => ...` are both ordinary component bodies.
    const reportClassBody = (node) => {
      const members = (node.body && node.body.body) || [];
      for (const member of members) {
        const key = member.key;
        if (!key || key.type !== "Identifier" || key.name !== "render") continue;
        if (member.type === "MethodDefinition") reportReturns(member.value.body);
        else if (member.type === "PropertyDefinition")
          reportFunctionBody(member.value);
      }
    };

    const isComponentClass = (node) =>
      isComponentName(node.id && node.id.name) ||
      REACT_BASE_CLASSES.has(calleeName(node.superClass));

    return {
      FunctionDeclaration(node) {
        if (!node.body || !isComponentName(node.id && node.id.name)) return;
        reportReturns(node.body);
      },
      // `const Foo = () => ...` and `const Foo = function () { ... }` are the
      // dominant component style and were previously unchecked entirely.
      VariableDeclarator(node) {
        const id = node.id;
        if (!id || id.type !== "Identifier" || !isComponentName(id.name)) return;
        // `const Foo = memo(...)` is handled by the CallExpression visitor, which
        // also covers the anonymous `export default memo(...)` form.
        if (isComponentWrapperCall(node.init)) return;
        reportFunctionBody(node.init);
      },
      CallExpression(node) {
        if (!isComponentWrapperCall(node)) return;
        // Only the outermost wrapper reports, so `memo(forwardRef(fn))` is one
        // finding rather than one per layer.
        if (isNestedInComponentFactory(node)) return;
        reportFunctionBody(unwrapComponentFactory(node));
      },
      ClassDeclaration(node) {
        if (isComponentClass(node)) reportClassBody(node);
      },
      ClassExpression(node) {
        if (isComponentClass(node)) reportClassBody(node);
      },
    };
  },
};

const plugin = {
  meta: {
    name: "react-google-translate",
    version: "0.3.0",
  },
  rules: {
    "no-conditional-text-nodes-with-siblings":
      noConditionalTextNodesWithSiblings,
    "no-return-text-nodes": noReturnTextNodes,
  },
};

export default plugin;
