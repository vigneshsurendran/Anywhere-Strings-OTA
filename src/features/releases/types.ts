import type { Platform } from "@/src/features/catalog/validation";

export type ReleaseRecord = {
  id: number;
  platform: Platform;
  version: number;
  name: string;
  createdAt: string;
  createdBy: string;
  releasedAt: string | null;
  releasedBy: string | null;
  isProduction: boolean;
};
