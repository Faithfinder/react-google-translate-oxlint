# oxlint-plugin-react-google-translate

An [oxlint](https://oxc.rs/docs/guide/usage/linter.html) plugin that flags JSX
patterns which crash React when the **Google Translate** browser extension is
active.

When translating a page, Google Translate rewrites the DOM — wrapping text nodes
in `<font>` elements. If React then removes or reorders a **conditionally
rendered text node that has siblings**, `removeChild` / `insertBefore` throws
`NotFoundError` and the app white-screens. This is the long-standing
[facebook/react#11538](https://github.com/facebook/react/issues/11538).

This is an oxlint port of the ESLint plugin
[`eslint-plugin-react-google-translate`](https://www.npmjs.com/package/eslint-plugin-react-google-translate)
by getcouped (MIT). It catches the problem at lint time so you never ship it.

> Complements the runtime fix in
> [`react-google-translate-shim`](https://www.npmjs.com/package/react-google-translate-shim):
> lint keeps new code clean, the shim recovers if a crash still happens.

## Install

```sh
npm install --save-dev oxlint-plugin-react-google-translate
```

Requires oxlint with JS-plugin support (`>=1.0`).

## Usage

Register the plugin in `.oxlintrc.json` via `jsPlugins`, then enable the rules
(they live under the `react-google-translate/` namespace):

```json
{
  "jsPlugins": ["oxlint-plugin-react-google-translate"],
  "rules": {
    "react-google-translate/no-conditional-text-nodes-with-siblings": "error",
    "react-google-translate/no-return-text-nodes": "error"
  }
}
```

If your oxlint version doesn't resolve the bare package name, point `jsPlugins`
at the file directly:
`"./node_modules/oxlint-plugin-react-google-translate/index.js"`.

## Rules

### `no-conditional-text-nodes-with-siblings`

Flags a conditionally rendered text node that sits alongside sibling nodes, and
static text preceded by a conditional sibling.

```jsx
// ❌ bad — the text unmounts when `val` flips ('' renders nothing)
<p>{val ? "foo" : ""} <span>x</span></p>
<p>{val && "foo"}<span>x</span></p>
// ❌ bad — a fragment of bare text on one branch, nothing on the other
<p>{val ? <>bare {name} text</> : ""}<span>x</span></p>
// ❌ bad — static text preceded by a conditional sibling that can mount
<p>{val ? <span>a</span> : <span>b</span>} tail</p>

// ✅ good — wrap the conditional text in an element
<p>{val ? <span>foo</span> : <span>bar</span>} <span>x</span></p>
// ✅ good — no siblings, so it can't crash
<p>{val ? "foo" : "bar"}</p>
// ✅ good — both branches are a single bare text node, so React reuses the one
//          HostText fiber and only assigns nodeValue; nothing is ever moved
<p>{val ? "foo" : "bar"} <span>x</span></p>
// ✅ good — '' renders nothing and the other branch is an element
<p>{val ? <Badge>{val}</Badge> : ""} <span>x</span></p>
// ✅ good — map() produces ReactElement[], never a bare text node
<p>{val ? <b>x</b> : items?.map((i) => <input key={i} />)}<span>y</span></p>
```

### What makes a text node dangerous

A bare text node only matters if React creates a `HostText` fiber for it *and*
then removes it or uses it as an `insertBefore` reference. That splits into two
hazards, which this rule checks separately (all verified against react-dom
18.3.1 by mounting, wrapping every text node in a `<font>` the way Translate
does, then flipping state):

| Hazard | Condition | Example |
| --- | --- | --- |
| `removeChild` | a bare text node exists in one state and not in another | `{c ? "a" : ""}` throws |
| `insertBefore` | a bare text node exists and a **preceding** sibling mounts | `{c && <i/>}{"text"}` throws |

Two structural facts follow, and both are why some plausible-looking code is
*not* reported:

- **`''` renders nothing.** The reconciler's guard is
  `typeof newChild === 'string' && newChild !== ''`, so an empty string never
  creates a `HostText` fiber and can never be the node that throws. When a
  conditional has an `''` branch the hazard — if any — is the *other* branch, and
  that is where the rule reports.
- **`{c ? "a" : "b"}` cannot throw via `removeChild`.** Both branches are a
  single bare text node, so React reuses one `HostText` fiber and only assigns
  `nodeValue`. It is still reported when a conditional *precedes* it, because
  that is the `insertBefore` hazard.
- **`getHostSibling` searches forward only,** so the `insertBefore` hazard is
  asymmetric: a conditional *before* the text is dangerous, one *after* it is
  not.

### Known limitations

Without a type-checker some cases are simply undecidable, and the rule cannot be
read as "green means safe":

- **Bare identifiers are not reported.** `{cond ? label : ""}` is only flagged
  when nothing else in the conditional renders, because a variable could equally
  hold a `ReactNode`. Flagging every identifier would report every `ReactNode`
  prop in the codebase.
- **Member and optional-chain expressions are reported when undecidable.**
  `{cond ? obj.label : <b/>}` is flagged even though `obj.label` may be an
  element. This is deliberate: it is the historical behaviour, and the
  alternative is missing a common real hazard.
- **Text with no conditional on it is missed entirely.** Both rules only fire on
  conditionals, so this genuine `insertBefore` hazard is invisible to them:

  ```jsx
  {item?.icon}
  {item?.label}          {/* bare text; throws when icon mounts */}
  {isLoading && <Spinner />}
  ```

  Catching it requires knowing that `label` is a string, which needs type
  information. See
  [the upstream discussion](https://github.com/getcouped/eslint-plugin-react-google-translate)
  for the type-aware approach.

### `no-return-text-nodes`

Flags a React component (a capitalized function declaration) that returns a bare
string or number. Under Translate this can strand a stale value after a
re-render, silently, with no error.

```jsx
// ❌ bad
function Label() {
  return "hello";
}

// ✅ good
function Label() {
  return <span>hello</span>;
}
```

## Difference from the ESLint plugin

The original uses TypeScript type information to detect text-returning
expressions (e.g. a variable typed as `string`, `value.toLocaleString()`).
oxlint's JS-plugin context has **no type-checker**, so those type-driven cases
are not detected here. The purely syntactic cases — string/number literals,
template literals, member and optional-chain expressions, `t()` / `formatMessage()`
calls, and static text after a conditional — are all still flagged.

Note that the ESLint plugin's type information is *not* consulted for
`MemberExpression` / `ChainExpression`, so `items?.map(i => <li/>)` is reported
there too. See the "Known limitations" section above for what this port can and
cannot decide.

## License

MIT © Maksym Dolynchuk. Ported from `eslint-plugin-react-google-translate`
(MIT, getcouped).
