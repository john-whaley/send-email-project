"use client";

import { KeyboardEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export function PageJump({
  page,
  pageCount,
  onPageChange,
  ariaLabel = "跳转页码"
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}) {
  const [value, setValue] = useState(String(page));

  useEffect(() => {
    setValue(String(page));
  }, [page]);

  function commitPage() {
    const nextPage = Math.min(pageCount, Math.max(1, Math.floor(Number(value))));

    if (Number.isFinite(nextPage)) {
      onPageChange(nextPage);
      setValue(String(nextPage));
      return;
    }

    setValue(String(page));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commitPage();
    }
  }

  return (
    <Input
      type="number"
      min={1}
      max={pageCount}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => setValue(String(page))}
      className="h-9 w-16 text-center"
      aria-label={ariaLabel}
    />
  );
}
