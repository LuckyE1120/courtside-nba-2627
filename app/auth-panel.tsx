'use client';
import { useState } from 'react';
import { acceptInvite, getUser, login, logout } from '@netlify/identity';

export default function AuthPanel({ email, inviteToken, onChange }: { email: string | null; inviteToken: string | null; onChange: (email: string | null) => void }) {
  const [inputEmail, setInputEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    setBusy(true); setMessage('');
    try {
      await login(inputEmail.trim(), password);
      const user = await getUser();
      onChange(user?.email || inputEmail.trim());
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '登录失败，请重试。'); }
    finally { setBusy(false); }
  };
  const join = async () => {
    if (!inviteToken) return;
    setBusy(true); setMessage('');
    try {
      const user = await acceptInvite(inviteToken, password);
      onChange(user.email ?? null);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '接受邀请失败，请重试。'); }
    finally { setBusy(false); }
  };
  if (email) return <div className="journal-auth"><span>已登录：{email} · 观赛记录会同步到云端</span><button onClick={async () => { await logout(); onChange(null); window.location.reload(); }}>退出登录</button></div>;
  if (inviteToken) return <div className="journal-auth"><div><strong>接受观赛日记邀请</strong><small>设置至少 8 位密码后，即可使用云端记录。密码只交给 Netlify Identity。</small></div><form onSubmit={event => { event.preventDefault(); void join(); }}><input type="password" required minLength={8} placeholder="设置密码" aria-label="设置观赛日记密码" value={password} onChange={event => setPassword(event.target.value)}/><button disabled={busy} type="submit">接受邀请</button></form>{message && <small role="status">{message}</small>}</div>;
  return <div className="journal-auth"><div><strong>登录后开启云端观赛日记</strong><small>账号需先接受邀请；现有浏览器记录会在首次登录后自动迁入。密码只交给 Netlify Identity。</small></div><form onSubmit={event => { event.preventDefault(); void submit(); }}><input type="email" required placeholder="邮箱" aria-label="登录邮箱" value={inputEmail} onChange={event => setInputEmail(event.target.value)}/><input type="password" required minLength={8} placeholder="密码" aria-label="登录密码" value={password} onChange={event => setPassword(event.target.value)}/><button disabled={busy} type="submit">登录</button></form>{message && <small role="status">{message}</small>}</div>;
}
