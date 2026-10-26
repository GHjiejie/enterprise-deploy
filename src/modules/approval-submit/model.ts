import type { FormEntry } from '../../contracts/presentation';
import type { Approval } from '../../contracts/operations';
import { positiveAmount, requiredText } from '../../shared/validation';
export function submitApproval(
  title: string,
  applicant: string,
  amount: number,
  extra: readonly FormEntry[] = [],
): Approval {
  const subject = requiredText(title, '申请事由', 120);
  return {
    id: `AP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    title: subject,
    applicant: requiredText(applicant, '申请人', 40),
    amount: positiveAmount(amount),
    ...(extra.length ? { extra: extra.map((entry) => ({ ...entry })) } : {}),
    status: '待审批',
    history: [
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        action: '提交申请',
        comment: subject,
      },
    ],
  };
}
