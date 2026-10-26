'use client';
import { useState } from 'react';
import { getUser, login, logout, signup } from '@netlify/identity';

export default function AuthPanel({ email, onChange }: { email: string | null; onChange: (email: string | null) => void }) {
  const [inputEmail, setInputEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (mode: 'login' | 'signup') => {
    setBusy(true); setMessage('');
    try {
      if (mode === 'signup') {
        await signup(inputEmail.trim(), password);
        setMessage('注册邮件已发送，请先确认邮箱，再返回此页面登录。');
      } else {
        await login(inputEmail.trim(), password);
        const user = await getUser();
        onChange(user?.email || inputEmail.trim());
        window.location.reload();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : '登录失败，请重试。'); }
    finally { setBusy(false); }
  };
  if (email) return <div className="journal-auth"><span>已登录：{email} · 观赛记录会同步到云端</span><button onClick={async () => { await logout(); onChange(null); window.location.reload(); }}>退出登录</button></div>;
  return <div className="journal-auth"><div><strong>登录后开启云端观赛日记</strong><small>现有浏览器记录会在首次登录后自动迁入；密码只交给 Netlify Identity。</small></div><form onSubmit={event => { event.preventDefault(); void submit('login'); }}><input type="email" required placeholder="邮箱" aria-label="登录邮箱" value={inputEmail} onChange={event => setInputEmail(event.target.value)}/><input type="password" required minLength={8} placeholder="密码" aria-label="登录密码" value={password} onChange={event => setPassword(event.target.value)}/><button disabled={busy} type="submit">登录</button><button disabled={busy} type="button" onClick={() => void submit('signup')}>注册</button></form>{message && <small role="status">{message}</small>}</div>;
}
