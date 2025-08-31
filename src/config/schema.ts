import { Schema } from 'koishi'
import { Config } from '../types'

export const ConfigSchema: Schema<Config> = Schema.object({
  groupManagement: Schema.object({
    autoApprove: Schema.boolean().default(false).description('是否启用自动审批'),
    useWhitelist: Schema.boolean().default(true).description('是否启用QQ号白名单检查'),
    autoRejectNonWhitelist: Schema.boolean().default(true).description('是否自动拒绝不在白名单中的申请'),
    useKeywordFilter: Schema.boolean().default(true).description('是否启用关键词过滤'),
    useNameValidation: Schema.boolean().default(true).description('是否启用姓名验证（严格模式：只通过白名单姓名）'),
    enableWelcome: Schema.boolean().default(true).description('是否启用入群欢迎消息'),
    welcomeMessage: Schema.string().default('欢迎新朋友加入！请仔细阅读群公告。').description('欢迎消息'),
    rejectionMessage: Schema.string().default('很抱歉，您的入群申请不符合要求。').description('拒绝消息'),
    nameValidationMessage: Schema.string().default('申请被拒绝：请填写完整真实姓名后重新申请。如姓名填写正确但仍被拒绝，请联系群管理员添加到白名单。').description('姓名验证失败时的提示消息')
  }).description('群组管理设置'),
  whitelist: Schema.array(String).default([]).description('QQ号白名单'),
  nameWhitelist: Schema.array(String).default([]).description('姓名白名单（用于严格姓名验证）'),
  approvalKeywords: Schema.array(String).default(['朋友推荐', '学习交流']).description('自动通过关键词'),
  rejectionKeywords: Schema.array(String).default(['广告', '营销', '推广']).description('自动拒绝关键词'),
  messageMonitor: Schema.object({
    enabled: Schema.boolean().default(true).description('是否启用消息监控'),
    logLevel: Schema.union(['info', 'warn', 'error']).default('info').description('日志级别')
  }).description('消息监控设置'),
  database: Schema.object({
    enabled: Schema.boolean().default(true).description('是否启用数据库存储'),
    tableName: Schema.string().default('group_master_config').description('数据库表名')
  }).description('数据库设置')
})