import { Leaf, Music, Palette, Rocket, Trophy, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SessionCategory } from '../../../shared/schemas';

export const CATEGORIES: Record<SessionCategory, { label: string; Icon: LucideIcon }> = {
  art: { label: 'Art', Icon: Palette },
  music: { label: 'Music & Movement', Icon: Music },
  stem: { label: 'STEM', Icon: Rocket },
  sports: { label: 'Sports', Icon: Trophy },
  nature: { label: 'Nature', Icon: Leaf },
  cooking: { label: 'Cooking', Icon: UtensilsCrossed },
};
