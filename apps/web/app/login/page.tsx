import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-2xl font-bold">เข้าสู่ระบบ</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
