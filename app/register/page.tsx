import Link from "next/link";
import { register } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";

export default function Register() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="eyebrow mb-1">Procyra</div>
        <h1 className="text-xl font-bold mb-4">Create your account</h1>
        <ActionForm action={register} className="space-y-3">
          <div><label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" required autoComplete="name" /></div>
          <div><label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
          <div><label className="label" htmlFor="password">Password (8+ characters)</label>
            <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
          <Submit>Create account</Submit>
        </ActionForm>
        <p className="mt-4 text-sm text-steel">Already registered? <Link className="text-accent font-semibold" href="/login">Log in</Link></p>
      </div>
    </main>
  );
}
