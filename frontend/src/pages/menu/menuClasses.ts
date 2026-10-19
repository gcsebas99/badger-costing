import type { MenuClass } from '@/api/sales'

export const MENU_CLASS: Record<MenuClass, { label: string; advice: string; className: string }> = {
  star: {
    label: 'Estrella',
    advice: 'Popular y rentable: mantener calidad y destacarla en el menú.',
    className: 'bg-brand-black text-brand-gold',
  },
  plowhorse: {
    label: 'Caballo',
    advice: 'Se vende mucho pero deja poco: revisar costo, porción o subir el precio.',
    className: 'bg-warn-soft text-warn',
  },
  puzzle: {
    label: 'Puzzle',
    advice: 'Rentable pero se vende poco: promocionarla, mejor ubicación o nombre.',
    className: 'bg-brand-craft/25 text-brand-black',
  },
  dog: {
    label: 'Perro',
    advice: 'Ni popular ni rentable: rediseñar o evaluar sacarla del menú.',
    className: 'bg-bad-soft text-bad',
  },
}
