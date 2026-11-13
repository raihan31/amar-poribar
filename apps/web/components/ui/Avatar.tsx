export interface AvatarProps {
  name: string;
  size?: number;
}

/** First grapheme of the name on a soft circle; the name is the accessible label. */
export function Avatar({ name, size = 48 }: AvatarProps) {
  const initial = [...name.trim()][0] ?? "?";
  return (
    <span
      role="img"
      aria-label={name}
      className="ui-avatar"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
