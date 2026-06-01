import { SearchWorkspace } from "@/components/search/search-workspace";
import { PageHeader } from "@/components/page-header";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  return (
    <>
      <PageHeader title="全局搜索" description="跨资源池搜索池子、资源内容以及资源的关联对象。" />
      <SearchWorkspace initialQuery={params.q ?? ""} />
    </>
  );
}
