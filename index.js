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
 *
 * ---------------------------------------------------------------------------
 * What actually throws, verified against react-dom 18.3.1
 * ---------------------------------------------------------------------------
 * A bare text node is only a hazard if React creates a `HostText` fiber for it
 * *and* then removes it or uses it as an `insertBefore` reference. Two separate
 * hazards follow, and they need separate checks:
 *
 *   H1 removeChild  — a bare text node exists at this position in one state and
 *                     not in another, so React deletes it. This needs the
 *                     branches of the conditional to *differ*: `{c ? 'a' : ''}`
 *                     throws, `{c ? 'a' : 'b'}` does not, because React reuses
 *                     the single HostText fiber and only assigns `nodeValue`.
 *
 *   H2 insertBefore — a bare text node exists at this position and a *preceding*
 *                     sibling mounts. `getHostSibling` searches forward only, so
 *                     this is asymmetric: a conditional *before* the text is a
 *                     hazard, a conditional *after* it is not. The text itself
 *                     need not be conditional at all.
 *
 * Two structural facts the rule has to respect:
 *   - `''` renders nothing. The reconciler's guard is
 *     `typeof newChild === 'string' && newChild !== ''`, so an empty string
 *     never creates a HostText fiber and can never be the node that throws.
 *   - When a host element's `children` prop is a *single* string or number,
 *     `shouldSetTextContent` makes React manage the text through the parent's
 *     `textContent` and no HostText fiber is created at all.
 */

const startOf = (node) => (node.range ? node.range[0] : node.start);

/**
 * What does this expression contribute at its JSX child position?
 *
 * TEXT     - a bare text node is definitely produced.
 * NO_TEXT  - definitely no bare text node (an element, `''`, null, false, ...).
 * UNKNOWN  - undecidable without type information.
 */
const TEXT = "text";
const NO_TEXT = "no-text";
const UNKNOWN = "unknown";

const isJsx = (node) =>
  !!node && (node.type === "JSXElement" || node.type === "JSXFragment");

/** Collect `return` statements belonging to this function, not to nested ones. */
const collectOwnReturns = (node, out) => {
  if (!node || typeof node.type !== "string") return out;
  if (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  ) {
    return out;
  }
  if (node.type === "ReturnStatement") {
    out.push(node);
    return out;
  }
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) collectOwnReturns(item, out);
    } else if (value && typeof value.type === "string") {
      collectOwnReturns(value, out);
    }
  }
  return out;
};

