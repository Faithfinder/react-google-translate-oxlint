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

// with `i18nFunctions: ["formatMessage"]` configured — matched through the
// member callee, so a bare `formatMessage(...)` is covered by the same entry
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
      { "i18nFunctions": ["t", "formatMessage"], "wrapWith": "span" }
    ]
  }
}
```

### `i18nFunctions`

Default `[]` — **no call is treated as returning text until you list one.**

Without a type checker a call's text-ness cannot be inferred, so these are
matched by name. There is deliberately no built-in list: which helper returns a
translated string is a project convention, and a default guess at `t` — about as
generic an identifier as exists — flags every unrelated function that shares the
name. Naming them yourself is the only way this stays accurate.

Names match the **final identifier** of the callee, so `"formatMessage"` covers
both `formatMessage(...)` and `intl.formatMessage(...)`, and `"t"` covers `t(...)`
and `i18n.t(...)`.

```json
{ "i18nFunctions": ["t", "formatMessage"] }
```

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
