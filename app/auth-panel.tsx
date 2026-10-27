'use client';
import { useState } from 'react';
import { getSupabase, supabaseConfigured } from '../lib/supabase';

export default function AuthPanel({ email, onChange }: { email: string | null; onChange: (email: string | null) => void }) {
  const [inputEmail, setInputEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  async function submit() {
    setBusy(true); setMessage('');
    try {
      const auth = getSupabase().auth;
      if (mode === 'signup') {
        const { data, error } = await auth.signUp({ email: inputEmail.trim(), password, options: { emailRedirectTo: window.location.href } });
        if (error) throw error;
        if (!data.session) { setMessage('请查收验证邮件，完成验证后返回网站登录。'); return; }
      } else {
        const { error } = await auth.signInWithPassword({ email: inputEmail.trim(), password });
        if (error) throw error;
      }
      onChange(inputEmail.trim());
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '操作失败，请重试。'); }
    finally { setBusy(false); }
  }

  if (!supabaseConfigured) return <div className="journal-auth"><div><strong>云端日记正在迁移</strong><small>赛程和本地观赛记录可以继续使用；待 Supabase 配置完成后开放登录和照片。</small></div></div>;
  if (email) return <div className="journal-auth"><span>已登录：{email} · 观赛记录会同步到云端</span><button onClick={async () => { await getSupabase().auth.signOut(); onChange(null); window.location.reload(); }}>退出登录</button></div>;
  return <div className="journal-auth"><div><strong>{mode === 'login' ? '登录观赛日记' : '创建观赛日记账号'}</strong><small>新站使用 Supabase 登录；第一次使用请注册并验证邮箱。现有浏览器记录会在首次登录后自动同步。</small></div><form onSubmit={event => { event.preventDefault(); void submit(); }}><input type="email" required placeholder="邮箱" aria-label="登录邮箱" value={inputEmail} onChange={event => setInputEmail(event.target.value)}/><input type="password" required minLength={8} placeholder="密码（至少 8 位）" aria-label="登录密码" value={password} onChange={event => setPassword(event.target.value)}/><button disabled={busy} type="submit">{busy ? '请稍候…' : mode === 'login' ? '登录' : '注册'}</button></form><button className="journal-auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? '首次使用？创建账号' : '已有账号？返回登录'}</button>{message && <small role="status">{message}</small>}</div>;
}