/** True when every path out of this callback returns JSX. */
const callbackReturnsJsx = (fn) => {
  if (
    !fn ||
    (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression")
  ) {
    return false;
  }
  if (fn.body && fn.body.type !== "BlockStatement") return isJsx(fn.body);
  const returns = collectOwnReturns(fn.body, []);
  return returns.length > 0 && returns.every((r) => isJsx(r.argument));
};

/**
 * `items.map(x => <li/>)` produces `ReactElement[]`, never a bare text node.
 * Only claimed when the callback demonstrably returns JSX — `items.map(String)`
 * or a callback returning a string stays UNKNOWN.
 */
const isJsxReturningIteratorCall = (node) => {
  if (!node || node.type !== "CallExpression") return false;
  const callee =
    node.callee && node.callee.type === "ChainExpression"
      ? node.callee.expression
      : node.callee;
  if (!callee || callee.type !== "MemberExpression") return false;
  const property = callee.property;
  const name =
    property &&
    (property.name ||
      (property.type === "Literal" ? property.value : undefined));
  if (name !== "map" && name !== "flatMap") return false;
  return callbackReturnsJsx(node.arguments && node.arguments[0]);
};

const isI18nCall = (node) =>
  !!node &&
  node.type === "CallExpression" &&
  node.callee &&
  node.callee.type === "Identifier" &&
  (node.callee.name === "formatMessage" || node.callee.name === "t") &&
  node.arguments.length > 0;

const worst = (a, b) => {
  if (a === TEXT || b === TEXT) return TEXT;
  if (a === UNKNOWN || b === UNKNOWN) return UNKNOWN;
  return NO_TEXT;
};

const contribution = (node) => {
  if (!node) return NO_TEXT;
  switch (node.type) {
    case "Literal": {
      if (node.value === null || typeof node.value === "boolean") {
        return NO_TEXT;
      }
      if (typeof node.value === "string") {
        // Only `''` renders nothing. `{' '}` really does create a text node —
        // unlike whitespace-only *JSX* text, which the parser strips.
        return node.value === "" ? NO_TEXT : TEXT;
      }
      if (typeof node.value === "number") return TEXT;
      return NO_TEXT;
    }
    case "JSXText":
      return node.value.trim() === "" ? NO_TEXT : TEXT;
    case "TemplateLiteral":
      return TEXT;
    case "JSXElement":
      return NO_TEXT;
    case "JSXFragment":
      return node.children.reduce(
        (acc, child) => worst(acc, contribution(child)),
        NO_TEXT
      );
    case "JSXExpressionContainer":
      return contribution(node.expression);
    case "JSXEmptyExpression":
      return NO_TEXT;
    case "ArrayExpression":
      return (node.elements || []).reduce(
        (acc, element) => worst(acc, contribution(element)),
        NO_TEXT
      );
    case "ConditionalExpression":
      return worst(contribution(node.consequent), contribution(node.alternate));
    case "LogicalExpression":
      // `a && b` renders only `b`; `a || b` and `a ?? b` can render either side.
      return node.operator === "&&"
        ? contribution(node.right)
        : worst(contribution(node.left), contribution(node.right));
    case "ChainExpression":
      return contribution(node.expression);
    case "CallExpression":
      if (isI18nCall(node)) return TEXT;
      if (isJsxReturningIteratorCall(node)) return NO_TEXT;
      return UNKNOWN;
    case "Identifier":
      return node.name === "undefined" ? NO_TEXT : UNKNOWN;
    default:
      return UNKNOWN;
  }
};

/**
 * Whether an UNKNOWN contribution should still be reported.
 *
 * Without a type-checker we cannot tell `{cond ? obj.label : <b/>}` (a hazard)
 * from `{cond ? obj.icon : <b/>}` (not one). This keeps the node kinds the rule
 * has always reported on — member and optional-chain expressions — rather than
 * widening to every identifier, which would flag every `ReactNode` prop.
 */
const reportsWhenUnknown = (node) =>
  !!node &&
  (node.type === "MemberExpression" || node.type === "ChainExpression");

/** Flatten nested conditionals into the set of expressions that can render. */
const renderableBranches = (expr, out = []) => {
  if (!expr) return out;
  if (expr.type === "ConditionalExpression") {
    renderableBranches(expr.consequent, out);
    renderableBranches(expr.alternate, out);
    return out;
  }
  if (expr.type === "LogicalExpression") {
    if (expr.operator === "&&") {
      // The left side is the test. The falsy case renders nothing, and that is
      // a real branch — it is what makes the text node mount and unmount.
      renderableBranches(expr.right, out);
      out.push(null);
      return out;
    }
    renderableBranches(expr.left, out);
    renderableBranches(expr.right, out);
    return out;
  }
  out.push(expr);
  return out;
};

/**
 * A branch producing exactly one bare text node and nothing else. When *every*
 * branch has this shape React reuses a single HostText fiber across the update
 * and only assigns `nodeValue`, so nothing is inserted or removed and H1 cannot
 * fire. Fragments and arrays are excluded: they can change how many text nodes
 * exist, which does move nodes around.
 */
const isSingleTextBranch = (node) =>
  !!node &&
  contribution(node) === TEXT &&
  (node.type === "Literal" ||
    node.type === "TemplateLiteral" ||
    isI18nCall(node));

/** The branch nodes that can mount or unmount a bare text node (hazard H1). */
const togglingTextBranches = (expr) => {
  const branches = renderableBranches(expr);
  if (branches.length < 2) return [];

  const flagged = branches.filter((branch) => {
    const c = contribution(branch);
    if (c === TEXT) return true;
    if (c !== UNKNOWN) return false;
    if (reportsWhenUnknown(branch)) return true;
    // `{cond ? maybeText : ''}` — every other branch renders nothing at all, so
    // if this one is text it definitely mounts and unmounts, and we cannot prove
    // it is not. This is the position the rule has always reported; it used to
    // blame the `''`, which is never the node that throws.
    return branches.every(
      (other) => other === branch || contribution(other) === NO_TEXT
    );
  });
  if (flagged.length === 0) return [];

  // Every branch is a single bare text node: the fiber is reused, not moved.
  if (branches.every(isSingleTextBranch)) return [];

  return flagged;
};

const isConditional = (node) =>
  !!node &&
  (node.type === "ConditionalExpression" || node.type === "LogicalExpression");

/**
 * Whitespace that is not a meaningful sibling. Unchanged from the original rule:
 * `''` is excluded deliberately, so it still counts as a sibling for
 * `hasSiblings`. Whether `''` is a *text node* is a separate question, answered
 * by `contribution` — which is the distinction the rule used to conflate.
 */
const isWhitespace = (node) =>
  ((node.type === "Literal" && typeof node.value === "string") ||
    (node.type === "JSXText" && typeof node.value === "string")) &&
  node.value !== "" &&
  node.value.trim() === "";

/**
 * A conditional whose every branch is a single bare text node keeps exactly one
 * HostText fiber alive across updates: React only assigns `nodeValue`, so it
 * never inserts or removes a host node. Such a sibling cannot trigger H2 in the
 * nodes that follow it — verified against react-dom 18.3.1, in contrast to
 * `{c ? <a/> : <b/>}` and `{c && <i/>}`, which both do.
 */
const isStableTextConditional = (expr) =>
  isConditional(expr) && renderableBranches(expr).every(isSingleTextBranch);

/** Does the JSX parent of this child hold any other meaningful child? */
const hasSiblings = (node) =>
  node.parent &&
  node.parent.children &&
  node.parent.children.length > 1 &&
  node.parent.children.some(
    (child) => !Object.is(child, node) && !isWhitespace(child)
  );

/**
 * Hazard H2: can something mount *before* this position? `getHostSibling`
 * searches forward only, so only preceding siblings matter.
 */
const conditionalSiblingsPrecedeNode = (node) =>
  node.parent &&
  node.parent.children &&
  node.parent.children
    .filter((child) => startOf(child) < startOf(node) && !isWhitespace(child))
    .some(
      (child) =>
        child.type === "JSXExpressionContainer" &&
        isConditional(child.expression) &&
        !isStableTextConditional(child.expression)
    );

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
      JSXExpressionContainer(node) {
        const parent = node.parent;
        if (
          !parent ||
          (parent.type !== "JSXElement" && parent.type !== "JSXFragment")
        ) {
          return;
        }
        if (!hasSiblings(node)) return;

        // H1 — a bare text node mounts or unmounts at this position.
        if (isConditional(node.expression)) {
          for (const branch of togglingTextBranches(node.expression)) {
            context.report({ node: branch, messageId: CONDITIONAL_TEXT_NODE });
          }
        }

        // H2 — a bare text node sits here and a preceding sibling can mount.
        // This applies however the text got here, conditional or not, which is
        // why `{c ? 'a' : 'b'}` is exempt from H1 but not from this.
        if (
          contribution(node.expression) === TEXT &&
          conditionalSiblingsPrecedeNode(node)
        ) {
          context.report({
            node,
            messageId: TEXT_NODE_PRECEDED_BY_CONDITIONAL,
          });
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
