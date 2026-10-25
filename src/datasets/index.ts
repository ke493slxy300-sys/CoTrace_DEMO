import { campusMarketplaceDataset } from "./built-in/campus-marketplace";
import type { ProjectDataset } from "./schema";

export { campusMarketplaceDataset };
export type { ProjectDataset };

export const BUILT_IN_DATASETS = {
  [campusMarketplaceDataset.id]: campusMarketplaceDataset,
} satisfies Record<string, ProjectDataset>;
