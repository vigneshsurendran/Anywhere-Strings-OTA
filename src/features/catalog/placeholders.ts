const PLACEHOLDER = /%(?:\d+\$)?[a-zA-Z]|\{[A-Za-z0-9_]+\}/g;

export function maskPlaceholders(text: string) {
  const tokens: string[] = [];
  const masked = text.replace(PLACEHOLDER, (match) => {
    const token = `⟦${tokens.length}⟧`;
    tokens.push(match);
    return token;
  });
  return { masked, tokens };
}

export function unmaskPlaceholders(text: string, tokens: string[]) {
  let result = text;
  for (let index = 0; index < tokens.length; index += 1) {
    const marker = `⟦${index}⟧`;
    if (!result.includes(marker)) return null;
    result = result.replace(marker, tokens[index] ?? "");
  }
  return result.includes("⟦") ? null : result;
}

export function keepsPlaceholders(source: string, translated: string) {
  const expected = source.match(PLACEHOLDER) ?? [];
  const found = translated.match(PLACEHOLDER) ?? [];
  return expected.length === found.length && expected.every((token, index) => token === found[index]);
}
