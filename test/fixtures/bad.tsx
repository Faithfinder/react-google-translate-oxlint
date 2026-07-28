// Every case here throws NotFoundError under Google Translate on react-dom
// 18.3.1, verified by mounting, wrapping each text node in a <font>, then
// flipping state. See good.tsx for the shapes that do not throw.

export function Bad({ val, obj }: any) {
  return (
    <div>
      {/* H1: the text unmounts when `val` flips — `''` renders nothing */}
      <p>
        {val ? "foo" : ""} <span>x</span>
      </p>
      {/* H1: `&&` renders nothing on the falsy branch, so the text unmounts */}
      <p>
        {val && "foo"}
        <span>x</span>
      </p>
      {/* H1: a fragment of bare text on one branch, nothing on the other */}
      <p>
        {val ? <>bare {obj.name} text</> : ""}
        <span>x</span>
      </p>
      {/* H1: undecidable member expression, against a branch rendering an element */}
      <p>
        {val ? obj.a : <span>b</span>} <span>y</span>
      </p>
      {/* H2: static text preceded by a conditional that can mount */}
      <p>
        {val ? <span>a</span> : <span>b</span>} tail
      </p>
      {/* H2: both branches are text so H1 is safe, but a preceding conditional
          can still insertBefore against the reused text node */}
      <p>
        {val && <i>icon</i>}
        {val ? "foo" : "bar"}
        <span>x</span>
      </p>
    </div>
  );
}

export function Stale() {
  return "i am a bare text node";
}
