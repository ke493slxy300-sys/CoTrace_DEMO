import {
  BlueprintNodeDutySchema,
  CollaboratorSeedsSchema,
  DutyCatalogSchema,
  ProjectCollaboratorSchema,
  ProjectTemplateSchema,
  TeamMembersSchema,
} from "../../schema";

import projectRaw from "./project_templates.json";
import membersRaw from "./members.json";
import dutiesRaw from "./duties.json";
import collaboratorSeeds from "./collaborators-seeds.json";
import experienceCollaborator from "./experience-collaborator.json";
import blueprintNodeDuty from "./blueprint-node-duty.json";
import blueprintNodes from "./blueprint-nodes.json";
import blueprintDetails from "./blueprint-details.json";
import personalTodos from "./personal-todos.json";

const project = ProjectTemplateSchema.parse(projectRaw);
const members = TeamMembersSchema.parse(membersRaw);
const duties = DutyCatalogSchema.parse(dutiesRaw);

export const campusMarketplaceDataset = {
  id: "campus-marketplace",
  label: "校园二手交易平台",
  project,
  members,
  duties,
  collaboratorSeeds,
  experienceCollaborator,
  blueprintNodeDuty,
  blueprintNodes,
  blueprintDetails,
  personalTodos,
};
