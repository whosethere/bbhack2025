"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Calendar,
  Users,
  UserPlus,
  Briefcase,
  Globe,
  BarChart3,
  Settings,
  HelpCircle,
  FileText,
  UserCheck
} from "lucide-react";

const navigationItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Inbox, label: "Inbox", href: "/inbox" },
  { icon: Calendar, label: "Calendar & Todos", href: "/calendar" },
];

const recruitmentItems = [
  { icon: Briefcase, label: "Jobs", href: "/positions" },
  { icon: Users, label: "Candidates", href: "/candidates" },
  { icon: BarChart3, label: "Ranking Kandydatów", href: "/candidates/ranking" },
  { icon: UserPlus, label: "My Referrals", href: "/referrals" },
  { icon: Globe, label: "Career Site", href: "/career" },
  { icon: FileText, label: "Documents", href: "/documents" },
  { icon: UserCheck, label: "Onboarding", href: "/onboarding" },
];

const organizationItems = [
  { icon: Users, label: "Employee", href: "/employees" },
  { icon: BarChart3, label: "Structure", href: "/structure" },
  { icon: BarChart3, label: "Report", href: "/report" },
  { icon: Settings, label: "Setting", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-[200px] bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-sm font-bold">
            IH
          </div>
          <span>INTCH HUB</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4">
        {/* Main Navigation */}
        <nav className="space-y-1 px-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-orange-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Recruitment Section */}
        <div className="mt-8 px-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            RECRUITMENT
          </h3>
          <nav className="space-y-1">
            {recruitmentItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-orange-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Organization Section */}
        <div className="mt-8 px-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            ORGANIZATION
          </h3>
          <nav className="space-y-1">
            {organizationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-orange-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Help and Footer */}
      <div className="p-4 border-t border-gray-800">
        <Link
          href="/help"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <HelpCircle size={18} />
          Need Help?
        </Link>
        <div className="text-xs text-gray-500 mt-4">
          © 2025 AI Recruiter
        </div>
      </div>
    </div>
  );
}