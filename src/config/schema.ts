import { Schema } from 'koishi'
import { Config } from '../types'

export const ConfigSchema: Schema<Config> = Schema.object({
  groupManagement: Schema.object({
    autoApprove: Schema.boolean().default(false).description('是否启用自动审批'),
    enableWelcome: Schema.boolean().default(true).description('是否启用入群欢迎消息'),
    welcomeMessage: Schema.string().default('欢迎新朋友加入！请仔细阅读群公告。').description('欢迎消息'),
    rejectionMessage: Schema.string().default('很抱歉，您的入群申请不符合要求。').description('拒绝消息')
  }).description('群组管理设置'),
  messageMonitor: Schema.object({
    enabled: Schema.boolean().default(true).description('是否启用消息监控'),
    logLevel: Schema.union(['info', 'warn', 'error']).default('info').description('日志级别')
  }).description('消息监控设置'),
  database: Schema.object({
    enabled: Schema.boolean().default(true).description('是否启用数据库存储'),
    tableName: Schema.string().default('group_master_config').description('数据库表名')
  }).description('数据库设置')
})