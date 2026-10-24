/**
 * Tenant branding. Four colours and a logo per organisation, stored in
 * organizations.settings.brand and applied as CSS variables so every
 * Tailwind brand class (bg-stratefix-yellow, text-brand-on-primary, ...)
 * follows the signed-in organisation without any component knowing.
 */
export interface Brand {
  /** Buttons, active states, progress. */
  primary: string;
  /** Text and icons placed on the primary colour. */
  on_primary: string;
  /** Sidebar / navigation background. */
  nav: string;
  /** Links and secondary highlights. */
  accent: string;
}

export const DEFAULT_BRAND: Brand = { primary: '#FDB913', on_primary: '#000000', nav: '#000000', accent: '#1E40AF' };

export interface OrganizationInfo {
  id: string;
  name: string;
  logo_url: string | null;
  status: 'active' | 'suspended';
  plan: string;
  settings: { brand?: Partial<Brand>; induction_days?: number; probation_months?: number } & Record<string, unknown>;
}

const hexToRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** Writes the brand onto <html>. Missing or invalid values fall back to the default. */
export function applyBrand(brand?: Partial<Brand> | null) {
  const b: Brand = { ...DEFAULT_BRAND, ...(brand || {}) };
  const root = document.documentElement;
  (Object.keys(DEFAULT_BRAND) as (keyof Brand)[]).forEach(k => {
    root.style.setProperty(`--brand-${k.replace('_', '-')}`, hexToRgb(b[k]) || hexToRgb(DEFAULT_BRAND[k])!);
  });
}

/** Black or white, whichever reads better on the given colour. */
export function readableOn(hex: string): string {
  const rgb = hexToRgb(hex); if (!rgb) return '#000000';
  const [r, g, b] = rgb.split(' ').map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000000' : '#FFFFFF';
}
