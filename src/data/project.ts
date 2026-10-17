import type { CourseProject } from '../types';
import { createLockedExperienceCollaborator } from './collaborators';

export const COURSE_NAME = '软件工程';

/** 系统预置的唯一模拟课程项目模板（创建前仅含固定体验者协作位） */
export const projectTemplate: CourseProject = {
  id: 'project-campus-marketplace',
  name: '校园二手交易平台',
  goal: '支持校内学生发布、浏览、咨询和完成二手教材与实验器材交易。',
  courseName: COURSE_NAME,
  processSteps: [
    '发布商品',
    '浏览与筛选',
    '查看商品详情',
    '发起咨询',
    '提交购买申请',
    '卖家确认',
    '买家确认收货',
    '评价或举报',
  ],
  created: false,
  collaborators: [createLockedExperienceCollaborator()],
};

/** @deprecated 使用 projectTemplate；保留导出名避免遗漏引用时难排查 */
export const project = projectTemplate;
