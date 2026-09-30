export type PlanKey = 'free' | 'starter' | 'pro' | 'team';

export const PLAN_CATALOG: Record<PlanKey, {
  label: string;
  price: number;
  quoteLimit: number;
  templates: string[];
  currencies: string[];
  languages: string[];
  features: {
    customLogo: boolean;
    removeBrand: boolean;
    tracking: boolean;
    fullStats: boolean;
    csv: boolean;
    customization: boolean;
    teamUsers: number;
  };
}> = {
  free: { label: 'Free', price: 0, quoteLimit: 5, templates: ['modern', 'classic'], currencies: ['GBP'], languages: ['en'], features: { customLogo: false, removeBrand: false, tracking: false, fullStats: false, csv: false, customization: false, teamUsers: 1 } },
  starter: { label: 'Starter', price: 19, quoteLimit: 30, templates: ['modern', 'classic', 'bold', 'minimal', 'technical'], currencies: ['GBP', 'USD', 'EUR'], languages: ['en'], features: { customLogo: true, removeBrand: true, tracking: true, fullStats: true, csv: true, customization: false, teamUsers: 1 } },
  pro: { label: 'Pro', price: 39, quoteLimit: 100, templates: ['modern', 'classic', 'bold', 'minimal', 'technical'], currencies: ['GBP', 'USD', 'EUR', 'AED', 'SAR', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK'], languages: ['en', 'ar', 'es', 'fr'], features: { customLogo: true, removeBrand: true, tracking: true, fullStats: true, csv: true, customization: true, teamUsers: 1 } },
  team: { label: 'Team', price: 79, quoteLimit: Infinity, templates: ['modern', 'classic', 'bold', 'minimal', 'technical'], currencies: ['GBP', 'USD', 'EUR', 'AED', 'SAR', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK'], languages: ['en', 'ar', 'es', 'fr'], features: { customLogo: true, removeBrand: true, tracking: true, fullStats: true, csv: true, customization: true, teamUsers: 3 } }
};

export function normalizePlan(value: unknown): PlanKey {
  return value === 'starter' || value === 'pro' || value === 'team' ? value : 'free';
}