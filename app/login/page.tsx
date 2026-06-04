import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            RP
          </div>
          <h1 className="text-xl font-semibold tracking-normal">资源池管理平台</h1>
          <p className="text-sm text-muted-foreground">使用用户名和密码登录后台。</p>
        </div>
        <LoginForm nextPath={params.next ?? "/dashboard"} />
      </section>
    </main>
  );
}
