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
    </div>
  );
}

export function GoodReturn() {
  return <span>text</span>;
}
