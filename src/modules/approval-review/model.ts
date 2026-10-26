import type { Approval } from '../../contracts/operations';
export function reviewApproval(request: Approval, comment = ''): Approval {
  if (request.status !== '复核中') throw new Error('当前阶段不能执行审批复核。');
  const status = '已通过';
  const action = '复核通过';
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
