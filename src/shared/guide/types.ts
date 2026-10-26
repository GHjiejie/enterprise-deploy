export interface GuideStep {
  readonly id: string;
  readonly target: string;
  readonly title: string;
  readonly description: string;
  readonly location: string;
  readonly routeName?: string;
}
export const guideStorageKey = (scope: string): string => `enterprise:guide:v1:${scope}`;
