export function Spinner({ label }: { label: string }) {
  return <span role="status" aria-label={label} className="ui-spinner" />;
}
