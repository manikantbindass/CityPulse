'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { CityNetwork } from './network';
export function AuthPage({ register = false }: { register?: boolean }) {
  const [notice, setNotice] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(
      'Authentication is not configured. No credentials were submitted or stored. Open the sample workspace below.',
    );
  }
  return (
    <main className="auth-page">
      <section className="auth-art">
        <Link href="/" className="brand">
          <span className="brand-icon">cp</span>citypulse.
        </Link>
        <div>
          <p className="eyebrow">A MORE CONNECTED PERSPECTIVE</p>
          <p className="auth-art-title">
            Understand the city.
            <br />
            <span>See the possibility.</span>
          </p>
          <CityNetwork />
          <p>Urban supply and demand intelligence, grounded in evidence.</p>
        </div>
        <span className="fine-print">Local development preview</span>
      </section>
      <section className="auth-form-wrap">
        <Link href="/" className="text-action">
          ← Back to CityPulse
        </Link>
        <div className="auth-form">
          <p className="eyebrow">YOUR CITY WORKSPACE</p>
          <h1>{register ? 'Make room for better decisions.' : 'Welcome back.'}</h1>
          <p>
            {register
              ? 'Registration preview. Account provisioning is planned.'
              : 'Sign-in preview. Connect an OIDC provider for real accounts.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Name
                <input required name="name" autoComplete="name" maxLength={80} />
              </label>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                name="password"
                minLength={12}
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder="At least 12 characters"
              />
            </label>
            <Button type="submit">
              {register ? 'Preview registration' : 'Preview sign in'}
              <ArrowRight size={16} />
            </Button>
          </form>
          {notice && (
            <p role="status" className="result-box">
              {notice}
            </p>
          )}
          <div className="auth-divider">OR EXPLORE THE FOUNDATION</div>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              Open sample workspace <ArrowRight size={16} />
            </Link>
          </Button>
          <p className="fine-print">
            <ShieldCheck size={14} />
            Demo mode does not authenticate a user.
          </p>
          <p>
            {register ? 'Already exploring?' : 'New to CityPulse?'}{' '}
            <Link href={register ? '/login' : '/register'}>
              {register ? 'Sign-in preview' : 'Registration preview'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
