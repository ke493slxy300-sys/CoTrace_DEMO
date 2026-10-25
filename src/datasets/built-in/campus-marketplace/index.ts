import { ProjectDatasetSchema } from "../../schema";

import projectRaw from "./project_templates.json";
import membersRaw from "./members.json";
import dutiesRaw from "./duties.json";
import collaboratorSeedsRaw from "./collaborators-seeds.json";
import experienceCollaboratorRaw from "./experience-collaborator.json";
import blueprintNodeDutyRaw from "./blueprint-node-duty.json";
import blueprintNodesRaw from "./blueprint-nodes.json";
import blueprintDetailsRaw from "./blueprint-details.json";
import personalTodosRaw from "./personal-todos.json";
import collaborationSeedRaw from "./collaboration-seed.json";

export const campusMarketplaceDataset = ProjectDatasetSchema.parse({
  id: "campus-marketplace",
  label: "校园二手交易平台",
  project: projectRaw,
  members: membersRaw,
  duties: dutiesRaw,
  collaboratorSeeds: collaboratorSeedsRaw,
  experienceCollaborator: experienceCollaboratorRaw,
  blueprintNodeDuty: blueprintNodeDutyRaw,
  blueprintNodes: blueprintNodesRaw,
  blueprintDetails: blueprintDetailsRaw,
  personalTodos: personalTodosRaw,
  collaborationSeed: collaborationSeedRaw,
});
