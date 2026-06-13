export type CheckboxProgress = {
  completed: number;
  total: number;
  progress: number;
};

export function checkboxProgress(markdown: string): CheckboxProgress {
  const matches = [...markdown.matchAll(/^\s*[-*]\s+\[( |x|X)\]\s+/gm)];
  const total = matches.length;
  const completed = matches.filter((match) => match[1].toLowerCase() === "x").length;
  return {
    completed,
    total,
    progress: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
