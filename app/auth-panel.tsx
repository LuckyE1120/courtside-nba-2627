'use client';
import { useRef, useState } from 'react';
import { getSupabase, supabaseConfigured } from '../lib/supabase';

export default function AuthPanel({ email, onChange }: { email: string | null; onChange: (email: string | null) => void }) {
  const [inputEmail, setInputEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const dialog = useRef<HTMLDialogElement>(null);

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

  async function signOut() {
    setBusy(true); setMessage('');
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      onChange(null); window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '退出失败，请重试。'); }
    finally { setBusy(false); }
  }

  return <>
    <button className="auth-trigger" type="button" aria-haspopup="dialog" aria-label={email ? `账号：${email}` : '登录或注册'} onClick={() => { setMessage(''); dialog.current?.showModal(); }}>
      <span className="auth-avatar" aria-hidden="true">{email ? email.charAt(0).toUpperCase() : '◇'}</span>
      <span className="auth-trigger-label">{email ? '我的账号' : '登录 / 注册'}</span>
      {email && <span className="auth-online" aria-hidden="true"/>}
    </button>
    <dialog ref={dialog} className="auth-dialog" aria-labelledby="auth-dialog-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="auth-dialog-body">
        <button className="auth-close" type="button" aria-label="关闭弹窗" onClick={() => dialog.current?.close()}>×</button>
        <div className="auth-dialog-mark" aria-hidden="true">◈</div>
        {!supabaseConfigured ? <><h2 id="auth-dialog-title">云端日记正在迁移</h2><p>赛程和本地观赛记录可以继续使用；云端服务配置完成后开放登录。</p></> : email ? <>
          <h2 id="auth-dialog-title">我的账号</h2><p>观赛记录与照片会同步到云端。</p>
          <div className="auth-account"><span className="auth-account-avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span><span><strong>{email}</strong><small>已登录 · 云端同步</small></span></div>
          <button className="auth-signout" type="button" disabled={busy} onClick={() => void signOut()}>{busy ? '请稍候…' : '退出登录'}</button>
        </> : <>
          <h2 id="auth-dialog-title">{mode === 'login' ? '欢迎回到场边' : '创建观赛日记账号'}</h2>
          <p>{mode === 'login' ? '登录后，你的观赛记录和照片会同步到云端。' : '注册并验证邮箱后，就能跨设备保存你的观赛时刻。'}</p>
          <form className="auth-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <label htmlFor="auth-email">邮箱</label><input id="auth-email" type="email" autoComplete="email" required placeholder="你的邮箱地址" value={inputEmail} onChange={event => setInputEmail(event.target.value)}/>
            <label htmlFor="auth-password">密码</label><input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} placeholder="至少 8 位密码" value={password} onChange={event => setPassword(event.target.value)}/>
            <button className="auth-submit" disabled={busy} type="submit">{busy ? '请稍候…' : mode === 'login' ? '登录观赛日记' : '创建账号'}</button>
          </form>
          <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? '第一次来？创建账号' : '已有账号？返回登录'}</button>
          {mode === 'login' && <small className="auth-footnote">首次登录后，当前浏览器的记录会自动同步。</small>}
        </>}
        {message && <p className="auth-message" role="status">{message}</p>}
      </div>
    </dialog>
  </>;
}
