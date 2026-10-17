import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { StorefrontHeroBannerDto } from '../application/storefront.dto';
import { StorefrontHeroBenefits } from './StorefrontHeroBenefits';

export function StorefrontHeroCarousel({ banners, whatsappHref }: { banners: readonly StorefrontHeroBannerDto[]; whatsappHref: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const current = index % Math.max(1, banners.length);
  useEffect(() => {
    if (!playing || paused || banners.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % banners.length), 6500);
    return () => window.clearInterval(timer);
  }, [playing, paused, banners.length]);
  if (!banners.length) return null;
  const slide = banners[current]!;
  function move(delta: number) { setIndex((current + delta + banners.length) % banners.length); }
  return <section className="fp-hero" aria-label="Anuncios de FixPhone" aria-roledescription="carrusel"
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    onKeyDown={event => { if (event.target instanceof HTMLInputElement) return; if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1); }}>
    <div className="fp-hero-slide" role="group" aria-roledescription="diapositiva" aria-label={`${current + 1} de ${banners.length}`}>
      <img className="fp-hero-image" src={slide.image.src} alt={slide.image.alt} style={{ objectPosition: slide.image.objectPosition ?? 'center' }} fetchPriority="high" />
      <div className="fp-hero-shade" />
      <div className="fp-hero-copy">
        <p className="fp-eyebrow">{slide.eyebrow}</p>
        <h1>{slide.title}</h1><p className="fp-hero-description">{slide.description}</p>
        <Link className="fp-hero-cta" to={slide.actionHref}>{slide.actionLabel}<span aria-hidden="true">›</span></Link>
      </div>
    </div>
    {banners.length > 1 && <>
      <button className="fp-carousel-arrow fp-carousel-prev" aria-label="Anuncio anterior" onClick={() => move(-1)}>‹</button>
      <button className="fp-carousel-arrow fp-carousel-next" aria-label="Anuncio siguiente" onClick={() => move(1)}>›</button>
      <div className="fp-carousel-controls">
        {banners.map((banner, i) => <button key={banner.id} aria-label={`Ver anuncio ${i + 1}: ${banner.title}`} aria-current={current === i ? 'true' : undefined} className={current === i ? 'is-active' : ''} onClick={() => setIndex(i)} />)}
        <button className="fp-carousel-play" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pausar carrusel' : 'Reproducir carrusel'}>{playing ? 'Ⅱ' : '▷'}</button>
      </div>
    </>}
    <StorefrontHeroBenefits whatsappHref={whatsappHref} />
    <span className="sr-only" aria-live={playing ? 'off' : 'polite'}>{slide.title}</span>
  </section>;
}
