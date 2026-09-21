import {
  BookOpen,
  Building2,
  Calculator,
  CircleDollarSign,
  Plane,
  type LucideIcon,
} from 'lucide-react';

export interface PerceptionApplication {
  description: string;
  icon: LucideIcon;
  name: string;
  path: string;
  slug: string;
}

export const applications: PerceptionApplication[] = [
  {
    description: 'Singapore property planning',
    icon: Building2,
    name: 'Housing',
    path: 'housing-affordability-calculator/',
    slug: 'housing-affordability-calculator',
  },
  {
    description: 'Trading lessons and exercises',
    icon: BookOpen,
    name: 'Trading course',
    path: 'trading-course/',
    slug: 'trading-course',
  },
  {
    description: 'Compare compensation packages',
    icon: CircleDollarSign,
    name: 'Compensation',
    path: 'us-compensation-compare/',
    slug: 'us-compensation-compare',
  },
  {
    description: 'Explore award flight deals',
    icon: Plane,
    name: 'KrisFlyer escapes',
    path: 'krisflyer-spontaneous-escapes/',
    slug: 'krisflyer-spontaneous-escapes',
  },
  {
    description: 'Model long-term investment growth',
    icon: Calculator,
    name: 'Compound planner',
    path: 'compound-interest-calculator/',
    slug: 'compound-interest-calculator',
  },
];

export function findCurrentApplication(pathname: string) {
  return applications.find((application) => pathname.includes(`/${application.slug}/`));
}
