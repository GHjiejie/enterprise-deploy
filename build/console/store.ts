import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadBrands, parseEnterprise, selectModules, validateCatalog } from '../policy/manifest.ts';
import type { Enterprise } from '../policy/types.ts';
import { identifier, readJson, sha256 } from '../utils.ts';
import type { BrandSummary, ModuleSummary, ProfileEntry } from './contracts.ts';
import { capabilityLocation } from './grouping.ts';
import { externalLabels } from './external-labels.ts';

export class ConsoleError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'invalid_request',
  ) {
    super(message);
  }
}

export function regularDirectory(directory: string): void {
  const parent = dirname(directory);
  if (parent !== directory) regularDirectory(parent);
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new ConsoleError(400, '目录必须是普通目录，不能使用软链接');
}

export function readRegularFile(file: string): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(descriptor).isFile()) throw new ConsoleError(400, '配置必须是普通 JSON 文件');
    return readFileSync(descriptor);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ELOOP')
      throw new ConsoleError(400, '配置不能使用软链接');
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

const labels: Readonly<Record<string, { title: string; description: string }>> = {
  onboarding: {
    title: '新手指引',
    description: '首次欢迎、菜单与常用操作定位，按许可和权限生成步骤，可随时重新查看。',
  },
  stocktakes: {
    title: '库存盘点',
    description: '按仓盘点、逐项录入、复核与差异过账，库存变化需重新盘点。',
  },
  'stocktake-create-field-title': {
    title: '盘点名称字段',
    description: '必需字段 · 控件与校验器独立配置和交付。',
  },
  'stocktake-create-field-warehouse': {
    title: '盘点仓库字段',
    description: '必需字段 · 控件与校验器独立配置和交付。',
  },
  'stocktake-create-field-note': {
    title: '盘点备注字段',
    description: '可选字段 · 关闭后输入和校验逻辑一起裁剪。',
  },
  'stocktake-count-field-quantity': {
    title: '实盘数量字段',
    description: '必需字段 · 控件与校验器独立配置和交付。',
  },
  'stocktake-count-field-reason': {
    title: '盘点差异原因字段',
    description: '实盘存在差异时必填，数量改变后清空原因。',
  },
  'stocktake-return-field-reason': {
    title: '重盘原因字段',
    description: '必需字段 · 控件与校验器独立配置和交付。',
  },
  'stocktake-cancel-field-reason': {
    title: '作废原因字段',
    description: '必需字段 · 控件与校验器独立配置和交付。',
  },
  'stocktake-approve-field-comment': {
    title: '盘点复核意见字段',
    description: '可选字段 · 关闭后输入和校验逻辑一起裁剪。',
  },
  'stocktake-create': {
    title: '创建盘点',
    description: '固定仓库账面快照，阻止同仓重复的未结束盘点。',
  },
  'stocktake-count': { title: '录入实盘', description: '逐项保存实盘数，有差异时必须填写原因。' },
  'stocktake-submit': {
    title: '提交盘点复核',
    description: '校验全部明细已盘点后锁定录入并进入复核。',
  },
  'stocktake-approve': { title: '盘点复核通过', description: '仅处理待复核单据，通过后等待过账。' },
  'stocktake-return': {
    title: '退回重盘',
    description: '更新账面快照并清空原实盘，保留历史记录。',
  },
  'stocktake-post': { title: '差异过账', description: '复查库存版本和预留量，全部明细一次过账。' },
  'stocktake-cancel': {
    title: '作废盘点',
    description: '填写原因后终止未结束盘点，保留单据与记录。',
  },
  'stocktake-detail': {
    title: '盘点详情',
    description: '承载可独立裁剪的盘点明细、流转记录和扩展信息。',
  },
  'stocktake-column-warehouse': {
    title: '盘点 · 仓库列',
    description: '列表列 · 独立装配标题、单元格与计算逻辑。',
  },
  'stocktake-column-progress': {
    title: '盘点 · 盘点进度列',
    description: '列表列 · 独立装配标题、单元格与计算逻辑。',
  },
  'stocktake-column-difference': {
    title: '盘点 · 净差异列',
    description: '列表列 · 独立装配标题、单元格与计算逻辑。',
  },
  'stocktake-column-status': {
    title: '盘点 · 状态列',
    description: '列表列 · 独立装配标题、单元格与计算逻辑。',
  },
  'stocktake-detail-lines': {
    title: '盘点 · 盘点明细页签',
    description: '详情页签 · 按企业装配并在首次打开时加载。',
  },
  'stocktake-detail-history': {
    title: '盘点 · 流转记录页签',
    description: '详情页签 · 按企业装配并在首次打开时加载。',
  },
  'stocktake-detail-extra': {
    title: '盘点 · 扩展信息页签',
    description: '详情页签 · 按企业装配并在首次打开时加载。',
  },
  'inventory-adjust-field-quantity': {
    title: '调整数量字段',
    description: '必填字段 · 操作能力显式依赖此字段，校验与控件配置独立交付。',
  },
  'inventory-adjust-field-reason': {
    title: '调整原因字段',
    description: '必填字段 · 操作能力显式依赖此字段，校验与控件配置独立交付。',
  },
  'inventory-transfer-field-source': {
    title: '源仓商品字段',
    description: '必填字段 · 操作能力显式依赖此字段，校验与控件配置独立交付。',
  },
  'inventory-transfer-field-target': {
    title: '目标仓字段',
    description: '必填字段 · 切换源仓清空目标，选项仅含同商品的其他仓库。',
  },
  'inventory-transfer-field-quantity': {
    title: '调拨数量字段',
    description: '必填字段 · 操作能力显式依赖此字段，校验与控件配置独立交付。',
  },
  'inventory-transfer-field-reason': {
    title: '调拨原因字段',
    description: '必填字段 · 操作能力显式依赖此字段，校验与控件配置独立交付。',
  },
  'approval-approve-field-comment': {
    title: '初审意见字段',
    description: '可选字段 · 可独立关闭，意见输入与校验器一起裁剪，使用默认记录。',
  },
  'approval-reject-field-reason': {
    title: '驳回原因字段',
    description: '必填字段 · 操作能力显式依赖此字段，校验与控件配置独立交付。',
  },
  'approval-review-field-comment': {
    title: '复核意见字段',
    description: '可选字段 · 可独立关闭，意见输入与校验器一起裁剪，使用默认记录。',
  },
  'approval-approve': {
    title: '审批通过',
    description: '按钮 · 仅初审待审批申请，大额申请进入复核。',
  },
  'approval-reject': { title: '审批驳回', description: '按钮 · 独立驳回申请，原因必填。' },
  'approval-review': {
    title: '审批复核',
    description: '按钮 · 仅处理复核中申请，不附带通过或驳回实现。',
  },
  'order-field-customer': {
    title: '客户名称字段',
    description: '字段 · 必填输入，受提交能力依赖约束。',
  },
  'order-field-amount': {
    title: '订单金额字段',
    description: '字段 · 必填输入，受提交能力依赖约束。',
  },
  'order-field-reference': {
    title: '客户参考号字段',
    description: '字段 · 可单独启停，校验器随字段一起裁剪。',
  },
  'approval-field-title': {
    title: '申请事由字段',
    description: '字段 · 必填输入，受提交能力依赖约束。',
  },
  'approval-field-applicant': {
    title: '申请人字段',
    description: '字段 · 必填输入，受提交能力依赖约束。',
  },
  'approval-field-amount': {
    title: '申请金额字段',
    description: '字段 · 必填输入，受提交能力依赖约束。',
  },
  'approval-field-cost-center': {
    title: '成本中心字段',
    description: '字段 · 可单独启停，校验器随字段一起裁剪。',
  },
  'approval-field-urgency': {
    title: '紧急程度字段',
    description: '字段 · 可单独启停，校验器随字段一起裁剪。',
  },
  'order-column-customer': {
    title: '订单 · 客户列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'order-column-amount': {
    title: '订单 · 订单金额列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'order-column-status': {
    title: '订单 · 状态列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'approval-column-title': {
    title: '审批 · 申请事由列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'approval-column-applicant': {
    title: '审批 · 申请人列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'approval-column-amount': {
    title: '审批 · 金额列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'approval-column-status': {
    title: '审批 · 状态列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'inventory-column-quantity': {
    title: '库存 · 实存列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'inventory-column-reserved': {
    title: '库存 · 预留列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'inventory-column-available': {
    title: '库存 · 可用 / 预警线列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'inventory-column-status': {
    title: '库存 · 状态列',
    description: '表格列 · 标题、单元格渲染与相关格式化逻辑独立裁剪。',
  },
  'approval-detail': { title: '审批详情', description: '入口 · 承载按企业装配的详情页签。' },
  'order-detail-overview': {
    title: '订单 · 基本信息页签',
    description: '详情页签 · 标题与内容作为一个能力裁剪，首次选中时加载。',
  },
  'approval-detail-overview': {
    title: '审批 · 申请信息页签',
    description: '详情页签 · 标题与内容作为一个能力裁剪，首次选中时加载。',
  },
  'order-detail-extra': {
    title: '订单 · 扩展信息页签',
    description: '详情页签 · 标题与内容作为一个能力裁剪，首次选中时加载。',
  },
  'approval-detail-extra': {
    title: '审批 · 扩展信息页签',
    description: '详情页签 · 标题与内容作为一个能力裁剪，首次选中时加载。',
  },
  'order-notes': { title: '订单备注', description: '详情页签 · 独立装配记录面板与操作。' },
  'approval-history': { title: '审批记录', description: '详情页签 · 独立装配记录面板与操作。' },

  'order-create': { title: '新建订单', description: '按钮 · 新建订单表单，客户与金额校验。' },
  'order-bulk-complete': {
    title: '批量完成',
    description: '批量操作 · 校验整批状态，确认后一次完成。',
  },
  'order-priority': { title: '订单加急', description: '行内按钮 · 为待处理订单设置或取消加急。' },
  'order-detail': { title: '订单详情', description: '详情面板 · 查看订单快照并承载详情扩展。' },

  inventory: { title: '库存管理', description: '完整模块 · 按仓库查询库存、预留和缺货预警。' },
  'inventory-adjust': {
    title: '库存调整',
    description: '行内表单 · 有原因的盘盈盘亏，保护预留库存。',
  },
  'inventory-transfer': {
    title: '库存调拨',
    description: '工具栏流程 · 同商品跨仓调拨，原子扣减与增加。',
  },
  approvals: { title: '审批中心', description: '完整模块 · 金额、状态筛选与分级审批进度。' },
  'approval-submit': {
    title: '发起审批',
    description: '工具栏表单 · 提交带事由、申请人和金额的申请。',
  },
  'audit-log': { title: '操作审计', description: '完整模块 · 订阅本次会话的跨模块操作并筛选。' },
  orders: { title: '订单管理', description: '订单列表、搜索、选择与基础业务能力。' },
  reports: { title: '经营报表', description: '独立报表页面、数据适配与专属图表资源。' },
  'order-export': { title: '订单导出', description: '订单工具栏扩展、CSV 转换与独立 Worker。' },
};

