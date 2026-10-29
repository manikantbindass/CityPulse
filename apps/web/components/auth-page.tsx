'use client';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { CityNetwork } from './network';
export function AuthPage({ register = false }: { register?: boolean }) {
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
              ? 'Request an account from your organization administrator.'
              : 'Sign in securely through your organization’s OIDC provider.'}
          </p>
          <Button asChild>
            {/* OIDC needs a document navigation, never a client fetch/prefetch. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/auth/login">
              Continue with identity provider <ArrowRight size={16} />
            </a>
          </Button>
          <p className="fine-print">
            Passwords and optional MFA are managed by your organization’s identity provider. New
            users require an administrator-created tenant membership.
          </p>
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
