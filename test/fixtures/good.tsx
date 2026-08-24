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
      {/* map() builds a ReactElement[], never a bare text node */}
      <p>
        {val ? <b>x</b> : val?.items?.map((i: any) => <input key={i} />)}
        <span>y</span>
      </p>
      {/* a block body counts too, as long as every return is JSX */}
      <p>
        {val
          ? <b>x</b>
          : val?.items?.flatMap((i: any) => {
              if (i) return <input key={i} />;
              return <hr key={i} />;
            })}
        <span>y</span>
      </p>
    </div>
  );
}

export function GoodReturn() {
  return <span>text</span>;
}

export const GoodArrow = () => <span>text</span>;

// lowercase: a helper, not a component
export const goodLabel = () => "just a string";

// capitalised but not a function
export const Config = "some string";
