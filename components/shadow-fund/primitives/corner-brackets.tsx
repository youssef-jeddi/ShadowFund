export function CornerBrackets() {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: "var(--pearl)",
    borderStyle: "solid",
  };
  return (
    <>
      <span style={{ ...base, top: 8, left: 8, borderWidth: "1px 0 0 1px" }} />
      <span style={{ ...base, top: 8, right: 8, borderWidth: "1px 1px 0 0" }} />
      <span style={{ ...base, bottom: 8, left: 8, borderWidth: "0 0 1px 1px" }} />
      <span style={{ ...base, bottom: 8, right: 8, borderWidth: "0 1px 1px 0" }} />
    </>
  );
}
