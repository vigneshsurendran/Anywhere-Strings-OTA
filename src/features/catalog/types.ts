export type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export type EditorLanguage = {
  code: string;
  label: string;
};

export type EditorRow = {
  key: string;
  values: Record<string, string | null>;
  updatedAt?: string;
};
