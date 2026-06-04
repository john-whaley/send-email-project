"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

type SearchableSelectProps = {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
};

export function SearchableSelect({
  id,
  value,
  options,
  placeholder = "请选择",
  emptyText = "没有匹配项",
  disabled,
  onValueChange
}: SearchableSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selectedOption = options.find((option) => option.value === value) ?? null;

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      `${option.label} ${option.value} ${option.searchText ?? ""}`.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function selectOption(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" && filteredOptions[0]) {
      event.preventDefault();
      selectOption(filteredOptions[0].value);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          id={id}
          type="text"
          value={open ? query : selectedOption?.label ?? ""}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex h-9 w-full rounded-md border bg-background px-8 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          )}
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-listbox` : undefined}
          aria-autocomplete="list"
        />
        <button
          type="button"
          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setOpen((current) => !current)}
          disabled={disabled}
          aria-label="展开选项"
        >
          <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-card p-1 text-foreground shadow-md"
        >
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => selectOption(option.value)}
                className={cn(
                  "flex h-9 w-full items-center justify-between gap-2 rounded-sm px-2 text-left text-sm hover:bg-muted",
                  option.value === value && "bg-muted"
                )}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.value === value ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              </button>
            ))
          ) : (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
