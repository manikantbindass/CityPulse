export type District = {
  id: string;
  name: string;
  demand: number;
  supply: number;
  businesses: number;
  opportunity: string;
  longitude: number;
  latitude: number;
};
export const districts: District[] = [
  {
    id: 'central',
    name: 'Central District',
    demand: 842,
    supply: 710,
    businesses: 128,
    opportunity: 'Last-mile groceries',
    longitude: 77.5946,
    latitude: 12.9716,
  },
  {
    id: 'north',
    name: 'North Quarter',
    demand: 624,
    supply: 680,
    businesses: 94,
    opportunity: 'Shared cold storage',
    longitude: 77.595,
    latitude: 13.01,
  },
  {
    id: 'east',
    name: 'East Market',
    demand: 756,
    supply: 590,
    businesses: 112,
    opportunity: 'Local distribution',
    longitude: 77.635,
    latitude: 12.974,
  },
  {
    id: 'south',
    name: 'South Commons',
    demand: 538,
    supply: 510,
    businesses: 76,
    opportunity: 'Community retail',
    longitude: 77.59,
    latitude: 12.935,
  },
  {
    id: 'west',
    name: 'West Gardens',
    demand: 412,
    supply: 460,
    businesses: 63,
    opportunity: 'Inventory exchange',
    longitude: 77.55,
    latitude: 12.974,
  },
  {
    id: 'riverside',
    name: 'Riverside',
    demand: 680,
    supply: 545,
    businesses: 89,
    opportunity: 'Fresh produce hub',
    longitude: 77.625,
    latitude: 12.94,
  },
];
// All quantities are synthetic units/day, not measured city activity.
export const series = Array.from({ length: 14 }, (_, i) => {
  const demand = [610, 640, 625, 690, 670, 730, 710, 760, 725, 780, 755, 810, 790, 842][i];
  return {
    day: `Oct ${i + 1}`,
    demand,
    supply: Math.round(demand * 0.83 + (i % 3) * 18),
    forecast: demand + 34,
    confidence: [demand + 8, demand + 65] as [number, number],
  };
});
export const notifications = [
  {
    id: 'n1',
    title: 'East Market supply gap',
    body: 'The sample dataset shows 166 units/day of unmet demand.',
    time: 'Seed scenario 01',
    type: 'insight',
  },
  {
    id: 'n2',
    title: 'Forecast baseline available',
    body: 'Explore an illustrative trend and uncertainty band.',
    time: 'Seed scenario 02',
    type: 'model',
  },
  {
    id: 'n3',
    title: 'Welcome to your workspace',
    body: 'Use the command palette to jump between tools.',
    time: 'Getting started',
    type: 'system',
  },
];
export const navigation = [
  { href: '/dashboard', label: 'Overview', icon: 'overview', group: 'Workspace' },
  { href: '/explorer', label: 'City explorer', icon: 'map', group: 'Workspace' },
  { href: '/intelligence', label: 'Supply & demand', icon: 'analytics', group: 'Intelligence' },
  { href: '/predictions', label: 'AI predictions', icon: 'forecast', group: 'Intelligence' },
  { href: '/opportunities', label: 'Opportunities', icon: 'business', group: 'Intelligence' },
  { href: '/optimization', label: 'Resource planning', icon: 'resource', group: 'Intelligence' },
  { href: '/verification', label: 'Blockchain verification', icon: 'verify', group: 'Tools' },
  { href: '/analyst', label: 'AI analyst', icon: 'chat', group: 'Tools' },
  { href: '/reports', label: 'Reports', icon: 'report', group: 'Tools' },
  { href: '/notifications', label: 'Notifications', icon: 'bell', group: 'Account' },
  { href: '/settings', label: 'Profile & settings', icon: 'settings', group: 'Account' },
  { href: '/admin', label: 'Administrator', icon: 'admin', group: 'Account', admin: true },
  { href: '/help', label: 'Help & onboarding', icon: 'help', group: 'Account' },
];
export const pageInfo: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Your city, in perspective.',
    subtitle: 'A connected view of supply, demand, and emerging possibilities.',
  },
  explorer: {
    title: 'Explore every district.',
    subtitle: 'Put urban signals in their geographic context.',
  },
  intelligence: {
    title: 'Where supply meets demand.',
    subtitle: 'Compare district needs and uncover the gaps between them.',
  },
  predictions: {
    title: 'A clearer view of what’s next.',
    subtitle: 'Explore trends with an honest view of model uncertainty.',
  },
  opportunities: {
    title: 'Find room for possibility.',
    subtitle:
      'Discover bounded opportunities with explicit evidence, assumptions and risk weights.',
  },
  optimization: {
    title: 'Put resources where they matter.',
    subtitle: 'Test inventory, budget, capacity and coverage constraints with the decision engine.',
  },
  verification: {
    title: 'Evidence you can trace.',
    subtitle: 'Compute a data fingerprint. Verify provenance one step at a time.',
  },
  analyst: {
    title: 'Ask a better city question.',
    subtitle: 'PulseAI retrieves authorized records, explains limitations, and links its evidence.',
  },
  reports: {
    title: 'Make intelligence shareable.',
    subtitle: 'Choose the districts and fields you want in your report.',
  },
  notifications: {
    title: 'Keep the important signals close.',
    subtitle: 'Sample notifications to explore your workspace.',
  },
  settings: {
    title: 'A workspace that feels like yours.',
    subtitle: 'Manage local preferences and your demo persona.',
  },
  admin: {
    title: 'A considered control center.',
    subtitle: 'Local administrator preview. No production accounts or roles are modified.',
  },
  help: {
    title: 'A little direction goes a long way.',
    subtitle: 'Get familiar with CityPulse and understand the foundation.',
  },
};
