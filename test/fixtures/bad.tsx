export function Bad({ val, obj }: any) {
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
