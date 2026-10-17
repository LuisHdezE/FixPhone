type IconName = 'phone' | 'search' | 'cart' | 'heart' | 'user' | 'check' | 'shield' | 'chat' | 'arrow' | 'menu';
const paths: Record<IconName, string> = {
phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 5h4M11 19h2',
search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
cart: 'M2 3h3l3 12h11l3-9H6M9 21h.01M18 21h.01',
heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
user: 'M20 21v-2a7 7 0 0 0-14 0v2M17 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
check: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 14l3 3 5-6',
shield: 'M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6ZM8 12l3 3 5-6',
chat: 'M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L2 22l2.3-5.6a9 9 0 1 1 16.7-4.9ZM8 8c0 4 2 6 6 7l2-2-3-1-1 1-2-2 1-1Z',
arrow: 'M5 12h14m-6-6 6 6-6 6',
menu: 'M3 6h18M3 12h18M3 18h18',
};
export function StorefrontIcon({ name, className = '' }: { name: IconName; className?: string }) {
return <svg aria-hidden="true" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
