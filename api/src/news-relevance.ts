export function portoHeadline(title: string) {
  const normalized = title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return /(?:^|[^\p{L}\p{N}])(?:f\.?\s*c\.?\s*porto|futebol clube do porto|dragoes|dragao|portistas?)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}
