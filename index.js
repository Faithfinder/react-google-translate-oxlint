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

const startOf = (node) => (node.range ? node.range[0] : node.start);

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

const isChildOfJSXElement = (node) =>
  node.parent && node.parent.type === "JSXElement";

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
    isChildOfJSXElement(outermost.parent) &&
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

const isJsx = (node) =>
  !!node && (node.type === "JSXElement" || node.type === "JSXFragment");

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

const CONDITIONAL_TEXT_NODE = "conditional-text-node";
const TEXT_NODE_PRECEDED_BY_CONDITIONAL = "text-node-preceded-by-conditional";

const noConditionalTextNodesWithSiblings = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Conditionally rendered text nodes with siblings should be wrapped in an element (e.g. a `<span>`), otherwise Google Translate can crash React.",
    },
    schema: [],
    messages: {
      [CONDITIONAL_TEXT_NODE]:
        "Conditionally rendered text node with siblings. Wrap it in an element (e.g. `<span>`) so Google Translate can't crash React by reparenting the bare text node.",
      [TEXT_NODE_PRECEDED_BY_CONDITIONAL]:
        "Static text node preceded by a conditionally rendered sibling. Wrap it in an element (e.g. `<span>`) so Google Translate can't crash React.",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (
          node.value !== null &&
          typeof node.value !== "boolean" &&
          !isWhitespace(node) &&
          isProblematicConditional(node)
        ) {
          context.report({ node, messageId: CONDITIONAL_TEXT_NODE });
        }
      },
      TemplateLiteral(node) {
        if (!isWhitespace(node) && isProblematicConditional(node)) {
          context.report({ node, messageId: CONDITIONAL_TEXT_NODE });
        }
      },
      JSXText(node) {
        if (
          !isWhitespace(node) &&
          hasSiblings(node) &&
          conditionalSiblingsPrecedeNode(node)
        ) {
          context.report({
            node,
            messageId: TEXT_NODE_PRECEDED_BY_CONDITIONAL,
          });
        }
      },
      MemberExpression(node) {
        if (isCondition(node) || isBinaryExpression(node)) return;
        if (isProblematicConditional(node)) {
          context.report({ node, messageId: CONDITIONAL_TEXT_NODE });
        }
      },
      ChainExpression(node) {
        if (isCondition(node) || isBinaryExpression(node)) return;
        if (returnsJsxForEachItem(node)) return;
        if (isProblematicConditional(node)) {
          context.report({ node, messageId: CONDITIONAL_TEXT_NODE });
        }
      },
      CallExpression(node) {
        // Without type info, only flag well-known i18n helpers that return text.
        if (
          node.callee &&
          node.callee.type === "Identifier" &&
          (node.callee.name === "formatMessage" || node.callee.name === "t") &&
          node.arguments.length > 0
        ) {
          if (isProblematicConditional(node)) {
            context.report({ node, messageId: CONDITIONAL_TEXT_NODE });
          } else if (
            isChildOfJSXElement(node.parent) &&
            hasSiblings(node.parent) &&
            conditionalSiblingsPrecedeNode(node.parent)
          ) {
            context.report({
              node,
              messageId: TEXT_NODE_PRECEDED_BY_CONDITIONAL,
            });
          }
        }
      },
    };
  },
};

const RETURN_VALUE_IS_TEXT_NODE = "return-value-is-text-node";

const noReturnTextNodes = {
  meta: {
    type: "problem",
    docs: {
      description:
        "React components should not return a bare string/number. Google Translate can keep displaying a stale value after state changes, with no error — very hard to debug.",
    },
    schema: [],
    messages: {
      [RETURN_VALUE_IS_TEXT_NODE]:
        "React component returns a bare text node. Wrap it in an element (e.g. `<span>{value}</span>`) so Google Translate can't strand a stale value after re-renders.",
    },
  },
  create(context) {
    const returnsText = (argument) =>
      argument &&
      (argument.type === "TemplateLiteral" ||
        (argument.type === "Literal" &&
          (typeof argument.value === "string" ||
            typeof argument.value === "number")));

    // Walk every path that can return from the component body.
    const reportReturns = (node) => {
      if (!node) return;
      if (node.type === "ReturnStatement") {
        if (returnsText(node.argument)) {
          context.report({ node, messageId: RETURN_VALUE_IS_TEXT_NODE });
        }
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

    const isComponentName = (name) =>
      typeof name === "string" &&
      name.length > 0 &&
      name[0] === name[0].toUpperCase();

    return {
      FunctionDeclaration(node) {
        if (!node.body || !isComponentName(node.id && node.id.name)) return;
        reportReturns(node.body);
      },
    };
  },
};

const plugin = {
  meta: {
    name: "react-google-translate",
    version: "0.1.0",
  },
  rules: {
    "no-conditional-text-nodes-with-siblings":
      noConditionalTextNodesWithSiblings,
    "no-return-text-nodes": noReturnTextNodes,
  },
};

export default plugin;
