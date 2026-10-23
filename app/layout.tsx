import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'COURTSIDE · NBA 每日看板',description:'2026–27 NBA 赛季每日赛程、即时比分与比赛总结，北京时间。',icons:{icon:'/courtside-nba-2627/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
