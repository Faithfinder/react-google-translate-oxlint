# `no-return-text-nodes`

Flags a React component that returns bare text — a string, a number, or a call
that renders as one.

Under Google Translate this fails more quietly than the crash the sibling rule
catches: the translated `<font>` wrapper survives a re-render, so the component
keeps displaying a **stale value** with no error at all.

A component is any capitalised function declaration, a capitalised binding
initialised with an arrow or function expression, anything wrapped in `memo(...)`
or `forwardRef(...)`, a default export that is a function, and the `render` of a
class component.

## Fail

```jsx
function Label() {
  return "hello";
}
const Label = () => "hello";
const Label = () => {
  return "hello";
};

// a conditional returns text down at least one path
const Label = ({ val }) => (val ? "a" : "b");

// wrappers mark their argument as a component whatever it is bound to
export default memo(() => "hello");
const Label = React.forwardRef(() => "hello");

// a default export needs no name to be a component
export default () => "hello";
export default function () {
  return "hello";
}

// a call that renders as text: built-in stringifiers need no configuration,
// project helpers are named in `textReturningFunctions`
const Label = ({ d }) => d.toLocaleString();
const Label = ({ n }) => String(n);
const Label = ({ t }) => t("key");

class Label extends React.Component {
  render() {
    return "hello";
  }
}
```

## Pass

```jsx
const Label = () => <span>hello</span>;

// lowercase, so a helper rather than a component
const label = () => "hello";

// capitalised but not a function
const Config = "some string";

// a call this rule has no reason to think returns text
const Label = ({ useRows }) => useRows();
```

## Options

```json
{
  "rules": {
    "react-google-translate/no-return-text-nodes": [
      "error",
      { "textReturningFunctions": ["t", "formatMessage"], "wrapWith": "span" }
    ]
  }
}
```

### `textReturningFunctions`

Names of your project's functions that return a string rather than an element —
translators, formatters. oxlint exposes no type information to a JS plugin, so
`foo()` could return a string or a `ReactElement` and the rule cannot tell; this
list is how you supply the answer.

Functions the language itself guarantees return a string — `toLocaleString`,
`toString`, `toFixed`, `toISOString`, `join`, `String`, `trim` and friends — are
built in and need no configuration. Names match the final identifier of the
callee, so `formatMessage` covers `intl.formatMessage(...)`.

This is the same option, with the same meaning, that
[`no-conditional-text-nodes-with-siblings`](no-conditional-text-nodes-with-siblings.md)
takes: whether a call renders as text does not depend on where it appears.

### `wrapWith`

Default `"span"`. The element the suggested fix wraps the return value in.

## Suggestions

`oxlint --fix-suggestions` rewrites `return "text"` to
`return <span>{"text"}</span>`. No suggestion is offered in a `.ts`, `.mts` or
`.cts` file, where JSX does not parse.

## Limitations

Component detection is naming-based: a capitalised function that is not a
component is still checked, and a lowercase one that is will not be. A default
export is treated as a component whatever it is called, so a module whose default
export is a text-returning helper is reported too.

A bare identifier or member expression is not treated as text —
`const Label = () => props.children` and `() => ctx.value` return elements far
more often than strings, and without type information the name is no evidence
either way. The sibling rule does flag a member expression, but only as one
branch of a conditional whose *other* branch is an element, which is itself the
hint that text is intended. Nothing that general applies to a whole return value,
so this rule stays with calls it can name.
