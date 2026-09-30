"use client";

import { useMemo, useState } from "react";
import type { CatalogLanguage } from "@/src/features/catalog/languages";
import { Input } from "@/src/components/ui/input";

export function LanguageSelect({ languages, name = "locale", label = "Language" }: {
  languages: CatalogLanguage[];
  name?: string;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return languages.filter((language) => language.popular);
    return languages.filter((language) => {
      return language.name.toLowerCase().includes(term) || language.code.toLowerCase().includes(term);
    });
  }, [languages, query]);
  const chosen = languages.find((language) => language.code === selected);

  return (
    <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0 text-sm">
      <legend className="text-sm text-primary">{label}</legend>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or code"
        aria-label="Search languages"
        className="border-secondary bg-canvas text-primary"
      />
      {chosen ? <p className="text-xs text-secondary">{`${chosen.name} (${chosen.code})`}</p> : null}
      <div className="-mx-2.5 grid max-h-40 gap-1 overflow-y-auto" role="listbox" aria-label={label}>
        {visible.map((language) => {
          const active = language.code === selected;
          return (
            <button
              key={language.code}
              type="button"
              role="option"
              aria-selected={active}
              className={`rounded-md px-2.5 py-1 text-left ${active ? "bg-ink text-onPrimary" : "text-primary hover:bg-canvas-secondary"}`}
              onClick={() => setSelected(language.code)}
            >
              {`${language.name} (${language.code})`}
            </button>
          );
        })}
        {visible.length === 0 ? <p className="px-2.5 py-1 text-secondary">No languages match that search.</p> : null}
      </div>
      <input type="hidden" name={name} value={selected} />
    </fieldset>
  );
}
