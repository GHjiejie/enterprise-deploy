import type { Approval } from '../../contracts/operations';
import { requiredText } from '../../shared/validation';
export function rejectApproval(request: Approval, comment: string): Approval {
  if (request.status !== '待审批' && request.status !== '复核中')
    throw new Error('此申请已结束，不能驳回。');
  const status = '已驳回';
  const action = '驳回申请';
  return {
    ...request,
    status,
    history: [
      ...request.history,
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        action,
        comment: requiredText(comment, '驳回原因', 200),
      },
    ],
  };
}
