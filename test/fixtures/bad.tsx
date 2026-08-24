export function Bad({ val, obj, symbol }: any) {
  return (
    <div>
      <p>
        {val ? "foo" : "bar"} <span>x</span>
      </p>
      <p>
        {val ? <span>a</span> : <span>b</span>} tail
      </p>
      <p>
        {val && "foo"}
        <span>x</span>
      </p>
      <p>
        {val ? obj.a : <span>b</span>} <span>y</span>
      </p>
      {/* the fragment's own bare text is removed when the branch flips */}
      <p>
        {val ? <>bare {obj.name} text</> : ""}
        <span>x</span>
      </p>
      {/* a bare identifier is not something this plugin can identify without
          types, so the '' stays the only signal that text toggles here */}
      <p>
        {symbol === "%" ? symbol : ""}
        <input />
      </p>
      {/* a falsy-but-renderable test makes `&& ""` a text node: count === 0
          renders "0" here, and nothing once it is non-zero */}
      <p>
        {obj.count && ""}
        <span>x</span>
      </p>
      {/* the fragment renders through an expression container, so its text is
          invisible to us -- the '' remains the only signal */}
      <p>
        {val ? <>{obj.name}</> : ""}
        <span>x</span>
      </p>
      {/* the callback returns strings, so this map may well render text */}
      <p>
        {val ? <b>x</b> : obj?.items?.map((i: any) => String(i))}
        <span>y</span>
      </p>
    </div>
  );
}

export function Stale() {
  return "i am a bare text node";
}

export const StaleArrow = () => "i am a bare text node";

export const StaleArrowBlock = () => {
  return "i am a bare text node";
};

export const StaleFnExpr = function () {
  return "i am a bare text node";
};
