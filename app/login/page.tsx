import Link from "next/link";
import { login } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";

export default function Login() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="eyebrow mb-1">Procyra</div>
        <h1 className="text-xl font-bold mb-4">Log in</h1>
        <ActionForm action={login} className="space-y-3">
          <div><label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
          <div><label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" required autoComplete="current-password" /></div>
          <Submit>Log in</Submit>
        </ActionForm>
        <p className="mt-4 text-sm text-steel">No account? <Link className="text-accent font-semibold" href="/register">Create one</Link></p>
      </div>
    </main>
  );
}
