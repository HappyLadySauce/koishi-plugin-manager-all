import { Context } from 'koishi'
import { Config } from '../types'
import { DatabaseService } from '../database'

export abstract class BaseCommandHandler {
  constructor(
    protected ctx: Context,
    protected config: Config,
    protected database?: DatabaseService
  ) {}

  protected async ensureGuildContext(guildId?: string): Promise<string> {
    if (!guildId) {
      throw new Error('❌ 此命令只能在群组中使用')
    }
    return guildId
  }

  protected formatList(items: string[], type: string): string {
    if (items.length === 0) {
      return `📋 ${type}列表为空`
    }

    const list = items.map((item, index) => `${index + 1}. ${item}`).join('\n')
    return `📋 ${type}列表 (${items.length} 个):\n\n${list}`
  }

  protected formatBooleanStatus(value: boolean): string {
    return value ? '✅ 启用' : '❌ 禁用'
  }

  protected formatConfigStatus(config: Config): string[] {
    return [
      '⚙️ 群管配置状态:',
      '',
      `🔄 自动审批: ${this.formatBooleanStatus(config.groupManagement.autoApprove)}`,
      `👤 严格姓名验证: ${this.formatBooleanStatus(config.groupManagement.useNameValidation)}`,
      `📋 QQ号白名单检查: ${this.formatBooleanStatus(config.groupManagement.useWhitelist)}`,
      `🚫 自动拒绝非白名单: ${this.formatBooleanStatus(config.groupManagement.autoRejectNonWhitelist)}`,
      `🔑 关键词过滤: ${this.formatBooleanStatus(config.groupManagement.useKeywordFilter)}`,
      `💬 入群欢迎: ${this.formatBooleanStatus(config.groupManagement.enableWelcome)}`,
      `📝 消息监控: ${this.formatBooleanStatus(config.messageMonitor.enabled)}`,
      `💾 数据库存储: ${this.formatBooleanStatus(config.database.enabled)}`,
    ]
  }
}