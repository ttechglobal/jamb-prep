import { Atom, BookOpen, Calculator, Coins, Cross, Earth, FlaskConical, Landmark, Leaf, Receipt, ScrollText, Store, type LucideIcon } from "lucide-react";

/** Each subject gets one icon and colour, so it is recognisable at a glance across every screen. */
export const SUBJECT_STYLE: Record<string, { icon: LucideIcon; color: string; soft: string }> = {
  english: { icon: BookOpen, color: "#1D4ED8", soft: "#DBEAFE" },
  mathematics: { icon: Calculator, color: "#6D28D9", soft: "#EDE9FE" },
  physics: { icon: Atom, color: "#C2410C", soft: "#FFEDD5" },
  chemistry: { icon: FlaskConical, color: "#BE185D", soft: "#FCE7F3" },
  biology: { icon: Leaf, color: "#15803D", soft: "#DCFCE7" },
  economics: { icon: Coins, color: "#A16207", soft: "#FEF9C3" },
  government: { icon: Landmark, color: "#0F766E", soft: "#CCFBF1" },
  literature: { icon: ScrollText, color: "#B91C1C", soft: "#FEE2E2" },
  commerce: { icon: Store, color: "#4338CA", soft: "#E0E7FF" },
  accounting: { icon: Receipt, color: "#047857", soft: "#D1FAE5" },
  crk: { icon: Cross, color: "#7E22CE", soft: "#F3E8FF" },
  geography: { icon: Earth, color: "#0369A1", soft: "#E0F2FE" },
};

export const subjectStyle = (id: string) => SUBJECT_STYLE[id] ?? SUBJECT_STYLE.english;
