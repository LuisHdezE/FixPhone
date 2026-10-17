import { Link } from 'react-router';
import { StorefrontIcon } from './StorefrontIcon';

export function StorefrontHeroBenefits({ whatsappHref }: { whatsappHref: string }) {
  return <div className="fp-hero-benefits" role="group" aria-label="Servicios y envíos de FixPhone">
    <Link to="/store/contact" className="fp-hero-benefit">
      <StorefrontIcon name="wrench" />
      <span><strong>Presupuesto sin costo</strong><small>En reparaciones</small></span>
    </Link>
    <Link to="/store/warranty" className="fp-hero-benefit">
      <StorefrontIcon name="shield" />
      <span><strong>Garantía de 1 mes</strong><small>Consultá las condiciones</small></span>
    </Link>
    <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="fp-hero-benefit">
      <StorefrontIcon name="truck" />
      <span><strong>Envíos en Montevideo y al interior</strong><small>Interior por DAC · Envío a cargo del cliente</small></span>
    </a>
  </div>;
}
