// Deterministic avatar color from a userId, so assignee avatars are colored
// without a backend round-trip. Same userId → same hue everywhere, on every client.
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // force 32-bit int
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

export function initialFor(name: string): string {
  return (name?.[0] ?? "?").toUpperCase();
}
