import type { MenuItem, OrderTool, Owned, Runtime } from '../../contracts/feature';
import type { GuideStep } from '../../shared/guide/types';
export function collectGuideSteps(
  menus: readonly Owned<MenuItem>[],
  tools: readonly Owned<OrderTool>[],
  can: Runtime['can'],
): GuideStep[] {
  const steps: GuideStep[] = [];
  const allowed = menus
    .filter(({ owner, value }) => value.guide && can(owner, value.permission))
    .sort(
      (a, b) =>
        (a.value.guide?.order ?? 0) - (b.value.guide?.order ?? 0) ||
        a.value.id.localeCompare(b.value.id),
    );
  for (const { value: menu } of allowed) {
    if (!menu.guide) continue;
    steps.push({
      id: `menu:${menu.id}`,
      target: `menu:${menu.id}`,
      routeName: menu.routeName,
      title: menu.title,
      description: menu.guide.description,
      location: '主导航菜单',
    });
    for (const { value: tool } of tools
      .filter(
        ({ owner, value }) =>
          value.guide?.routeName === menu.routeName && can(owner, value.permission),
      )
      .sort((a, b) => a.value.order - b.value.order || a.value.id.localeCompare(b.value.id))) {
      if (!tool.guide) continue;
      steps.push({
        id: `tool:${tool.id}`,
        target: `tool:${tool.id}`,
        routeName: menu.routeName,
        title: tool.guide.title,
        description: tool.guide.description,
        location: `${menu.title} · 页面工具栏`,
      });
    }
  }
  return steps;
}
