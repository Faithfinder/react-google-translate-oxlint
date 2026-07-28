// None of these throw under Google Translate on react-dom 18.3.1, verified the
// same way as bad.tsx. Several were reported by the rule before the text-node
// contribution analysis was added.

const Badge = ({ children }: any) => <span>{children}</span>;

export function Good({ val }: any) {
  return (
    <div>
      {/* No siblings: nothing to insert before or remove around */}
      <p>{val || "bar"}</p>
      {/* Single string child: shouldSetTextContent means no HostText fiber is
          created at all, so this is structurally immune */}
      <p>{val ? "foo" : "bar"}</p>
      {/* Conditional *after* the text: getHostSibling searches forward only */}
      <p>
        text {val ? <span>a</span> : <span>b</span>}
      </p>
      <p>
        {val ? <span>a</span> : <span>b</span>}
        <span>c</span>
      </p>
      {/* Both branches are a single bare text node: React reuses the one
          HostText fiber and only assigns nodeValue, so nothing moves */}
      <p>
        {val ? "foo" : "bar"} <span>x</span>
      </p>
      <p>
        {val ? 1 : 2} <span>x</span>
      </p>
      {/* `''` renders nothing and the other branch is an element rooted at a
          host node, so no bare text ever mounts here */}
      <p>
        {val ? <Badge>{val}</Badge> : ""} <span>x</span>
      </p>
      {/* map() produces ReactElement[], never a bare text node — including
          through optional chaining */}
      <p>
        {val ? <b>x</b> : val?.items?.map((i: any) => <input key={i} />)}
        <span>y</span>
      </p>
      <p>
        {val && val.items.map((i: any) => <input key={i} />)}
        <span>y</span>
      </p>
    </div>
  );
}

export function GoodReturn() {
  return <span>text</span>;
}
