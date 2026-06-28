"use client";

import type { RoleName } from "@/lib/roles";
import type { RoleDashboardProps } from "@/components/dashboards/types";
import {
  AdminDashboard,
  ManagerDashboard,
  AnalystDashboard,
  SupportAgentDashboard,
  ViewerDashboard,
  DeveloperDashboard,
  QaEngineerDashboard,
  ProductOwnerDashboard,
  MarketingDashboard,
  SalesDashboard,
} from "@/components/dashboards";

interface Props extends RoleDashboardProps {
  role: RoleName;
}

export function RoleDashboard(props: Props) {
  const { role } = props;

  switch (role) {
    case "Admin":
      return <AdminDashboard {...props} />;
    case "Manager":
      return <ManagerDashboard {...props} />;
    case "Analyst":
      return <AnalystDashboard {...props} />;
    case "Support Agent":
      return <SupportAgentDashboard {...props} />;
    case "Viewer":
      return <ViewerDashboard {...props} />;
    case "Developer":
      return <DeveloperDashboard {...props} />;
    case "QA Engineer":
      return <QaEngineerDashboard {...props} />;
    case "Product Owner":
      return <ProductOwnerDashboard {...props} />;
    case "Marketing":
      return <MarketingDashboard {...props} />;
    case "Sales":
      return <SalesDashboard {...props} />;
    default:
      return <ViewerDashboard {...props} />;
  }
}
