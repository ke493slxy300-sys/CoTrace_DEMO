/** 演示预置内容被改写时的统一提示 */
export const DEMO_LOCKED_MESSAGE = '项目演示内容，无法修改';

/** 注册协作者选择被改写时的提示 */
export const DEMO_COLLABORATOR_LOCK_MESSAGE =
  '当前为 demo 演示模式，不允许更改';

export function isPresetBlueprintNode(node: {
  isBlank?: boolean;
}): boolean {
  return !node.isBlank;
}
