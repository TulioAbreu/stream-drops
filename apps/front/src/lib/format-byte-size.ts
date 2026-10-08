export function formatByteSize(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 10) return `${kb.toFixed(1)} KB`;
  return `${Math.round(kb)} KB`;
}
