import type { CourseProject } from "../types";
import { createLockedExperienceCollaborator } from "./collaborators";

import { campusMarketplaceDataset } from "../datasets";
const projectTemplateData = campusMarketplaceDataset.project;

export const COURSE_NAME = projectTemplateData.courseName;

/** 系统预置的唯一模拟课程项目模板 */
export const projectTemplate: CourseProject = {
  ...projectTemplateData,
  collaborators: [createLockedExperienceCollaborator()],
};

/** @deprecated 使用 projectTemplate */
export const project = projectTemplate;
