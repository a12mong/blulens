import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

describe('middleware', () => {
  it('redirects /committee to /login?next=/committee without bl_session', () => {
    const request = new NextRequest('http://localhost:3100/committee');
    const response = middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fcommittee');
  });

  it('allows /committee with bl_session cookie', () => {
    const request = new NextRequest('http://localhost:3100/committee');
    request.cookies.set('bl_session', '1');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('redirects /login to /me with bl_session cookie', () => {
    const request = new NextRequest('http://localhost:3100/login');
    request.cookies.set('bl_session', '1');
    const response = middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/me');
  });

  it('allows /tournaments without bl_session cookie', () => {
    const request = new NextRequest('http://localhost:3100/tournaments');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('allows /register without bl_session cookie', () => {
    const request = new NextRequest('http://localhost:3100/register');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('redirects /review to /login without bl_session', () => {
    const request = new NextRequest('http://localhost:3100/review/123');
    const response = middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Freview%2F123');
  });

  it('redirects /admin to /login without bl_session', () => {
    const request = new NextRequest('http://localhost:3100/admin');
    const response = middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('allows /me with bl_session cookie', () => {
    const request = new NextRequest('http://localhost:3100/me');
    request.cookies.set('bl_session', '1');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('redirects /register to /me with bl_session cookie', () => {
    const request = new NextRequest('http://localhost:3100/register');
    request.cookies.set('bl_session', '1');
    const response = middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/me');
  });

  it('allows / (home) without bl_session', () => {
    const request = new NextRequest('http://localhost:3100/');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('allows /403 without bl_session', () => {
    const request = new NextRequest('http://localhost:3100/403');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });
});
