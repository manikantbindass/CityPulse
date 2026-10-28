import {
  LayoutDashboard,
  Map,
  ChartNoAxesCombined,
  Sparkles,
  Store,
  SlidersHorizontal,
  ShieldCheck,
  MessagesSquare,
  FileBarChart,
  Bell,
  Settings,
  Shield,
  CircleHelp,
} from 'lucide-react';
export const icons = {
  overview: LayoutDashboard,
  map: Map,
  analytics: ChartNoAxesCombined,
  forecast: Sparkles,
  business: Store,
  resource: SlidersHorizontal,
  verify: ShieldCheck,
  chat: MessagesSquare,
  report: FileBarChart,
  bell: Bell,
  settings: Settings,
  admin: Shield,
  help: CircleHelp,
};
export function NavIcon({ name }: { name: string }) {
  const Icon = icons[name as keyof typeof icons] ?? LayoutDashboard;
  return <Icon size={18} aria-hidden="true" />;
}
