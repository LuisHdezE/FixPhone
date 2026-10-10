import type { AppIconName } from '@/components/AppIcon';
import type { StatusBadgeTone } from '@/components/data-display/StatusBadge';

export type InventoryWorkflowStatus =
  | 'Pending Evaluation'
  | 'Donor'
  | 'Waiting'
  | 'In Progress'
  | 'Partially Dismantled'
  | 'Completed'
  | 'Refurbish'
  | 'Hold';

export interface InventoryMetricDto {
  id: string;
  label: string;
  value: number;
  note: string;
  tone: 'positive' | 'neutral' | 'warning';
  icon: AppIconName;
}

export interface InventoryQueueItemDto {
  id: string;
  deviceLabel: string;
  context: string;
  actionLabel: string;
  status: InventoryWorkflowStatus;
  statusTone: StatusBadgeTone;
  priority: 'High' | 'Normal';
}

export interface InventoryQueueFilterOptionDto {
  value: string;
  label: string;
}

export interface InventoryQueueFilterDto {
  id: 'status' | 'priority';
  label: string;
  allLabel: string;
  options: readonly InventoryQueueFilterOptionDto[];
}

export interface InventoryTrendPointDto {
  label: string;
  value: number;
}

export interface InventoryTrendSeriesDto {
  id: string;
  label: string;
  tone: 'brand' | 'info' | 'success';
  points: readonly InventoryTrendPointDto[];
}

export interface InventoryTrendAnalyticsDto {
  title: string;
  description: string;
  periodLabel: string;
  series: readonly InventoryTrendSeriesDto[];
}

export interface InventoryDistributionSegmentDto {
  id: string;
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'success' | 'warning' | 'neutral';
}

export interface InventoryDistributionAnalyticsDto {
  title: string;
  description: string;
  centerLabel: string;
  segments: readonly InventoryDistributionSegmentDto[];
}

export interface InventoryFunnelStageDto {
  id: string;
  label: string;
  value: number;
  note: string;
}

export interface InventoryFunnelAnalyticsDto {
  title: string;
  description: string;
  stages: readonly InventoryFunnelStageDto[];
}

export interface InventoryAnalyticsDto {
  trend: InventoryTrendAnalyticsDto;
  distribution: InventoryDistributionAnalyticsDto;
  funnel: InventoryFunnelAnalyticsDto;
}

export interface InventoryDashboardDto {
  title: string;
  description: string;
  breadcrumbs: readonly string[];
  attentionTitle: string;
  attentionDescription: string;
  metrics: readonly InventoryMetricDto[];
  analytics: InventoryAnalyticsDto;
  queue: readonly InventoryQueueItemDto[];
  queueFilters: readonly InventoryQueueFilterDto[];
}

export type OperationalDashboardReportStatusDto = {
  status: 'pending';
  label: string;
  reason: string;
};

export type OperationalDashboardLatestDeviceDto = {
  id: string;
  sku: string | null;
  title: string;
  status: string;
  updated_at: string | null;
};

export type OperationalDashboardDto = {
  generated_at: string;
  inventory: {
    total_items: number;
    total_units: number;
    stock_health: {
      healthy: number;
      reorder: number;
      out_of_stock: number;
      available_without_minimum: number;
    };
    by_type: Record<string, number>;
  };
  devices: {
    total: number;
    by_status: Record<string, number>;
    latest: readonly OperationalDashboardLatestDeviceDto[];
  };
  repair_quotes: {
    total: number;
  };
  valuations: {
    total: number;
    published: number;
  };
  reports: {
    financial: OperationalDashboardReportStatusDto;
    consignment_sales: OperationalDashboardReportStatusDto;
  };
};