/** Keep the saved pure-data manifest compatible with the repository's 100-column JSON format. */
export function enterpriseJson(profile: Enterprise): string {
  const selected = profile.enabledModules.map((id) => JSON.stringify(id));
  const inline = `  "enabledModules": [${selected.join(', ')}],`;
  const modules =
    inline.length <= 100
      ? inline
      : [
          '  "enabledModules": [',
          ...selected.map((id, index) => `    ${id}${index === selected.length - 1 ? '' : ','}`),
          '  ],',
        ].join('\n');
  return [
    '{',
    '  "schemaVersion": 1,',
    `  "enterpriseId": ${JSON.stringify(profile.enterpriseId)},`,
    modules,
    `  "brandingId": ${JSON.stringify(profile.brandingId)}`,
    '}',
    '',
  ].join('\n');
}

export function createProfileStore(root: string) {
  const directory = resolve(root, 'config/enterprises');
  function definition() {
    return {
      catalog: validateCatalog(readJson(resolve(root, 'config/module-catalog.json')), root).modules,
      brands: loadBrands(root),
    };
  }
  function validate(value: unknown): Enterprise {
    try {
      const rawId =
        value && typeof value === 'object' && 'enterpriseId' in value
          ? value.enterpriseId
          : undefined;
      const id = identifier(rawId, 'enterpriseId');
      const profile = parseEnterprise(value, id);
      const data = definition();
      selectModules(data.catalog, profile);
      if (!data.brands.some((item) => item.id === profile.brandingId))
        throw new Error('UNKNOWN_BRAND');
      return profile;
    } catch (error) {
      throw new ConsoleError(400, error instanceof Error ? error.message : '企业配置无效');
    }
  }
  function read(id: string): ProfileEntry | null {
    identifier(id, 'enterpriseId');
    const file = resolve(directory, `${id}.json`);
    let bytes: Buffer;
    try {
      bytes = readRegularFile(file);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
    const profile = validate(JSON.parse(bytes.toString('utf8')));
    if (profile.enterpriseId !== id) throw new ConsoleError(400, '企业标识与文件名不一致');
    return { profile, revision: sha256(bytes) };
  }
  function list(): ProfileEntry[] {
    regularDirectory(directory);
    return readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => {
        const entry = read(identifier(name.slice(0, -5), 'enterprise file'));
        if (!entry) throw new ConsoleError(409, '配置目录发生变化，请重新加载', 'conflict');
        return entry;
      });
  }
  function save(value: unknown, revision: unknown): ProfileEntry {
    const profile = validate(value);
    if (revision !== null && (typeof revision !== 'string' || !/^[a-f0-9]{64}$/u.test(revision)))
      throw new ConsoleError(400, '配置版本无效');
    regularDirectory(directory);
    const current = read(profile.enterpriseId);
    if ((current?.revision ?? null) !== revision)
      throw new ConsoleError(
        409,
        '配置已被其他页面或编辑器修改，请重新加载服务器配置后重试。',
        'conflict',
      );
    const temporary = resolve(directory, `.console-${randomUUID()}.tmp`);
    const target = resolve(directory, `${profile.enterpriseId}.json`);
    const bytes = Buffer.from(enterpriseJson(profile));
    try {
      writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 });
      regularDirectory(directory);
      if ((read(profile.enterpriseId)?.revision ?? null) !== revision)
        throw new ConsoleError(409, '配置发生并发修改，请重新加载后重试。', 'conflict');
      renameSync(temporary, target);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
    return { profile, revision: sha256(bytes) };
  }
  function summaries(): { modules: ModuleSummary[]; brands: BrandSummary[] } {
    const data = definition();
    return {
      modules: data.catalog.map((item) => ({
        id: item.id,
        ...capabilityLocation(item.id),
        kind: item.id.startsWith('resource-')
          ? 'resource'
          : item.id.includes('-field-')
            ? 'field'
            : item.id.includes('-column-')
              ? 'column'
              : ['order-notes', 'approval-history'].includes(item.id) ||
                  /-detail-(?:overview|extra|lines|history)$/u.test(item.id)
                ? 'tab'
                : [
                      'orders',
                      'reports',
                      'inventory',
                      'stocktakes',
                      'approvals',
                      'audit-log',
                      'access',
                      'account',
                      'billing',
                      'media',
                      'operations',
                      'company',
                    ].includes(item.id)
                  ? 'module'
                  : 'action',
        title: externalLabels[item.id]?.title ?? labels[item.id]?.title ?? item.id,
        description:
          externalLabels[item.id]?.description ??
          labels[item.id]?.description ??
          '已登记的业务模块。',
        requires: item.requires,
        conflicts: item.conflicts,
      })),
      brands: data.brands.map((item) => ({ id: item.id, name: item.name })),
    };
  }
  return { validate, read, list, save, summaries };
}
export type ProfileStore = ReturnType<typeof createProfileStore>;
