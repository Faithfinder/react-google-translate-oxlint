# `no-conditional-text-nodes-with-siblings`

Flags a conditionally rendered **text node** that sits alongside sibling nodes,
and static text that follows a conditional sibling.

Google Translate rewrites text nodes into `<font>` wrappers. When React later
removes or reorders such a text node, `removeChild` / `insertBefore` throws
`NotFoundError` and the app white-screens —
[facebook/react#11538](https://github.com/facebook/react/issues/11538).

A text node with no siblings is safe: React replaces the parent's entire
contents, so there is no stale wrapper to trip over.

## Fail

```jsx
// bare text in a conditional, with a sibling
<p>{val ? "foo" : "bar"} <span>x</span></p>
<p>{val && "foo"}<span>x</span></p>

// fragments hold children exactly as elements do
<>{val ? "foo" : "bar"}<span>x</span></>

// static text preceded by a conditional sibling
<p>{val ? <span>a</span> : <span>b</span>} tail</p>

// with `textReturningFunctions: ["formatMessage"]` configured — matched through
// the member callee, so a bare `formatMessage(...)` is the same entry
<p>{val ? intl.formatMessage({ id: "a" }) : <span>b</span>}<span>x</span></p>
```

## Pass

```jsx
// wrap the conditional text in an element
<p>{val ? <span>foo</span> : <span>bar</span>} <span>x</span></p>

// no siblings, so nothing can be reparented
<p>{val ? "foo" : "bar"}</p>

// '' renders nothing, and the other branch is an element
<p>{val ? <b>{val}</b> : ""} <span>x</span></p>

// map() builds a ReactElement[], never a bare text node
<p>{val ? <b>x</b> : items?.map((i) => <li key={i} />)}<span>y</span></p>
```

## Options

```json
{
  "rules": {
    "react-google-translate/no-conditional-text-nodes-with-siblings": [
      "error",
      { "textReturningFunctions": ["t", "formatMessage"], "wrapWith": "span" }
    ]
  }
}
```

### `textReturningFunctions`

Default `[]` — but see the built-in list below, which applies regardless.

Names of functions whose return value renders as bare text rather than as an
element. This is the rule's stand-in for type information: oxlint exposes none to
a JS plugin, so `foo()` could return a `string` or a `ReactElement` and the rule
has no way to tell them apart. Listing a name asserts that it returns text.

Translators are the obvious case, but they are not the category — any formatter
is the same hazard:

```json
{ "textReturningFunctions": ["t", "formatMessage", "formatCurrency", "humanize"] }
```

Names match the **final identifier** of the callee, so `"formatMessage"` covers
both `formatMessage(...)` and `intl.formatMessage(...)`. Arity is not checked — a
zero-argument formatter returns text just the same.

#### Built-in names

Functions the language itself guarantees return a string are always treated as
text and need no configuration:

```
String        stringify     join          toString      toLocaleString
toFixed       toPrecision   toExponential toISOString   toUTCString
toDateString  toTimeString  toLocaleDateString          toLocaleTimeString
toUpperCase   toLowerCase   trim
```

The line is deliberate: `toLocaleString` is not a name a codebase gets to
redefine the meaning of, so hardcoding it costs nothing. `t` and `format` *are*
project conventions — guessing at them would flag every unrelated function that
shares the name while still missing every project that names its helpers
differently, which is why they stay opt-in.

`slice` and `concat` are omitted for the same reason in reverse: the `Array`
versions return arrays, so the name alone does not settle it.

### `wrapWith`

Default `"span"`. The element the suggested fix wraps text in.

## Suggestions

The rule offers a suggestion that wraps the offending node, applied with
`oxlint --fix-suggestions`. It is a suggestion rather than a plain `--fix`
because the wrapper adds a DOM node, which CSS can notice — `> *` selectors and
flex/grid child counts both see it.

## Limitations

oxlint's JS-plugin `context` exposes no type information, so an expression whose
text-ness is only knowable from a type — a variable declared `string`, a
`toLocaleString()` call — is not detected. See the README's *Difference from the
ESLint plugin*.
