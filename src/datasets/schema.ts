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

export type ProjectDataset = z.infer<typeof ProjectDatasetSchema>;

export const DiscussionLifecycleSchema = z.enum([
  "open",
  "ready_to_archive",
  "archived",
]);

export const DecisionStatusSchema = z.enum([
  "none",
  "generating",
  "draft",
  "confirmed",
]);

export const DecisionSourceSchema = z.enum(["member", "project-agent"]);

export const TeamDecisionSchema = z.object({
  status: DecisionStatusSchema,
  source: DecisionSourceSchema.optional(),
  draftContent: z.string().optional(),
  content: z.string().optional(),
  confirmedBy: z.string().optional(),
  confirmedAt: z.string().optional(),
  generationRequestedAt: z.string().optional(),
});

export const CollaborationMessageSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export const AnnotationTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("node"),
  }),

  z.object({
    kind: z.literal("file"),
    fileId: z.string(),
    fileLabel: z.string().optional(),
  }),

  z.object({
    kind: z.literal("lines"),
    fileId: z.string(),
    lineStart: z.number(),
    lineEnd: z.number(),
    fileLabel: z.string().optional(),
  }),

  z.object({
    kind: z.literal("trace"),
    traceCardId: z.string(),
    traceTitle: z.string().optional(),
  }),
]);

export const ProjectAnnotationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  nodeId: z.string(),
  authorId: z.string(),
  typeLabel: z.string(),
  summary: z.string(),
  content: z.string(),
  target: AnnotationTargetSchema,
  affectsCode: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TeamDiscussionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  nodeId: z.string(),
  annotationId: z.string().optional(),
  title: z.string(),
  participantIds: z.array(z.string()),
  lifecycle: DiscussionLifecycleSchema,
  waitingOnMemberId: z.string().optional(),
  messages: z.array(CollaborationMessageSchema),
  teamDecision: TeamDecisionSchema,
  archivedBy: z.string().optional(),
  archivedAt: z.string().optional(),
  decisionDraftPreset: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CollaborationStoreDataSchema = z.object({
  version: z.literal(1),
  annotations: z.array(ProjectAnnotationSchema),
  discussions: z.array(TeamDiscussionSchema),
});

export const AiTraceSchema = z.object({
  id: z.string(),
  fileId: z.string(),
  lineStart: z.number(),
  lineEnd: z.number(),
  sourceType: z.literal("simulated"),
  label: z.string(),
  input: z.string(),
  suggestion: z.string(),
  status: z.enum(["ai-suggestion", "viewed", "pending-confirm"]),
});

export const NodeAiTracesSchema = z.array(AiTraceSchema);

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
  collaborationSeed: CollaborationStoreDataSchema,
});
