'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useLogin } from './api';

/** only same-site relative paths are allowed as ?next= (no open redirect) */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin({
    onSuccess: (me) => router.replace(safeNext(params.get('next')) ?? '/events'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ identifier, password });
  }

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1">
        อีเมลหรือชื่อผู้ใช้
        <input data-testid="login-identifier" className="rounded border p-2" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
      </label>
      <label className="flex flex-col gap-1">
        รหัสผ่าน
        <input data-testid="login-password" className="rounded border p-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {login.error ? <p role="alert" data-testid="login-error">{login.error.message}</p> : null}
      <button type="submit" data-testid="login-submit" disabled={login.isPending} className="rounded bg-primary p-2 text-primary-foreground">
        เข้าสู่ระบบ
      </button>
    </form>
  );
}
