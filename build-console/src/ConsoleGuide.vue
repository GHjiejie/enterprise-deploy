<script setup lang="ts">
import GuidedTour from '../../src/shared/guide/GuidedTour.vue';
import type { GuideStep } from '../../src/shared/guide/types';
import { guideStorageKey } from '../../src/shared/guide/types';
const steps: readonly GuideStep[] = [
  {
    id: 'enterprise',
    target: 'console-enterprise',
    title: '选择企业配置',
    description:
      '从这里选择要交付的企业，也可以选择「新建企业」填写新的企业标识。已有配置会自动带入下方模块选择。',
    location: '企业与构建环境',
  },
  {
    id: 'brand',
    target: 'console-brand',
    title: '选择品牌与环境',
    description:
      '在这里选择企业品牌和构建环境。品牌决定页面主题与标识，生产或预发布环境决定本次打包模式。',
    location: '企业与构建环境',
  },
  {
    id: 'modules',
    target: 'console-modules',
    title: '按业务模块管理功能',
    description:
      '在模块导航中选择订单、库存或其他业务模块，再展开操作分组。搜索和筛选可以快速定位需要的能力，已选配置会保留。',
    location: '选择交付模块',
  },
  {
    id: 'capabilities',
    target: 'console-capabilities',
    title: '配置按钮、字段和依赖',
    description:
      '操作按钮和对应字段放在同一分组，列表列和详情页签单独管理。「启用整组」和「关闭整组」会先预览影响；依赖名称可以点击定位。',
    location: '当前业务模块',
  },
  {
    id: 'preview',
    target: 'console-summary',
    title: '检查本次交付配置',
    description:
      '这里按模块汇总已选和排除的能力。展开模块可核对细项，打包前确认企业、品牌和环境符合预期。',
    location: '本次交付配置',
  },
  {
    id: 'actions',
    target: 'console-actions',
    title: '保存配置或立即打包',
    description:
      '「保存配置」只保存企业清单；「保存并打包」会保存配置并启动构建。依赖缺失时先按页面提示补齐，再提交。',
    location: '配置表单下方',
  },
  {
    id: 'result',
    target: 'console-build',
    title: '查看构建与交付结果',
    description:
      '在这里跟踪构建、裁剪、审计和封包复验进度。全部通过后会出现交付包下载、固定版本预览和审计报告入口。',
    location: '构建与交付',
  },
];
</script>
<template>
  <GuidedTour
    :steps="steps"
    :storage-key="guideStorageKey('build-console')"
    welcome-title="欢迎使用企业构建中心"
    welcome-description="跟着指引找到企业配置、模块管理和打包入口，了解如何生成企业专属版本。"
  />
</template>
