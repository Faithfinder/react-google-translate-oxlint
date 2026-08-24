# `no-return-text-nodes`

Flags a React component that returns a bare string or number.

Under Google Translate this fails more quietly than the crash the sibling rule
catches: the translated `<font>` wrapper survives a re-render, so the component
keeps displaying a **stale value** with no error at all.

A component is any capitalised function declaration, a capitalised binding
initialised with an arrow or function expression, anything wrapped in `memo(...)`
or `forwardRef(...)`, and the `render` of a class component.

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
```

## Options

```json
{
  "rules": {
    "react-google-translate/no-return-text-nodes": ["error", { "wrapWith": "span" }]
  }
}
```

### `wrapWith`

Default `"span"`. The element the suggested fix wraps the return value in.

## Suggestions

`oxlint --fix-suggestions` rewrites `return "text"` to
`return <span>{"text"}</span>`. No suggestion is offered in a `.ts`, `.mts` or
`.cts` file, where JSX does not parse.

## Limitations

Component detection is naming-based: a capitalised function that is not a
component is still checked, and a lowercase one that is will not be.
