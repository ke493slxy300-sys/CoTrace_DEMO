import { z } from "zod";

/** CoTrace 当前允许使用的职责 ID */
export const DutyIdSchema = z.enum([
  "project-owner",
  "backend-api",
  "database-design",
  "frontend-pages",
  "test-acceptance",
  "trade-integration",
  "product-analysis",
]);

const MemberRoleSchema = z.enum([
  "owner",
  "backend",
  "frontend",
  "database",
  "qa",
]);

const MemberSlotSchema = z.enum(["preset", "reserved", "easter-egg"]);

/** 单项职责的数据格式 */
export const DutyDefinitionSchema = z.object({
  id: DutyIdSchema,
  label: z.string(),
  assignable: z.boolean(),
  lockedToExperience: z.boolean().optional(),
});

/** 单个成员的数据格式 */
export const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  avatarUrl: z.string().optional(),
  skillTags: z.array(z.string()),
  defaultPrimaryDutyId: DutyIdSchema.nullable(),
  selectable: z.boolean(),
  locked: z.boolean(),
  enabled: z.boolean(),
  slot: MemberSlotSchema,
  roleLabel: z.string(),
  roles: z.array(MemberRoleSchema),
});

/**
 * JSON 中的项目模板。
 * collaborators 不在这里，因为它是在 project.ts 中根据注册结果组装的。
 */
export const ProjectTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string(),
  courseName: z.string(),
  processSteps: z.array(z.string()),
  created: z.boolean(),
});

/** 完整成员列表 */
export const TeamMembersSchema = z.array(TeamMemberSchema);

/** 完整职责目录 */
export const DutyCatalogSchema = z.array(DutyDefinitionSchema);

/** 从验证规则自动生成对应的 TypeScript 类型 */
export type ProjectTemplateData = z.infer<typeof ProjectTemplateSchema>;
export type TeamMemberData = z.infer<typeof TeamMemberSchema>;
export type DutyDefinitionData = z.infer<typeof DutyDefinitionSchema>;

/** 已经写入项目的完整协作者 */
export const ProjectCollaboratorSchema = z.object({
  memberId: z.string(),
  primaryDutyId: DutyIdSchema,
  additionalDutyId: DutyIdSchema.nullable(),
  locked: z.boolean(),
});

/** Demo 注册时使用的协作者种子 */
export const CollaboratorSeedSchema = z.object({
  memberId: z.string(),
  primaryDutyId: DutyIdSchema,
  additionalDutyId: DutyIdSchema.nullable(),
});

export const CollaboratorSeedsSchema = z.array(CollaboratorSeedSchema);

/** 蓝图节点名称与职责 ID 的对应表 */
export const BlueprintNodeDutySchema = z.record(
  z.string(),
  DutyIdSchema.nullable(),
);

export const BlueprintArtifactSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["code", "doc", "test"]),
});

export const BlueprintNodeDetailSchema = z.object({
  background: z.string(),
  goal: z.string(),
  artifacts: z.array(BlueprintArtifactSchema),
  openIssues: z.array(z.string()),
  evolution: z.array(z.string()),
});

/** 键是蓝图节点 ID，值是该节点的详情 */
export const BlueprintDetailsSchema = z.record(
  z.string(),
  BlueprintNodeDetailSchema,
);

export const PersonalTodoStatusSchema = z.enum([
  "open",
  "waiting",
  "done",
  "blocked-later",
]);

export const TeamPendingItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  fromMemberName: z.string(),
  summary: z.string(),
  status: PersonalTodoStatusSchema,
  relatedNodeId: z.string().nullable(),
  relatedDiscussionId: z.string().nullable(),
  track: z.enum(["ready", "later"]),
});

export const PersonalTodosSchema = z.array(TeamPendingItemSchema);

export const BlueprintNodeStatusSchema = z.enum([
  "todo",
  "in-progress",
  "awaiting-review",
  "discussing",
  "needs-change",
  "accepted",
  "done",
]);

/**
 * AI 初始生成的蓝图节点。
 * 它还不是页面最终使用的 BlueprintNode。
 */
export const BlueprintNodeSeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  suggestedCollaboratorIds: z.array(z.string()),
  status: BlueprintNodeStatusSchema,
  dependsOn: z.array(z.string()),
  acceptance: z.array(z.string()),
  x: z.number(),
  y: z.number(),
});

export const BlueprintNodeSeedsSchema = z.array(BlueprintNodeSeedSchema);

export type BlueprintNodeSeedData = z.infer<typeof BlueprintNodeSeedSchema>;

/** 一套完整的 CoTrace 项目数据集 */
export const ProjectDatasetSchema = z.object({
  id: z.string(),
  label: z.string(),
  project: ProjectTemplateSchema,
  members: TeamMembersSchema,
  duties: DutyCatalogSchema,
  collaboratorSeeds: CollaboratorSeedsSchema,
  experienceCollaborator: ProjectCollaboratorSchema,
  blueprintNodeDuty: BlueprintNodeDutySchema,
  blueprintNodes: BlueprintNodeSeedsSchema,
  blueprintDetails: BlueprintDetailsSchema,
  personalTodos: PersonalTodosSchema,
});

export type ProjectDataset = z.infer<typeof ProjectDatasetSchema>;
