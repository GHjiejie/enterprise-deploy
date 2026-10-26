import type { Approval } from '../../contracts/operations';
export function approveApproval(request: Approval, comment = ''): Approval {
  if (request.status !== '待审批') throw new Error('当前阶段不能执行审批通过。');
  const status = request.amount >= 50000 ? '复核中' : '已通过';
  const action = status === '复核中' ? '初审通过' : '审批通过';
  return {
    ...request,
    status,
    history: [
      ...request.history,
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        action,
        comment: comment || '同意申请',
      },
    ],
  };
}
