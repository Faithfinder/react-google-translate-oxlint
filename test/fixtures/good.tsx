export function Good({ val }: any) {
  return (
    <div>
      <p>{val || "bar"}</p>
      <p>{val ? "foo" : "bar"}</p>
      <p>
        text {val ? <span>a</span> : <span>b</span>}
      </p>
      <p>
        {val ? <span>a</span> : <span>b</span>}
        <span>c</span>
      </p>
      {/* '' renders nothing and the other branch is an element, so no bare
          text node ever exists at this position */}
      <p>
        {val ? <b>{val}</b> : ""} <span>x</span>
      </p>
      {/* a fragment of nothing but elements renders no bare text either */}
      <p>
        {val ? <><b>a</b><i>b</i></> : ""} <span>x</span>
      </p>
    </div>
  );
}

export function GoodReturn() {
  return <span>text</span>;
}
